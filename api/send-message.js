// api/send-message.js — Admin envia mensagem manualmente pelo painel
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticação simples via secret header
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { conversationId, text, action } = req.body;
  if (!conversationId) return res.status(400).json({ error: 'conversationId obrigatório' });

  // Ação de status: assumir, devolver para IA, resolver
  if (action) {
    const statusMap = {
      'assume':   'human',
      'return_ai': 'bot',
      'resolve':  'resolved'
    };
    const newStatus = statusMap[action];
    if (!newStatus) return res.status(400).json({ error: 'action inválida' });

    await sb.from('atd_conversations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return res.status(200).json({ status: newStatus });
  }

  // Envio de mensagem
  if (!text?.trim()) return res.status(400).json({ error: 'text obrigatório' });

  // Buscar conversa + contato
  const { data: conv, error } = await sb
    .from('atd_conversations')
    .select('*, contact:atd_contacts(*)')
    .eq('id', conversationId)
    .single();

  if (error || !conv) return res.status(404).json({ error: 'Conversa não encontrada' });

  // Salvar mensagem do admin no banco
  await sb.from('atd_messages').insert({
    conversation_id: conversationId,
    role: 'admin',
    content: text.trim()
  });

  // Atualizar timestamp
  await sb.from('atd_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Enviar via Meta
  const recipientId = conv.contact.channel_id;
  try {
    if (conv.channel === 'whatsapp') {
      await sendWhatsApp(conv.phone_number_id || process.env.META_PHONE_NUMBER_ID, recipientId, text);
    } else if (conv.channel === 'instagram') {
      await sendInstagram(recipientId, text);
    }
  } catch (sendErr) {
    console.error('[send-message] falha ao enviar via Meta:', sendErr);
    return res.status(500).json({ error: 'Mensagem salva mas falha ao enviar' });
  }

  return res.status(200).json({ status: 'ok' });
};

async function sendWhatsApp(phoneNumberId, to, text) {
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
  if (!resp.ok) throw new Error(await resp.text());
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
  if (!resp.ok) throw new Error(await resp.text());
}
