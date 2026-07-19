// api/payment.js — Processa pagamento com valor calculado server-side
// e cria o pedido no banco após a aprovação (fonte única de pedidos pagos).
const PRICES = require('../lib/prices');
const { FREIGHT_TABLE, DEFAULT_FREIGHT } = require('../lib/freight-table');
const { sendOrderEmails } = require('../lib/order-email');

const TEST_PRODUCT_ID = 99; // pedido só com ele não paga frete

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    token, payment_method_id, issuer_id, installments,
    payer, items, coupon_code, freight_service, idempotency_key, order
  } = req.body;

  if (!token || !payer?.email || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Dados de pagamento incompletos' });
  }

  const { createClient } = require('@supabase/supabase-js');
  const sbAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Calcula subtotal com preços do servidor ──────────────────────────────
  let subtotal = 0;
  const orderItems = [];
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

    const qty = Math.max(1, Math.min(Number(item.qty) || 1, 99));
    subtotal += unitPrice * qty;
    orderItems.push({
      id:    Number(item.id),
      name:  String(item.name  || `Produto ${item.id}`).slice(0, 160),
      image: String(item.image || '').slice(0, 400),
      size:  String(item.size  || '').slice(0, 20),
      qty,
      price: unitPrice, // preço do servidor, nunca o do cliente
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  // ── Valida cupom no banco ────────────────────────────────────────────────
  let discount = 0;
  let freeShipCoupon = false;
  let couponCode = null;
  if (coupon_code) {
    try {
      const { data: coupon } = await sbAdmin
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
          couponCode = coupon.code;
          if (coupon.discount_type === 'frete') {
            freeShipCoupon = true; // frete grátis: sem desconto no subtotal
          } else {
            discount = coupon.discount_type === 'percent'
              ? subtotal * (coupon.discount_value / 100)
              : Number(coupon.discount_value);
            discount = Math.min(discount, subtotal);
            discount = Math.round(discount * 100) / 100;
          }
        }
      }
    } catch (err) {
      console.error('[payment] erro ao validar cupom:', err);
    }
  }

  // ── Frete calculado no servidor (nunca confia no valor do cliente) ───────
  const service  = String(freight_service || 'PAC').toUpperCase() === 'SEDEX' ? 'SEDEX' : 'PAC';
  const testOnly = items.every(i => Number(i.id) === TEST_PRODUCT_ID);
  let freight = 0;
  if (!testOnly && !freeShipCoupon) {
    const freeAbove = parseFloat(process.env.FREE_SHIPPING_ABOVE || '299');
    if (subtotal - discount < freeAbove) {
      let table = DEFAULT_FREIGHT;
      const cepDigits = String(order?.address?.cep || '').replace(/\D/g, '');
      if (cepDigits.length === 8) {
        try {
          const r = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
          const d = await r.json();
          if (!d.erro) table = FREIGHT_TABLE[(d.uf || '').toUpperCase()] || DEFAULT_FREIGHT;
        } catch { /* ViaCEP fora do ar: usa tabela padrão */ }
      }
      freight = service === 'SEDEX' ? table.sedex.price : table.pac.price;
    }
  }
  freight = Math.round(freight * 100) / 100;

  const total = Math.round((subtotal - discount + freight) * 100) / 100;

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

    console.log(`[payment] id:${result.id} status:${result.status} subtotal:${subtotal} discount:${discount} freight:${freight} total:${total} service:${service}`);

    // ── Cria o pedido no banco (service role) — fonte única de pedidos pagos ──
    let orderId = null;
    if (['approved', 'pending', 'in_process'].includes(result.status)) {
      const orderRow = {
        customer_id:     order?.customer_id || null,
        customer_name:   String(order?.customer_name  || payer.email).slice(0, 120),
        customer_email:  String(order?.customer_email || payer.email).slice(0, 160),
        customer_phone:  String(order?.customer_phone || '').slice(0, 40) || null,
        items:           orderItems,
        subtotal,
        discount,
        freight,
        freight_service: service,
        total,
        coupon_code:     couponCode,
        address:         order?.address || null,
        notes:           order?.notes ? String(order.notes).slice(0, 1000) : null,
        status:          'novo',
        payment_id:      String(result.id),
        payment_status:  result.status === 'approved' ? 'aprovado' : 'pendente',
      };
      try {
        let ins = await sbAdmin.from('orders').insert(orderRow).select('id').single();
        if (ins.error && /freight/i.test(ins.error.message || '')) {
          // Banco ainda sem colunas de frete: salva sem elas
          const { freight: _f, freight_service: _s, ...rest } = orderRow;
          rest.notes = [orderRow.notes, `Frete: R$ ${freight.toFixed(2)} (${service})`].filter(Boolean).join(' | ');
          ins = await sbAdmin.from('orders').insert(rest).select('id').single();
        }
        if (ins.error) console.error('[payment] erro ao salvar pedido:', ins.error);
        else orderId = ins.data.id;
      } catch (e) {
        console.error('[payment] exceção ao salvar pedido:', e);
      }

      // E-mail de confirmação para a cliente + aviso de novo pedido para a loja
      const shortId = (orderId || String(result.id)).slice(0, 8).toUpperCase();
      await sendOrderEmails(orderRow, shortId, result.status === 'approved');
    }

    return res.status(200).json({
      id:            result.id,
      status:        result.status,
      status_detail: result.status_detail,
      amount:        total,
      order_id:      orderId
    });

  } catch (err) {
    console.error('[payment] exceção:', err);
    return res.status(500).json({ error: 'Erro interno ao processar pagamento' });
  }
};
