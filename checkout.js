/* checkout.js — Página de finalização de compra */

const MP_PUBLIC_KEY = 'APP_USR-51ce84d0-ae1e-4a0a-b010-0fe696012fc6';
const BRL = n => 'R$ ' + Number(n).toFixed(2).replace('.', ',');

let _cart         = [];
let _couponData   = null;
let _subtotal     = 0;
let _mpBrick      = null;
let _orderData    = null;
let _toastTimer   = null;
let _freightCost    = 0;
let _freightService = null; // 'PAC' | 'SEDEX'
let _freightFree    = false;
let _freightData    = null; // resposta do /api/freight

// Produto de teste (R$ 1): pedido contendo só ele não paga frete
const TEST_PRODUCT_ID = 99;
let _testFreightApplied = false;
function _isTestOnlyCart() {
  return _cart.length > 0 && _cart.every(it => Number(it.id) === TEST_PRODUCT_ID);
}

// ── Toast ────────────────────────────────────────────────────────────────────

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('is-show'), 3500);
}

// ── Step indicators ──────────────────────────────────────────────────────────

function setStep(active) {
  [1, 2, 3].forEach(n => {
    const el = document.getElementById('step-ind-' + n);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (n < active)  el.classList.add('done');
    if (n === active) el.classList.add('active');
  });

  document.getElementById('step-dados').style.display    = active === 1 ? '' : 'none';
  document.getElementById('step-pagamento').style.display = active === 2 ? '' : 'none';
  document.getElementById('step-sucesso').style.display  = active === 3 ? '' : 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Renderiza resumo lateral ─────────────────────────────────────────────────

function renderSummary() {
  const list = document.getElementById('co-items-list');
  if (!list) return;

  if (!_cart.length) {
    list.innerHTML = '<li style="text-align:center;color:var(--warm-gray);font-size:13px;padding:20px 0">Carrinho vazio</li>';
    return;
  }

  list.innerHTML = _cart.map(it => {
    const p    = products.find(x => x.id === it.id);
    if (!p) return '';
    const price = (it.piecePrice ?? p.price) * it.qty;
    return `<li class="co-item">
      <img src="${p.image}" alt="${p.name}" loading="lazy">
      <div class="co-item__info">
        <div class="co-item__name">${p.name}</div>
        <div class="co-item__sub">${it.size ? 'Tam: ' + it.size : ''} ${it.qty > 1 ? '· Qtd: ' + it.qty : ''}</div>
      </div>
      <div class="co-item__price">${BRL(price)}</div>
    </li>`;
  }).join('');

  updateTotals();
}

function updateTotals() {
  _subtotal = _cart.reduce((s, it) => {
    const p = products.find(x => x.id === it.id);
    return s + (it.piecePrice ?? p?.price ?? 0) * it.qty;
  }, 0);

  const discount = _couponData?.discount || 0;

  // Frete grátis por valor mínimo (verifica mesmo após cupom de desconto)
  let freightCost = _freightCost;
  if (_freightData && !_freightFree) {
    const afterDiscount = _subtotal - discount;
    if (afterDiscount >= (_freightData.free_above || 299)) {
      freightCost = 0;
    }
  }

  const total = Math.max(0, _subtotal - discount + freightCost);

  document.getElementById('co-subtotal').textContent = BRL(_subtotal);
  document.getElementById('co-total').textContent    = BRL(total);

  const freteEl = document.getElementById('co-frete-val');
  if (freteEl) {
    if (_freightFree) {
      freteEl.textContent  = 'Grátis ✿';
      freteEl.style.color  = '#2e7d4f';
      freteEl.style.fontStyle = 'normal';
    } else if (!_freightData) {
      freteEl.textContent  = 'Digite o CEP';
      freteEl.style.color  = 'var(--warm-gray)';
      freteEl.style.fontStyle = 'italic';
    } else if (freightCost === 0) {
      freteEl.textContent  = 'Grátis ✿';
      freteEl.style.color  = '#2e7d4f';
      freteEl.style.fontStyle = 'normal';
    } else {
      freteEl.textContent  = BRL(freightCost);
      freteEl.style.color  = 'var(--ink)';
      freteEl.style.fontStyle = 'normal';
    }
  }

  const discRow = document.getElementById('co-discount-row');
  if (discount > 0 && _couponData) {
    discRow.style.display = '';
    document.getElementById('co-coupon-label').textContent = `(${_couponData.coupon.code})`;
    document.getElementById('co-discount-val').textContent = '−' + BRL(discount);
  } else {
    discRow.style.display = 'none';
  }
}

// ── Frete ────────────────────────────────────────────────────────────────────

async function calcFreight(cep) {
  const section  = document.getElementById('co-freight-section');
  const loading  = document.getElementById('co-freight-loading');
  const freeMsg  = document.getElementById('co-freight-free-msg');
  const options  = document.getElementById('co-freight-options');
  const freteVal = document.getElementById('co-frete-val');

  if (!section) return;

  // Pedido só com o produto de teste: sem frete, total fica no valor do produto
  if (_isTestOnlyCart()) {
    _freightFree        = true;
    _freightCost        = 0;
    _freightService     = 'PAC';
    _testFreightApplied = true;
    section.style.display = '';
    if (loading) loading.style.display = 'none';
    if (options) options.style.display = 'none';
    if (freeMsg) {
      freeMsg.style.display = '';
      freeMsg.innerHTML = '<p class="co-freight-free-msg">🎁 Produto de teste — sem frete!</p>';
    }
    updateTotals();
    return;
  }

  section.style.display = '';
  if (loading)  loading.style.display  = '';
  if (freeMsg)  freeMsg.style.display  = 'none';
  if (options)  options.style.display  = 'none';
  if (freteVal) freteVal.textContent   = 'Calculando…';

  try {
    const r = await fetch(`/api/freight?cep=${cep}`);
    const d = await r.json();

    if (d.error) {
      if (loading) loading.style.display = 'none';
      if (freteVal) freteVal.textContent = 'CEP inválido';
      return;
    }

    _freightData = d;
    if (loading) loading.style.display = 'none';

    const discount      = _couponData?.discount || 0;
    const afterDiscount = _subtotal - discount;
    const threshold     = d.free_above || 299;

    if (_freightFree || afterDiscount >= threshold) {
      // Frete grátis (cupom ou valor mínimo)
      _freightCost    = 0;
      _freightService = 'PAC';
      if (options) options.style.display = 'none';
      if (freeMsg) {
        freeMsg.style.display = '';
        const reason = _freightFree
          ? `com o cupom aplicado`
          : `para compras acima de ${BRL(threshold)}`;
        freeMsg.innerHTML = `<p class="co-freight-free-msg">🎁 Frete grátis ${reason}!</p>`;
      }
    } else {
      // Exibe opções PAC / SEDEX
      _freightService = 'PAC';
      _freightCost    = d.pac.price;
      if (options) {
        options.style.display = '';
        const pacPriceEl   = document.getElementById('co-pac-price');
        const pacDaysEl    = document.getElementById('co-pac-days');
        const sedexPriceEl = document.getElementById('co-sedex-price');
        const sedexDaysEl  = document.getElementById('co-sedex-days');
        if (pacPriceEl)   pacPriceEl.textContent   = BRL(d.pac.price);
        if (pacDaysEl)    pacDaysEl.textContent     = d.pac.days;
        if (sedexPriceEl) sedexPriceEl.textContent  = BRL(d.sedex.price);
        if (sedexDaysEl)  sedexDaysEl.textContent   = d.sedex.days;
        // Seleciona PAC por padrão
        const pacRadio = document.querySelector('input[name="freight"][value="PAC"]');
        if (pacRadio) pacRadio.checked = true;
      }
    }

    updateTotals();
  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (freteVal) freteVal.textContent = 'Erro ao calcular';
    console.error('[freight]', err);
  }
}

function selectFreight(service) {
  if (!_freightData || _freightFree) return;
  _freightService = service;
  _freightCost    = service === 'SEDEX' ? _freightData.sedex.price : _freightData.pac.price;
  updateTotals();
}

// ── CEP ──────────────────────────────────────────────────────────────────────

function maskCep(v) {
  return v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
}

async function lookupCep(raw) {
  const cep = raw.replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) { toast('CEP não encontrado.'); return; }
    setValue('co-rua',    d.logradouro);
    setValue('co-bairro', d.bairro);
    setValue('co-cidade', d.localidade);
    setValue('co-estado', d.uf);
    document.getElementById('co-num')?.focus();
    calcFreight(cep);
  } catch {
    toast('Erro ao buscar CEP. Preencha manualmente.');
  }
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.value = val;
}

