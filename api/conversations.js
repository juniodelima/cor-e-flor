// api/conversations.js — Lista conversas e mensagens para o painel admin
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, status } = req.query;

  // Buscar mensagens de uma conversa específica
  if (id) {
    const { data: messages, error } = await sb
      .from('atd_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ messages: messages || [] });
  }

  // Listar conversas (com info do contato)
  let query = sb
    .from('atd_conversations')
    .select(`
      id, channel, status, created_at, updated_at,
      contact:atd_contacts(id, name, channel_id, phone, instagram_username)
    `)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: conversations, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Para cada conversa, buscar a última mensagem
  const withLastMsg = await Promise.all(
    (conversations || []).map(async (conv) => {
      const { data: msgs } = await sb
        .from('atd_messages')
        .select('content, role, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return { ...conv, last_message: msgs?.[0] || null };
    })
  );

  return res.status(200).json({ conversations: withLastMsg });
};
