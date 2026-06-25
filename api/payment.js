// api/payment.js — Processa pagamento com valor calculado server-side
const PRICES = require('../lib/prices');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    token, payment_method_id, issuer_id, installments,
    payer, items, coupon_code, idempotency_key
  } = req.body;

  if (!token || !payer?.email || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Dados de pagamento incompletos' });
  }

  // ── Calcula subtotal com preços do servidor ──────────────────────────────
  let subtotal = 0;
  for (const item of items) {
    const catalog = PRICES[Number(item.id)];
    if (!catalog) {
      return res.status(400).json({ error: `Produto ${item.id} não encontrado` });
    }

    let unitPrice;
    if (item.piecePrice != null) {
      const allowed = catalog.pieces || [catalog.price];
      const valid   = allowed.some(p => Math.abs(p - Number(item.piecePrice)) < 0.02);
      if (!valid) {
        console.warn(`[payment] preço inválido produto ${item.id}: ${item.piecePrice}`);
        return res.status(400).json({ error: `Preço inválido para o produto ${item.id}` });
      }
      unitPrice = Number(item.piecePrice);
    } else {
      unitPrice = catalog.price;
    }

    subtotal += unitPrice * (Number(item.qty) || 1);
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // ── Valida cupom no banco ────────────────────────────────────────────────
  let discount = 0;
  if (coupon_code) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { data: coupon } = await sb
        .from('coupons')
        .select('*')
        .eq('code', String(coupon_code).trim().toUpperCase())
        .eq('active', true)
        .single();

      if (coupon) {
        const expired  = coupon.expires_at && new Date(coupon.expires_at) < new Date();
        const depleted = coupon.max_uses && coupon.uses >= coupon.max_uses;
        const tooSmall = subtotal < (coupon.min_order || 0);

        if (!expired && !depleted && !tooSmall) {
          discount = coupon.discount_type === 'percent'
            ? subtotal * (coupon.discount_value / 100)
            : Number(coupon.discount_value);
          discount = Math.min(discount, subtotal);
          discount = Math.round(discount * 100) / 100;
        }
      }
    } catch (err) {
      console.error('[payment] erro ao validar cupom:', err);
    }
  }

  const total = Math.round((subtotal - discount) * 100) / 100;

  if (total <= 0) return res.status(400).json({ error: 'Valor inválido' });

  // ── Envia para o Mercado Pago ────────────────────────────────────────────
  try {
    const resp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization':     `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type':      'application/json',
        'X-Idempotency-Key': idempotency_key || `${Date.now()}-${Math.random()}`
      },
      body: JSON.stringify({
        transaction_amount: total,
        token,
        description:        'Compra Cor & Flor',
        installments:       Number(installments) || 1,
        payment_method_id,
        issuer_id,
        payer: {
          email:          payer.email,
          identification: payer.identification || undefined
        }
      })
    });

    const result = await resp.json();

    if (!resp.ok) {
      console.error('[payment] MP erro:', JSON.stringify(result));
      return res.status(resp.status).json(result);
    }

    console.log(`[payment] id:${result.id} status:${result.status} total:${total}`);
    return res.status(200).json({
      id:            result.id,
      status:        result.status,
      status_detail: result.status_detail,
      amount:        total
    });

  } catch (err) {
    console.error('[payment] exceção:', err);
    return res.status(500).json({ error: 'Erro interno ao processar pagamento' });
  }
};