// ── Máscaras ─────────────────────────────────────────────────────────────────

function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function maskCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// ── Cupom ────────────────────────────────────────────────────────────────────

async function applyCoupon() {
  const code  = document.getElementById('co-coupon')?.value.trim();
  const msgEl = document.getElementById('co-coupon-msg');
  if (!code) { msgEl.textContent = ''; return; }

  const result = await Coupons.validate(code, _subtotal);
  if (result.ok) {
    _couponData = result;

    if (result.free_shipping) {
      // Cupom de frete grátis
      _freightFree = true;
      _freightCost = 0;
      msgEl.className  = 'co-coupon-msg ok';
      msgEl.textContent = '✓ Frete grátis aplicado!';
      // Atualiza exibição de frete se já foi calculado
      if (_freightData) {
        const options = document.getElementById('co-freight-options');
        const freeMsg = document.getElementById('co-freight-free-msg');
        if (options) options.style.display = 'none';
        if (freeMsg) {
          freeMsg.style.display = '';
          freeMsg.innerHTML = `<p class="co-freight-free-msg">🎁 Frete grátis com o cupom <strong>${code}</strong>!</p>`;
        }
      }
    } else {
      msgEl.className  = 'co-coupon-msg ok';
      msgEl.textContent = `✓ Desconto de ${BRL(result.discount)} aplicado!`;
    }
  } else {
    _couponData = null;
    msgEl.className  = 'co-coupon-msg err';
    msgEl.textContent = result.msg;
  }
  updateTotals();
  renderMyCoupons();
}

