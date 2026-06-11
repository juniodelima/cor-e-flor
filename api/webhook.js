// api/webhook.js — Recebe mensagens do WhatsApp e Instagram via Meta Webhooks
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYSTEM_PROMPT = `Você é Flora, a assistente virtual da Cor & Flor, uma boutique feminina de moda localizada em Brasília-DF.
Você é atenciosa, acolhedora e usa um tom informal mas elegante. Responda sempre em português brasileiro.

SOBRE A LOJA:
- Nome: Cor & Flor Boutique
- Localização: Brasília, DF (atendemos apenas no DF por enquanto)
- Especialidade: Moda feminina — blusas, vestidos, saias, calças, acessórios
- Horário: segunda a sábado, das 9h às 18h
- Site: https://cor-e-flor.vercel.app

COMO ATENDER:
- Respostas curtas e diretas (máximo 3 parágrafos curtos)
- Use emojis com moderação (flores, coração — 1 a 2 por mensagem)
- Para dúvidas sobre pedidos, peça o número do pedido
- Informe prazos de entrega somente no DF
- Não invente informações que não sabe — diga que vai verificar

QUANDO ESCALAR PARA ATENDENTE HUMANA:
- Cliente pede explicitamente falar com atendente
- Reclamação de produto com defeito ou avaria
- Problema com pagamento ou reembolso
- Pedido de troca ou devolução
- Mais de 4 mensagens sem resolver o problema
Quando escalar, responda EXATAMENTE: "Vou chamar uma de nossas atendentes para te ajudar melhor 💜 Um momento!"`;

module.exports = async function handler(req, res) {
  // Verificação do webhook pela Meta (GET)
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Mensagens recebidas (POST)
  if (req.method === 'POST') {
    const body = req.body;
    try {
      if (body.object === 'whatsapp_business_account') {
        await processWhatsApp(body);
      } else if (body.object === 'instagram') {
        await processInstagram(body);
      }
    } catch (err) {
      console.error('[webhook] erro ao processar mensagem:', err);
    }
    // Meta exige 200 imediato, mesmo com erro interno
    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// ─── Parsers por canal ────────────────────────────────────────────────────────

async function processWhatsApp(body) {
  const value    = body.entry?.[0]?.changes?.[0]?.value;
  const messages = value?.messages;
  if (!messages?.length) return;

  const msg         = messages[0];
  const messageText = msg.text?.body;
  if (!messageText) return; // ignorar áudio, imagem, etc. por ora

  await handleIncomingMessage({
    channel:       'whatsapp',
    senderId:      msg.from,
    senderName:    value?.contacts?.[0]?.profile?.name || null,
    messageText,
    messageId:     msg.id,
    phoneNumberId: value?.metadata?.phone_number_id
  });
}

async function processInstagram(body) {
  const messaging = body.entry?.[0]?.messaging?.[0];
  if (!messaging) return;

  const messageText = messaging.message?.text;
  const senderId    = messaging.sender?.id;
  if (!messageText || !senderId) return;

  await handleIncomingMessage({
    channel:    'instagram',
    senderId,
    senderName: null,
    messageText,
    messageId:  messaging.message?.mid
  });
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

async function handleIncomingMessage({ channel, senderId, senderName, messageText, messageId, phoneNumberId }) {
  // 1. Upsert contato
  const { data: contacts, error: cErr } = await sb
    .from('atd_contacts')
    .upsert(
      { channel, channel_id: senderId, name: senderName },
      { onConflict: 'channel,channel_id', ignoreDuplicates: false }
    )
    .select();
  if (cErr || !contacts?.length) { console.error('[contact upsert]', cErr); return; }
  const contact = contacts[0];

  // 2. Buscar conversa aberta ou criar nova
  const { data: openConvs } = await sb
    .from('atd_conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .in('status', ['bot', 'waiting', 'human'])
    .order('created_at', { ascending: false })
    .limit(1);

  let conversation = openConvs?.[0];
  if (!conversation) {
    const { data: newConv } = await sb
      .from('atd_conversations')
      .insert({ contact_id: contact.id, channel, status: 'bot', phone_number_id: phoneNumberId })
      .select();
    conversation = newConv?.[0];
  }
  if (!conversation) return;

  // Atualizar timestamp da conversa
  await sb.from('atd_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversation.id);

  // 3. Salvar mensagem do cliente
  await sb.from('atd_messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content: messageText,
    meta_message_id: messageId
  });

  // 4. Se atendimento humano ativo, parar aqui (atendente responde pelo painel)
  if (conversation.status === 'human') return;

  // 5. Buscar histórico para contexto da IA
  const { data: history } = await sb
    .from('atd_messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(20);

  // 6. Chamar Claude
  const aiText = await callClaude(history || []);
  if (!aiText) return;

  // 7. Detectar escalation → mudar status para "waiting"
  if (aiText.includes('Vou chamar uma de nossas atendentes')) {
    await sb.from('atd_conversations').update({ status: 'waiting' }).eq('id', conversation.id);
  }

  // 8. Salvar resposta da IA
  await sb.from('atd_messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: aiText
  });

  // 9. Enviar via Meta API
  const pnId = phoneNumberId || conversation.phone_number_id;
  if (channel === 'whatsapp') {
    await sendWhatsApp(pnId, senderId, aiText);
  } else if (channel === 'instagram') {
    await sendInstagram(senderId, aiText);
  }
}

// ─── Claude API ───────────────────────────────────────────────────────────────

async function callClaude(messages) {
  // Converter histórico: admin vira 'assistant' para o Claude
  const claudeMessages = messages.map(m => ({
    role:    m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  // Claude exige que a última mensagem seja do usuário
  if (!claudeMessages.length || claudeMessages[claudeMessages.length - 1].role !== 'user') return null;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json'
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     SYSTEM_PROMPT,
      messages:   claudeMessages
    })
  });

  if (!resp.ok) { console.error('[claude]', await resp.text()); return null; }
  const data = await resp.json();
  return data.content?.[0]?.text || null;
}

// ─── Meta API — envio ─────────────────────────────────────────────────────────

async function sendWhatsApp(phoneNumberId, to, text) {
  if (!phoneNumberId) { console.error('[whatsapp] phoneNumberId ausente'); return; }
  const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[whatsapp] erro ao enviar (${resp.status}):`, err);
  } else {
    console.log('[whatsapp] mensagem enviada para', to);
  }
}

async function sendInstagram(recipientId, text) {
  const resp = await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message:   { text }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[instagram] erro ao enviar (${resp.status}):`, err);
  }
}
