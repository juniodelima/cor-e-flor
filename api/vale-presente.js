const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'VP-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to_name, to_email, from_name, from_email, message, amount } = req.body || {};

  if (!to_name || !to_email || !from_name || !from_email || !amount) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  const val = parseFloat(amount);
  if (isNaN(val) || val < 50 || val > 5000) {
    return res.status(400).json({ error: 'Valor inválido (R$ 50 – R$ 5.000)' });
  }

  const code = genCode();

  // Salva no Supabase — tabela gift_cards (crie via SQL abaixo)
  const { error } = await sb.from('gift_cards').insert({
    code,
    amount: val,
    to_name,
    to_email,
    from_name,
    from_email,
    message: message || null,
    status: 'pending_payment', // admin confirma após pagamento
    used: false,
  });

  if (error) {
    console.error('[vale-presente]', error);
    return res.status(500).json({ error: 'Erro ao registrar vale presente' });
  }

  return res.json({ ok: true, code });
};