// ── Ofertas "leve +1 peça e ganhe brinde" (upsell no step de dados) ──────────

let _upsellExpired = false;

function renderUpsell() {
  const wrap = document.getElementById('co-upsell');
  const row  = document.getElementById('co-upsell-row');
  if (!wrap || !row || _upsellExpired) return;

  const inCart = new Set(_cart.map(it => it.id));
  const picks = products
    .filter(p => !inCart.has(p.id))
    .sort((a, b) => {
      const pa = a.originalPrice > a.price ? 1 - a.price / a.originalPrice : 0;
      const pb = b.originalPrice > b.price ? 1 - b.price / b.originalPrice : 0;
      return pb - pa; // maiores descontos primeiro
    })
    .slice(0, 4);

  if (!picks.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  row.innerHTML = picks.map(p => {
    const pct = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    return `
      <div class="co-upsell-card">
        <span class="co-upsell-card__off">${pct > 0 ? `-${pct}% OFF` : 'OFERTA'}</span>
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <div class="co-upsell-card__body">
          <p class="co-upsell-card__name">${p.name}</p>
          <div class="co-upsell-card__prices">
            <span class="co-upsell-card__price">${BRL(p.price)}</span>${p.originalPrice > p.price ? `<span class="co-upsell-card__was">${BRL(p.originalPrice)}</span>` : ''}
          </div>
          <button type="button" class="co-upsell-card__btn" data-upsell="${p.id}">+ Adicionar</button>
        </div>
      </div>`;
  }).join('');
}

// Timer de 10 min — o prazo sobrevive a recarregamentos na mesma aba
function startUpsellTimer() {
  const el   = document.getElementById('co-upsell-timer');
  const wrap = document.getElementById('co-upsell');
  if (!el || !wrap) return;

  let deadline = Number(sessionStorage.getItem('cf_upsell_deadline') || 0);
  if (!deadline || deadline <= Date.now()) {
    deadline = Date.now() + 10 * 60000;
    sessionStorage.setItem('cf_upsell_deadline', String(deadline));
  }

  let timer = null;
  function tick() {
    const left = deadline - Date.now();
    if (left <= 0) {
      if (timer) clearInterval(timer);
      _upsellExpired = true;
      wrap.style.display = 'none';
      return;
    }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    el.parentElement.classList.toggle('is-urgent', left < 60000);
  }
  tick();
  timer = setInterval(tick, 1000);
}

function addUpsellToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const existing = _cart.find(x => x.id === id && !x.pieceName);
  if (existing) existing.qty += 1;
  else _cart.push({ id, qty: 1, size: (p.sizes && p.sizes[0]) || 'Único', color: p.colors?.[0]?.hex || '' });
  localStorage.setItem('cf_cart', JSON.stringify(_cart));

  // Carrinho deixou de ser só o produto de teste → frete volta a valer
  if (_testFreightApplied && !_isTestOnlyCart()) {
    _testFreightApplied = false;
    if (!_couponData?.free_shipping) _freightFree = false;
    const cepDigits = (document.getElementById('co-cep')?.value || '').replace(/\D/g, '');
    if (cepDigits.length === 8) calcFreight(cepDigits);
  }

  renderSummary();
  renderUpsell();
  if (_couponData) applyCoupon(); // recalcula desconto com o novo subtotal
  toast(`✿ ${p.name} adicionado ao pedido`);
}

