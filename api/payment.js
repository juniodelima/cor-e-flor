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

  // ── Preços definidos no painel ───────────────────────────────────────────
  // A tabela `products` e site_settings só são graváveis por administrador,
  // então servem como fonte de preço tanto quanto lib/prices.js.
  let promoPrices = {}, adminPieces = {}, painel = {};
  try {
    const { data: cfg } = await sbAdmin
      .from('site_settings').select('key,value').in('key', ['promo_prices', 'product_pieces']);
    for (const row of cfg || []) {
      if (row.key === 'promo_prices')   promoPrices = row.value || {};
      if (row.key === 'product_pieces') adminPieces = row.value || {};
    }
  } catch (e) {
    console.warn('[payment] não foi possível ler site_settings:', e.message);
  }
  try {
    const ids = [...new Set(items.map(i => String(i.id)))];
    const { data: rows } = await sbAdmin
      .from('products').select('id,price,piece_options,status,stock').in('id', ids);
    for (const row of rows || []) painel[String(row.id)] = row;
  } catch (e) {
    console.warn('[payment] não foi possível ler products:', e.message);
  }

  // ── Calcula subtotal com preços do servidor ──────────────────────────────
  let subtotal = 0;
  const orderItems = [];
  for (const item of items) {
    const row     = painel[String(item.id)];
    const catalog = PRICES[Number(item.id)];

    /* Preço de tabela: o do painel quando o produto foi editado lá, senão o
       de lib/prices.js. Sem nenhum dos dois, o produto não existe. */
    const rowPrice = row ? Number(row.price) : 0;
    const basePrice = rowPrice > 0 ? rowPrice : (catalog ? catalog.price : 0);
    if (!basePrice) {
      return res.status(400).json({ error: `Produto ${item.id} não encontrado` });
    }
    if (row && row.status && row.status !== 'active') {
      return res.status(400).json({ error: `Produto ${item.id} não está mais à venda` });
    }

    // Promoção só vale se for mais barata que o preço de tabela
    const promoRaw = Number(promoPrices[String(item.id)]);
    const promo = (promoRaw > 0 && promoRaw < basePrice) ? promoRaw : null;

    // Peças avulsas cadastradas no painel valem junto com as do catálogo fixo
    const pecasDoPainel = [
      ...(Array.isArray(row?.piece_options) ? row.piece_options : []),
      ...(Array.isArray(adminPieces[String(item.id)]) ? adminPieces[String(item.id)] : []),
    ].map(pc => Number(pc && pc.price)).filter(n => n > 0);

    let unitPrice;
    if (item.piecePrice != null) {
      const allowed = [...(catalog?.pieces || []), basePrice, ...pecasDoPainel];
      if (promo) allowed.push(promo);
      const valid   = allowed.some(p => Math.abs(p - Number(item.piecePrice)) < 0.02);
      if (!valid) {
        console.warn(`[payment] preço inválido produto ${item.id}: ${item.piecePrice}`);
        return res.status(400).json({ error: `Preço inválido para o produto ${item.id}` });
      }
      unitPrice = Number(item.piecePrice);
    } else {
      unitPrice = promo ?? basePrice;
    }

    const qty = Math.max(1, Math.min(Number(item.qty) || 1, 99));
    subtotal += unitPrice * qty;
    orderItems.push({
      // produtos criados no painel têm id em texto ("P8F3K2QA")
      id:    Number.isFinite(Number(item.id)) ? Number(item.id) : String(item.id),
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
