/* checkout.js — Página de finalização de compra */

const MP_PUBLIC_KEY = 'TEST-1b7b738d-ab21-4446-87eb-90e8fc3af43d';
const BRL = n => 'R$ ' + Number(n).toFixed(2).replace('.', ',');

let _cart       = [];
let _couponData = null;
let _subtotal   = 0;
let _mpBrick    = null;
let _orderData  = null;
let _toastTimer = null;

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
  const total    = Math.max(0, _subtotal - discount);

  document.getElementById('co-subtotal').textContent = BRL(_subtotal);
  document.getElementById('co-total').textContent    = BRL(total);

  const discRow = document.getElementById('co-discount-row');
  if (discount > 0 && _couponData) {
    discRow.style.display = '';
    document.getElementById('co-coupon-label').textContent  = `(${_couponData.coupon.code})`;
    document.getElementById('co-discount-val').textContent  = '−' + BRL(discount);
  } else {
    discRow.style.display = 'none';
  }
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
    msgEl.className = 'co-coupon-msg ok';
    msgEl.textContent = `✓ Desconto de ${BRL(result.discount)} aplicado!`;
  } else {
    _couponData = null;
    msgEl.className = 'co-coupon-msg err';
    msgEl.textContent = result.msg;
  }
  updateTotals();
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
  return true;
}

// ── Avança para pagamento ─────────────────────────────────────────────────────

async function goToPayment() {
  if (!validateForm()) return;
  if (!_cart.length)   { toast('Seu carrinho está vazio.'); return; }

  const discount = _couponData?.discount || 0;
  const total    = Math.max(0, _subtotal - discount);

  _orderData = {
    customer_id:    null,
    customer_name:  document.getElementById('co-name').value.trim(),
    customer_email: document.getElementById('co-email').value.trim(),
    customer_phone: document.getElementById('co-phone').value.trim(),
    items: _cart.map(it => {
      const p = products.find(x => x.id === it.id);
      return { id: it.id, name: p?.name, image: p?.image, size: it.size, qty: it.qty, price: it.piecePrice ?? p?.price };
    }),
    subtotal: _subtotal, discount, total,
    coupon_code: _couponData?.coupon?.code || null,
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

  // Tenta preencher customer_id se usuário estiver logado
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
                amount,
                description:       'Compra Cor & Flor',
                idempotency_key:   `checkout-${Date.now()}`
              })
            });

            const payment = await resp.json();

            if (payment.status === 'approved') {
              await finalizeOrder(payment.id, 'aprovado');
            } else if (payment.status === 'in_process' || payment.status === 'pending') {
              await finalizeOrder(payment.id, 'pendente');
              const msgEl = document.getElementById('co-payment-msg');
              if (msgEl) msgEl.textContent = 'Pagamento em análise. Você receberá a confirmação por e-mail em breve.';
            } else {
              toast('Pagamento recusado. Verifique os dados e tente novamente.');
              throw new Error(payment.status_detail || 'rejected');
            }
          } catch (err) {
            console.error('[payment submit]', err);
            throw err; // devolve ao Brick para exibir mensagem de erro
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

  const shortId = (data?.id || '').slice(0, 8).toUpperCase() || String(paymentId).slice(0, 8);
  document.getElementById('co-order-id').textContent = shortId;

  setStep(3);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Carrega carrinho
  try { _cart = JSON.parse(localStorage.getItem('cf_cart') || '[]'); } catch { _cart = []; }
  if (!_cart.length) { window.location.href = 'index.html'; return; }

  renderSummary();

  // CEP
  const cepInput = document.getElementById('co-cep');
  cepInput?.addEventListener('input', e => { e.target.value = maskCep(e.target.value); });
  cepInput?.addEventListener('blur',  e => lookupCep(e.target.value));

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
    btn.disabled = true;
    btn.textContent = 'Aguarde…';
    await goToPayment();
    btn.disabled = false;
    btn.textContent = 'Continuar para pagamento →';
  });

  // Botão voltar no step de pagamento
  document.getElementById('co-back-btn')?.addEventListener('click', () => {
    if (_mpBrick) { _mpBrick.unmount(); _mpBrick = null; }
    setStep(1);
  });
});