// ── Cupons resgatados (carteirinha do cliente) ───────────────────────────────

const COUPON_DESCS = { PRIMEIRA: 'Frete grátis acima de R$ 150' };

function _myCoupons() {
  try { return JSON.parse(localStorage.getItem('cf_my_coupons') || '[]'); }
  catch { return []; }
}

function renderMyCoupons() {
  const box = document.getElementById('co-my-coupons');
  if (!box) return;
  const applied = _couponData?.coupon?.code || '';
  box.innerHTML = _myCoupons().map(code => {
    const isSel = code.toUpperCase() === applied.toUpperCase();
    return `
      <button type="button" class="coupon-chip${isSel ? ' is-selected' : ''}" data-coupon="${code}">
        <span class="coupon-chip__tag">🎟️</span>
        <span class="coupon-chip__info">
          <span class="coupon-chip__code">${code}</span><br>
          <span class="coupon-chip__desc">${COUPON_DESCS[code] || 'Cupom de desconto'}</span>
        </span>
        <span class="coupon-chip__state">${isSel ? '✓ Aplicado' : 'Tocar para aplicar'}</span>
      </button>`;
  }).join('');
}

// ── Validação ─────────────────────────────────────────────────────────────────

function validateForm() {
  const required = [
    ['co-name',   'Nome completo'],
    ['co-email',  'E-mail'],
    ['co-phone',  'Telefone'],
    ['co-cep',    'CEP'],
    ['co-rua',    'Rua'],
    ['co-num',    'Número'],
    ['co-bairro', 'Bairro'],
    ['co-cidade', 'Cidade'],
    ['co-estado', 'Estado'],
  ];
  for (const [id, label] of required) {
    const el = document.getElementById(id);
    if (!el?.value.trim()) {
      toast(`Preencha o campo: ${label}`);
      el?.focus();
      return false;
    }
  }
  const email = document.getElementById('co-email').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('E-mail inválido.');
    document.getElementById('co-email')?.focus();
    return false;
  }
  if (!_freightService && !_freightFree) {
    toast('Aguarde o cálculo do frete ou verifique o CEP.');
    document.getElementById('co-cep')?.focus();
    return false;
  }
  return true;
}

// ── Avança para pagamento ─────────────────────────────────────────────────────

