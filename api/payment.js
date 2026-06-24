// api/payment.js — Cria pagamento no Mercado Pago
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    token, payment_method_id, issuer_id, installments,
    amount, payer, description, idempotency_key
  } = req.body;

  if (!token || !amount || !payer?.email) {
    return res.status(400).json({ error: 'Dados de pagamento incompletos' });
  }

  const body = {
    transaction_amount: Number(amount),
    token,
    description: description || 'Compra Cor & Flor',
    installments: Number(installments) || 1,
    payment_method_id,
    issuer_id,
    payer: {
      email: payer.email,
      identification: payer.identification || undefined
    }
  };

  try {
    const resp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization':      `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type':       'application/json',
        'X-Idempotency-Key':  idempotency_key || `${Date.now()}-${Math.random()}`
      },
      body: JSON.stringify(body)
    });

    const result = await resp.json();

    if (!resp.ok) {
      console.error('[payment] MP erro:', JSON.stringify(result));
      return res.status(resp.status).json(result);
    }

    console.log('[payment] criado:', result.id, '| status:', result.status);
    return res.status(200).json({
      id:            result.id,
      status:        result.status,
      status_detail: result.status_detail
    });

  } catch (err) {
    console.error('[payment] exceção:', err);
    return res.status(500).json({ error: 'Erro interno ao processar pagamento' });
  }
};