async function goToPayment() {
  if (!validateForm()) return;
  if (!_cart.length) { toast('Seu carrinho está vazio.'); return; }

  const discount = _couponData?.discount || 0;
  let freightCost = _freightCost;
  if (_freightFree || (_freightData && (_subtotal - discount) >= (_freightData.free_above || 299))) {
    freightCost = 0;
  }
  const total = Math.max(0, _subtotal - discount + freightCost);

  _orderData = {
    customer_id:     null,
    customer_name:   document.getElementById('co-name').value.trim(),
    customer_email:  document.getElementById('co-email').value.trim(),
    customer_phone:  document.getElementById('co-phone').value.trim(),
    items: _cart.map(it => {
      const p = products.find(x => x.id === it.id);
      return { id: it.id, name: p?.name, image: p?.image, size: it.size, qty: it.qty, price: it.piecePrice ?? p?.price };
    }),
    subtotal:        _subtotal,
    discount,
    freight:         freightCost,
    freight_service: _freightService || 'PAC',
    total,
    coupon_code:     _couponData?.coupon?.code || null,
    address: {
      cep:    document.getElementById('co-cep').value.trim(),
      rua:    document.getElementById('co-rua').value.trim(),
      num:    document.getElementById('co-num').value.trim(),
      comp:   document.getElementById('co-comp').value.trim(),
      bairro: document.getElementById('co-bairro').value.trim(),
      cidade: document.getElementById('co-cidade').value.trim(),
      estado: document.getElementById('co-estado').value.trim().toUpperCase(),
    },
    notes: document.getElementById('co-notes').value.trim() || null,
  };

  try {
    const user = await Auth.user();
    if (user) _orderData.customer_id = user.id;
  } catch { /* ignora */ }

  setStep(2);
  await initMPBrick(total, _orderData.customer_email);
}

// ── MP SDK ────────────────────────────────────────────────────────────────────

function loadMPSdk() {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = 'https://sdk.mercadopago.com/js/v2';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago'));
    document.head.appendChild(s);
  });
}

async function initMPBrick(amount, email) {
  const container = document.getElementById('mp-brick-container');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:32px;color:var(--warm-gray)">Carregando formulário de pagamento…</p>';

  try {
    await loadMPSdk();
    const mp      = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    const builder = mp.bricks();

    _mpBrick = await builder.create('cardPayment', 'mp-brick-container', {
      initialization: { amount, payer: { email } },
      customization: {
        paymentMethods: { minInstallments: 1, maxInstallments: 12 },
        visual: { hideFormTitle: true, hidePaymentButton: false }
      },
      callbacks: {
        onReady: () => {},
        onError: (err) => {
          console.error('[MP Brick]', err);
          toast('Erro ao carregar pagamento. Recarregue a página.');
        },
        onSubmit: async (formData) => {
          try {
            const resp = await fetch('/api/payment', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token:             formData.token,
                payment_method_id: formData.payment_method_id,
                issuer_id:         formData.issuer_id,
                installments:      formData.installments,
                payer:             formData.payer,
                items:             _cart.map(it => ({ id: it.id, qty: it.qty, piecePrice: it.piecePrice ?? null })),
                coupon_code:       _couponData?.coupon?.code || null,
                freight_cost:      _orderData.freight || 0,
                freight_service:   _orderData.freight_service || 'PAC',
                idempotency_key:   `checkout-${Date.now()}`
              })
            });

            const payment = await resp.json();

            if (payment.status === 'approved') {
              if (payment.amount) _orderData.total = payment.amount;
              await finalizeOrder(payment.id, 'aprovado');
            } else if (payment.status === 'in_process' || payment.status === 'pending') {
              if (payment.amount) _orderData.total = payment.amount;
              await finalizeOrder(payment.id, 'pendente');
              const msgEl = document.getElementById('co-payment-msg');
              if (msgEl) msgEl.textContent = 'Pagamento em análise. Você receberá a confirmação por e-mail em breve.';
            } else {
              toast('Pagamento recusado. Verifique os dados e tente novamente.');
              throw new Error(payment.status_detail || 'rejected');
            }
          } catch (err) {
            console.error('[payment submit]', err);
            throw err;
          }
        }
      }
    });
  } catch (err) {
    console.error('[MP init]', err);
    container.innerHTML = '<p style="color:#c0392b;text-align:center;padding:24px">Erro ao carregar pagamento. <a href="" style="color:inherit">Recarregue a página.</a></p>';
  }
}

// ── Finaliza pedido ───────────────────────────────────────────────────────────

async function finalizeOrder(paymentId, paymentStatus) {
  const order = { ..._orderData, payment_id: String(paymentId), payment_status: paymentStatus };

  const { data, error } = await Orders.create(order);

  if (error) {
    console.error('[orders.create]', error);
    toast('Pagamento aprovado, mas erro ao salvar pedido. Anote o número: ' + paymentId + ' e entre em contato.');
    return;
  }

  if (_mpBrick) { _mpBrick.unmount(); _mpBrick = null; }
  localStorage.removeItem('cf_cart');

  // Remove da carteirinha o cupom usado nesta compra
  const usedCoupon = _couponData?.coupon?.code;
  if (usedCoupon) {
    localStorage.setItem('cf_my_coupons', JSON.stringify(_myCoupons().filter(c => c.toUpperCase() !== usedCoupon.toUpperCase())));
    localStorage.removeItem('cf_selected_coupon');
  }

  const shortId = (data?.id || '').slice(0, 8).toUpperCase() || String(paymentId).slice(0, 8);
  document.getElementById('co-order-id').textContent = shortId;

  setStep(3);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  try { _cart = JSON.parse(localStorage.getItem('cf_cart') || '[]'); } catch { _cart = []; }
  if (!_cart.length) { window.location.href = 'index.html'; return; }

  // Pedido só com o produto de teste já entra sem frete
  if (_isTestOnlyCart()) {
    _freightFree        = true;
    _freightCost        = 0;
    _freightService     = 'PAC';
    _testFreightApplied = true;
  }

  renderSummary();

  // Ofertas "leve +1 peça e ganhe brinde"
  renderUpsell();
  startUpsellTimer();
  document.getElementById('co-upsell-row')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-upsell]');
    if (btn) addUpsellToCart(Number(btn.dataset.upsell));
  });

  // Cupons resgatados: renderiza chips e auto-aplica o selecionado no carrinho
  renderMyCoupons();
  const _selCoupon = localStorage.getItem('cf_selected_coupon');
  if (_selCoupon) {
    const inp = document.getElementById('co-coupon');
    if (inp) { inp.value = _selCoupon; applyCoupon(); }
  }
  document.getElementById('co-my-coupons')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-coupon]');
    if (!chip) return;
    const inp = document.getElementById('co-coupon');
    if (inp) { inp.value = chip.dataset.coupon; applyCoupon(); }
  });

  // CEP
  const cepInput = document.getElementById('co-cep');
  cepInput?.addEventListener('input', e => { e.target.value = maskCep(e.target.value); });
  cepInput?.addEventListener('blur',  e => lookupCep(e.target.value));

  // Seleção de modalidade de frete
  document.addEventListener('change', e => {
    if (e.target.name === 'freight') selectFreight(e.target.value);
  });

  // Máscaras
  document.getElementById('co-phone')?.addEventListener('input', e => { e.target.value = maskPhone(e.target.value); });
  document.getElementById('co-cpf')?.addEventListener('input',   e => { e.target.value = maskCPF(e.target.value); });

  // Cupom
  document.getElementById('co-coupon-btn')?.addEventListener('click', applyCoupon);
  document.getElementById('co-coupon')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } });

  // Form submit → vai para pagamento
  document.getElementById('checkout-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('co-continue-btn');
    btn.disabled    = true;
    btn.textContent = 'Aguarde…';
    await goToPayment();
    btn.disabled    = false;
    btn.textContent = 'Continuar para pagamento →';
  });

  // Botão voltar no step de pagamento
  document.getElementById('co-back-btn')?.addEventListener('click', () => {
    if (_mpBrick) { _mpBrick.unmount(); _mpBrick = null; }
    setStep(1);
  });
});
