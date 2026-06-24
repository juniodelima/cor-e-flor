/* ========================================================
   COR & FLOR, interactions
======================================================== */

/* Se o usuário voltou pelo botão Voltar, remove o veil e exibe o hero imediatamente */
const _isBackNav = (performance.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward') ||
                   (performance.navigation?.type === 2);
if (_isBackNav) {
  const _v = document.getElementById('page-veil'); if (_v) _v.remove();
  const _h = document.querySelector('.hero'); if (_h) _h.classList.add('is-ready');
}

/* Sempre inicia no topo ao carregar/recarregar (não em navegação back/forward) */
if (!_isBackNav) {
  if (history.scrollRestoration) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
}

/* ---------- PRODUCT DATA ---------- */

const BRL = n => "R$ " + n.toFixed(2).replace(".", ",");

/* ---------- CATEGORY CAROUSELS ---------- */
const DISPLAY_CATS = [
  { key: 'conjuntos', label: 'Conjuntos',       eyebrow: 'CONJUNTOS & MACACÕES',
    test: p => /conjuntos|conjunto/i.test(p.category) },
  { key: 'blusas',    label: 'Blusas & Tops',   eyebrow: 'BLUSAS & TOPS',
    test: p => /blusas|blusa|regata|body/i.test(p.category) },
  { key: 'vestidos',  label: 'Vestidos & Saias', eyebrow: 'VESTIDOS & SAIAS',
    test: p => /vestidos|vestido|saia/i.test(p.category) },
  { key: 'calcas',    label: 'Calças & Shorts',  eyebrow: 'CALÇAS & SHORTS',
    test: p => /calcas|calça/i.test(p.category) },
  { key: 'blazers',   label: 'Blazers & Coletes', eyebrow: 'BLAZERS & COLETES',
    test: p => /blazers|blazer/i.test(p.category) },
];

function makeCard(p) {
  const badgeClass = p.badge === "SALE" ? "card__badge--sale"
                   : p.badge === "EXCLUSIVO" ? "card__badge--exclusive" : "";
  const badge   = p.badge ? `<span class="card__badge ${badgeClass}">${p.badge}</span>` : "";
  const was     = p.originalPrice ? `<span class="card__price-was">${BRL(p.originalPrice)}</span>` : "";
  const swatches = p.colors.map(c => `<span class="card__sw" style="background:${c.hex||c}"></span>`).join("");
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.id = p.id;
  el.innerHTML = `
    <div class="card__media">
      ${badge}
      <button class="card__fav" aria-label="Favoritar ${p.name}">
        <svg width="18" height="18"><use href="#i-heart"/></svg>
      </button>
      <img src="${p.image}" alt="${p.name}" loading="lazy"/>
      <button class="card__add" data-add="${p.id}"><svg width="14" height="14"><use href="#i-bag"/></svg> Adicionar</button>
    </div>
    <div class="card__body">
      <span class="card__cat">${p.category}</span>
      <h3 class="card__name"><a href="produto.html?id=${p.id}" style="color:inherit">${p.name}</a></h3>
      <div class="card__price">
        <span class="card__price-now">${BRL(p.price)}</span>
        ${was}
      </div>
      <div class="card__colors" aria-label="Cores disponíveis">${swatches}</div>
    </div>`;
  el.querySelector('.card__media').addEventListener('click', e => {
    if (!e.target.closest('button')) window.location.href = `produto.html?id=${p.id}`;
  });
  return el;
}

function initCarousel(block) {
  const track = block.querySelector('.carousel-track');
  const prev  = block.querySelector('.car-btn--prev');
  const next  = block.querySelector('.car-btn--next');
  const step  = () => (track.querySelector('.card')?.offsetWidth ?? 280) + 20;

  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left:  step(), behavior: 'smooth' }));

  const upd = () => {
    prev.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  };
  track.addEventListener('scroll', upd, { passive: true });
  upd();

  // arrastar com mouse (desktop)
  let dragging = false, sx = 0, ss = 0;
  track.addEventListener('mousedown',  e => { dragging = true; sx = e.clientX; ss = track.scrollLeft; track.style.cursor = 'grabbing'; e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (!dragging) return; track.scrollLeft = ss - (e.clientX - sx); });
  window.addEventListener('mouseup',   () => { dragging = false; track.style.cursor = ''; });

  // swipe touch
  let tx = 0;
  track.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const d = tx - e.changedTouches[0].clientX;
    if (Math.abs(d) > 40) track.scrollBy({ left: d > 0 ? step() : -step(), behavior: 'smooth' });
  }, { passive: true });
}

const catRoot = document.getElementById('categories-root');
DISPLAY_CATS.forEach(cat => {
  const items = products.filter(cat.test);
  if (!items.length) return;

  const block = document.createElement('div');
  block.className = 'cat-block';
  block.id = 'cat-' + cat.key;
  block.innerHTML = `
    <div class="cat-block__head">
      <div>
        <span class="sec-eyebrow">✦ ${cat.eyebrow}</span>
        <h2 class="cat-block__title">${cat.label}</h2>
      </div>
      <div class="car-nav">
        <a class="car-ver-mais" href="categoria.html?cat=${cat.key}">
          Ver todos <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-5-6 6 6-6 6"/></svg>
        </a>
        <button class="car-btn car-btn--prev" aria-label="Ver anteriores">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="car-btn car-btn--next" aria-label="Próximo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
    <div class="carousel-wrap">
      <div class="carousel-track" id="track-${cat.key}"></div>
    </div>`;

  const track = block.querySelector('.carousel-track');
  items.forEach(p => track.appendChild(makeCard(p)));
  catRoot.appendChild(block);
  initCarousel(block);
});

/* Scroll suave com offset do navbar para links de categoria */
document.querySelectorAll('a[href^="#cat-"], a[href^="#novidades"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 90;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* Favoritar + Carrinho (event delegation no root) */
catRoot.addEventListener('click', e => {
  const fav = e.target.closest('.card__fav');
  if (fav) {
    fav.classList.toggle('is-on');
    fav.querySelector('use').setAttribute('href', fav.classList.contains('is-on') ? '#i-heart-fill' : '#i-heart');
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) addToCart(parseInt(add.dataset.add, 10));
});


/* ---------- NAVBAR SCROLL STATE + PARALLAX ---------- */
const nav = document.getElementById("nav");
/* Parallax só no desktop — no mobile é pesado e causa travamento */
const isMobile = window.matchMedia("(max-width: 768px) or (hover: none)").matches;
const parallaxEls = isMobile ? [] : document.querySelectorAll("[data-parallax], .hs-img");
let rafPending = false;

const onScroll = () => {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    nav.classList.toggle("is-scrolled", window.scrollY > 80);
    parallaxEls.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed * -1;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
    rafPending = false;
  });
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- VÍDEOS: play/pause via IntersectionObserver (não baixa sem estar visível) ---------- */
const videoObserver = new IntersectionObserver((entries) => {
  entries.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) {
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
    }
  });
}, { threshold: 0.25 });

document.querySelectorAll("video[data-autoplay]").forEach(v => videoObserver.observe(v));


/* ---------- PAGE LOAD VEIL + HERO ANIM ---------- */
let _veilDone = _isBackNav;
function _hideVeil(instant) {
  if (_veilDone) return;
  _veilDone = true;
  const veil = document.getElementById("page-veil");
  const hero = document.querySelector(".hero");
  if (hero) hero.classList.add("is-ready");
  if (!veil) return;
  if (instant) { veil.remove(); return; }
  veil.classList.add("is-out");
  setTimeout(() => { const v = document.getElementById("page-veil"); if (v) v.remove(); }, 600);
}
/* DOM pronto → sumir em 250ms (não espera imagens) */
document.addEventListener("DOMContentLoaded", () => setTimeout(_hideVeil, 250));
/* Backup: se window.load vier antes (improvável) */
window.addEventListener("load", () => _hideVeil(false));
/* Volta via botão Voltar: não mostra veil, page já está carregada */
window.addEventListener("pageshow", (e) => { if (e.persisted) _hideVeil(true); });
/* Fallback: garante que o hero fica visível mesmo se o veil falhar */
setTimeout(() => { const h = document.querySelector(".hero"); if (h && !h.classList.contains("is-ready")) h.classList.add("is-ready"); }, 800);


/* ---------- HERO SLIDER (automático + swipe) ---------- */
(function () {
  const bgs   = document.querySelectorAll(".hs-bg");
  const conts = document.querySelectorAll(".hs-content");
  const dots  = document.querySelectorAll(".hs-dot");
  const hero  = document.querySelector(".hero");
  if (!bgs.length) return;

  let cur = 0, timer;

  function go(n) {
    bgs[cur].classList.remove("active");
    conts[cur].classList.remove("active");
    dots[cur].classList.remove("active");
    cur = ((n % bgs.length) + bgs.length) % bgs.length;
    bgs[cur].classList.add("active");
    conts[cur].classList.add("active");
    dots[cur].classList.add("active");
    clearInterval(timer);
    timer = setInterval(() => go(cur + 1), 6000);
  }

  // Dots
  dots.forEach((d, i) => d.addEventListener("click", () => go(i)));

  // Swipe (mobile)
  let touchX = 0;
  hero?.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  hero?.addEventListener("touchend",   e => {
    const diff = touchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 48) go(diff > 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  // Auto
  timer = setInterval(() => go(cur + 1), 6000);
})();


/* ---------- INTERSECTION OBSERVER REVEALS ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.classList.add("is-in");
      io.unobserve(en.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));


/* ---------- MOBILE MENU ---------- */
const burger = document.getElementById("burger");
const mmenu  = document.getElementById("mmenu");
const mclose = document.getElementById("mmenu-close");
burger.addEventListener("click", () => { mmenu.classList.add("is-open"); mmenu.setAttribute("aria-hidden", "false"); });
mclose.addEventListener("click", () => { mmenu.classList.remove("is-open"); mmenu.setAttribute("aria-hidden", "true"); });
mmenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  mmenu.classList.remove("is-open");
}));


/* ---------- DEPOIMENTOS CARROSSEL ---------- */
const slides = document.querySelectorAll(".quote");
const dots   = document.querySelectorAll("#quotes-dots .dot");
let q = 0;
const showQuote = i => {
  slides.forEach((s, k) => s.classList.toggle("is-active", k === i));
  dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
  q = i;
};
dots.forEach((d, i) => d.addEventListener("click", () => showQuote(i)));
setInterval(() => showQuote((q + 1) % slides.length), 5000);


/* ---------- CART ---------- */
const cart = document.getElementById("cart");
const cartVeil = document.getElementById("cart-veil");
const cartList = document.getElementById("cart-list");
const cartCount = document.getElementById("cart-count");
const cartHeadCount = document.getElementById("cart-head-count");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartTotal    = document.getElementById("cart-total");
const cartBanner   = document.querySelector(".cart__banner");
const FRETE_FREE_MIN = 299;

// Carrega do localStorage ou inicia vazio (não seed)
let cartState = JSON.parse(localStorage.getItem('cf_cart') || '[]');

function renderCart() {
  localStorage.setItem('cf_cart', JSON.stringify(cartState));
  cartList.innerHTML = "";
  let subtotal = 0;
  let count = 0;

  cartState.forEach((it, idx) => {
    const p = products.find(x => x.id === it.id);
    if (!p) return;
    subtotal += p.price * it.qty;
    count += it.qty;

    const li = document.createElement("li");
    li.className = "cart__item";
    li.innerHTML = `
      <div class="cart__item-img">
        <button class="cart__item-img-x" data-remove="${idx}" aria-label="Remover">×</button>
        <img src="${p.image}" alt="${p.name}"/>
      </div>
      <div class="cart__item-body">
        <h4 class="cart__item-name">${p.name}</h4>
        <span class="cart__item-size">Tamanho ${it.size}</span>
        <div class="cart__qty">
          <button data-q="-1" data-i="${idx}" aria-label="Diminuir"><svg width="14" height="14"><use href="#i-minus"/></svg></button>
          <span>${it.qty}</span>
          <button data-q="1" data-i="${idx}" aria-label="Aumentar"><svg width="14" height="14"><use href="#i-plus"/></svg></button>
        </div>
      </div>
      <div class="cart__item-price">${BRL(p.price * it.qty)}</div>
    `;
    cartList.appendChild(li);
  });

  if (cartState.length === 0){
    cartList.innerHTML = `<li style="text-align:center;padding:60px 20px;color:var(--warm-gray);font-family:var(--serif);font-style:italic;">Seu jardim está vazio. ✿<br><span style="font-size:13px;font-family:var(--sans);font-style:normal;">Adicione peças que façam você florescer.</span></li>`;
  }

  cartCount.textContent = count;
  cartHeadCount.textContent = `(${count})`;
  cartSubtotal.textContent = BRL(subtotal);
  cartTotal.textContent = BRL(subtotal);

  const missing = Math.max(0, FRETE_FREE_MIN - subtotal);
  cartBanner.innerHTML = missing > 0
    ? `<span>✿</span> Falta <strong>${BRL(missing)}</strong> para frete grátis!`
    : `<span>✿</span> <strong>Você ganhou frete grátis!</strong> 💌`;
}
renderCart();

document.getElementById("open-cart").addEventListener("click", openCart);
document.getElementById("close-cart").addEventListener("click", closeCart);
document.getElementById("cart-continue").addEventListener("click", closeCart);
cartVeil.addEventListener("click", closeCart);
function openCart(){ cart.classList.add("is-open"); cartVeil.classList.add("is-open"); cart.setAttribute("aria-hidden","false"); document.body.style.overflow = "hidden"; }
function closeCart(){ cart.classList.remove("is-open"); cartVeil.classList.remove("is-open"); cart.setAttribute("aria-hidden","true"); document.body.style.overflow = ""; }

cartList.addEventListener("click", e => {
  const q = e.target.closest("[data-q]");
  if (q){
    const i = parseInt(q.dataset.i, 10);
    const d = parseInt(q.dataset.q, 10);
    cartState[i].qty = Math.max(0, cartState[i].qty + d);
    if (cartState[i].qty === 0) cartState.splice(i, 1);
    renderCart();
    return;
  }
  const r = e.target.closest("[data-remove]");
  if (r){
    cartState.splice(parseInt(r.dataset.remove,10), 1);
    renderCart();
  }
});

function addToCart(id){
  const p = products.find(x => x.id === id);
  if (!p) return;
  const existing = cartState.find(x => x.id === id);
  if (existing) existing.qty += 1;
  else cartState.push({ id, qty: 1, size: p.sizes[0] || 'Único', color: p.colors[0]?.hex || p.colors[0] || '' });
  renderCart();
  toast(`✿ ${p.name} entrou no seu jardim`);
  // bump bag icon
  const ic = document.querySelector("#open-cart");
  ic.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "cubic-bezier(.25,.46,.45,.94)" }
  );
}


/* ---------- TOAST ---------- */
const toastEl = document.getElementById("toast");
let toastT;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("is-show"), 2400);
}


/* Cursor padrão do sistema */


/* ================================================================
   SUPABASE — Auth, Newsletter, Checkout, Favoritos
================================================================ */

/* --- Botão favoritos na navbar → conta.html#favoritos --- */
document.getElementById('open-favs')?.addEventListener('click', () => {
  if (_currentUser) {
    window.location.href = 'conta.html#favoritos';
  } else {
    openAuthModal();
    toast('Entre na sua conta para ver seus favoritos ✿');
  }
});

/* --- Estado global do usuário --- */
let _currentUser = null;
let _sbFavs = [];

/* Inicializa auth: ouuve mudanças de sessão */
if (typeof Auth !== 'undefined') {
  Auth.onChange(async (_event, session) => {
    _currentUser = session?.user || null;
    _updateNavUser();
    if (_currentUser) await _syncFavorites();
  });

  /* Carrega sessão atual */
  Auth.user().then(u => {
    _currentUser = u;
    _updateNavUser();
    if (u) _syncFavorites();
  });
}

function _updateNavUser() {
  const nameEl  = document.getElementById('nav-user-name');
  const loggedDiv  = document.getElementById('auth-logged');
  const loginForm  = document.getElementById('auth-form-login');
  const signupForm = document.getElementById('auth-form-signup');
  const tabsEl     = document.querySelector('.auth-modal__tabs');

  if (_currentUser) {
    const name = _currentUser.user_metadata?.name || _currentUser.email.split('@')[0];
    if (nameEl) { nameEl.textContent = name.split(' ')[0]; nameEl.style.display = 'block'; }
    document.getElementById('auth-user-name').textContent = name.split(' ')[0];
    if (loggedDiv)  loggedDiv.style.display  = 'block';
    if (loginForm)  loginForm.style.display  = 'none';
    if (signupForm) signupForm.style.display = 'none';
    if (tabsEl)     tabsEl.style.display     = 'none';
  } else {
    if (nameEl) nameEl.style.display = 'none';
    if (loggedDiv)  loggedDiv.style.display  = 'none';
    if (loginForm)  loginForm.style.display  = 'block';
    if (signupForm) signupForm.style.display = 'none';
    if (tabsEl)     tabsEl.style.display     = 'flex';
  }
}


/* ---- Auth Modal ---- */
function openAuthModal()  { document.getElementById('auth-modal').classList.add('is-open');     document.getElementById('auth-veil').classList.add('is-open');     document.body.style.overflow = 'hidden'; }
function closeAuthModal() { document.getElementById('auth-modal').classList.remove('is-open');  document.getElementById('auth-veil').classList.remove('is-open');  document.body.style.overflow = ''; }

document.getElementById('open-auth')?.addEventListener('click', openAuthModal);
document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);
document.getElementById('auth-veil')?.addEventListener('click', closeAuthModal);

/* Tabs login / signup */
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const tab = btn.dataset.tab;
    document.getElementById('auth-form-login').style.display  = tab === 'login'  ? 'block' : 'none';
    document.getElementById('auth-form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  });
});

/* Login */
document.getElementById('auth-form-login')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('auth-login-btn');
  const errEl = document.getElementById('auth-err-login');
  btn.textContent = 'Entrando…'; btn.disabled = true;
  const { error } = await Auth.login(document.getElementById('a-email').value, document.getElementById('a-pw').value);
  btn.textContent = 'Entrar'; btn.disabled = false;
  if (error) { errEl.textContent = 'E-mail ou senha incorretos.'; errEl.classList.add('show'); }
  else { errEl.classList.remove('show'); closeAuthModal(); toast('Bem-vinda de volta! ✿'); }
});

/* Cadastro */
document.getElementById('auth-form-signup')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('auth-signup-btn');
  const errEl = document.getElementById('auth-err-signup');
  btn.textContent = 'Criando…'; btn.disabled = true;
  const { error } = await Auth.signup(
    document.getElementById('a-email2').value,
    document.getElementById('a-pw2').value,
    document.getElementById('a-name').value
  );
  btn.textContent = 'Criar minha conta'; btn.disabled = false;
  if (error) { errEl.textContent = error.message; errEl.classList.add('show'); }
  else { errEl.classList.remove('show'); closeAuthModal(); toast('Conta criada! Confirme seu e-mail ✿'); }
});

/* Logout */
document.getElementById('auth-logout-btn')?.addEventListener('click', async () => {
  await Auth.logout(); closeAuthModal(); toast('Até logo! ✿');
});

/* Esqueci senha */
document.getElementById('auth-forgot-btn')?.addEventListener('click', async () => {
  const email = document.getElementById('a-email').value;
  if (!email) { document.getElementById('auth-err-login').textContent = 'Digite seu e-mail primeiro.'; document.getElementById('auth-err-login').classList.add('show'); return; }
  await Auth.resetPw(email);
  toast('E-mail de recuperação enviado ✿');
  closeAuthModal();
});


/* ---- Favoritos sincronizados com Supabase ---- */
async function _syncFavorites() {
  if (!_currentUser || typeof Favorites === 'undefined') return;
  const remote = await Favorites.getAll(_currentUser.id);
  remote.forEach(pid => {
    document.querySelectorAll(`.card__fav[data-id="${pid}"], .card[data-id="${pid}"] .card__fav`).forEach(btn => {
      btn.classList.add('is-on');
      btn.querySelector('use')?.setAttribute('href', '#i-heart-fill');
    });
  });
  _sbFavs = remote;
}

/* Intercepta clique nos favoritos para sincronizar */
document.getElementById('categories-root')?.addEventListener('click', async e => {
  const btn = e.target.closest('.card__fav');
  if (!btn || !_currentUser || typeof Favorites === 'undefined') return;
  const card = btn.closest('.card');
  if (!card) return;
  const pid = parseInt(card.dataset.id, 10);
  const isOn = btn.classList.contains('is-on');
  if (isOn) { await Favorites.remove(_currentUser.id, pid); _sbFavs = _sbFavs.filter(x => x !== pid); }
  else       { await Favorites.add(_currentUser.id, pid);    _sbFavs.push(pid); }
}, true);


/* ---- Newsletter → Supabase ---- */
document.getElementById('newsletter-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn   = document.getElementById('newsletter-btn');
  const email = document.getElementById('newsletter-email').value;
  btn.textContent = 'Salvando…'; btn.disabled = true;
  const { error } = await Newsletter.subscribe(email);
  btn.disabled = false;
  if (error && error.code === '23505') { btn.textContent = 'Já cadastrada ✿'; }
  else if (error) { btn.textContent = 'Erro, tente novamente'; }
  else { btn.textContent = 'Bem-vinda ao jardim ✿'; document.getElementById('newsletter-email').value = ''; }
});


/* ---- Checkout Modal ---- */
let _couponData    = null;
let _checkoutOrder = null; // dados do pedido coletados no step 1
let _mpBrick       = null; // instância do Brick MP

const MP_PUBLIC_KEY = 'APP_USR-51ce84d0-ae1e-4a0a-b010-0fe696012fc6';

function openCheckout() {
  _renderCheckoutItems();
  document.getElementById('checkout-step-form').style.display    = 'block';
  const payStep = document.getElementById('checkout-step-payment');
  if (payStep) payStep.style.display = 'none';
  document.getElementById('checkout-step-ok').style.display      = 'none';
  document.getElementById('checkout-modal').classList.add('is-open');
  document.getElementById('checkout-veil').classList.add('is-open');
  document.body.style.overflow = 'hidden';

  if (_currentUser) {
    const n = _currentUser.user_metadata?.name || '';
    const emailInput = document.getElementById('co-email');
    if (emailInput && !emailInput.value) emailInput.value = _currentUser.email;
    const nameInput = document.getElementById('co-name');
    if (nameInput && !nameInput.value) nameInput.value = n;
  }
}

function closeCheckout() {
  document.getElementById('checkout-modal').classList.remove('is-open');
  document.getElementById('checkout-veil').classList.remove('is-open');
  document.body.style.overflow = '';
  if (_mpBrick) { _mpBrick.unmount(); _mpBrick = null; }
}

document.querySelector('.cart__cta')?.addEventListener('click', () => {
  if (!cartState.length) { toast('Seu carrinho está vazio ✿'); return; }
  window.location.href = 'checkout.html';
});
document.getElementById('checkout-close')?.addEventListener('click', closeCheckout);
document.getElementById('checkout-veil')?.addEventListener('click', closeCheckout);
document.getElementById('checkout-ok-btn')?.addEventListener('click', () => { closeCheckout(); });

function _renderCheckoutItems() {
  const list = document.getElementById('checkout-items');
  if (!list) return;
  list.innerHTML = '';
  let subtotal = 0;
  cartState.forEach(it => {
    const p = products.find(x => x.id === it.id);
    if (!p) return;
    const price = it.piecePrice ?? p.price;
    subtotal += price * it.qty;
    const li = document.createElement('li');
    li.innerHTML = `
      <img src="${p.image}" alt="${p.name}" loading="lazy"/>
      <div class="checkout-item-info">
        <strong>${p.name}</strong>
        <span>${it.size}${it.pieceName ? ' · ' + it.pieceName : ''} × ${it.qty}</span>
      </div>
      <span class="checkout-item-price">${BRL(price * it.qty)}</span>`;
    list.appendChild(li);
  });
  _updateCheckoutTotals(subtotal);
}

function _updateCheckoutTotals(subtotal) {
  const discount = _couponData ? _couponData.discount : 0;
  const total    = subtotal - discount;
  document.getElementById('co-subtotal').textContent = BRL(subtotal);
  document.getElementById('co-total').textContent    = BRL(total);
  const dRow = document.getElementById('co-discount-row');
  if (discount > 0 && dRow) {
    dRow.style.display = 'flex';
    document.getElementById('co-coupon-label').textContent = `(${_couponData.coupon.code})`;
    document.getElementById('co-discount-val').textContent = `- ${BRL(discount)}`;
  } else if (dRow) { dRow.style.display = 'none'; }
}

/* CEP auto-fill via ViaCEP */
document.getElementById('co-cep')?.addEventListener('blur', async () => {
  const cep = document.getElementById('co-cep').value.replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) return;
    document.getElementById('co-rua').value    = d.logradouro;
    document.getElementById('co-bairro').value = d.bairro;
    document.getElementById('co-cidade').value = d.localidade;
    document.getElementById('co-estado').value = d.uf;
    document.getElementById('co-num').focus();
  } catch {}
});

/* Máscara CEP */
document.getElementById('co-cep')?.addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g,'');
  if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5,8);
  e.target.value = v;
});

/* Cupom */
document.getElementById('co-coupon-btn')?.addEventListener('click', async () => {
  const code = document.getElementById('co-coupon').value;
  const msgEl = document.getElementById('co-coupon-msg');
  if (!code) return;
  let subtotal = cartState.reduce((s, it) => s + (it.piecePrice ?? (products.find(x => x.id === it.id)?.price ?? 0)) * it.qty, 0);
  if (typeof Coupons === 'undefined') return;
  const result = await Coupons.validate(code, subtotal);
  if (result.ok) {
    _couponData = result;
    msgEl.textContent = `Cupom aplicado! Desconto de ${BRL(result.discount)} ✿`;
    msgEl.className = 'coupon-msg ok';
  } else {
    _couponData = null;
    msgEl.textContent = result.msg;
    msgEl.className = 'coupon-msg err';
  }
  _updateCheckoutTotals(subtotal);
});

/* Step 1 → coleta dados e avança para pagamento */
document.getElementById('checkout-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('checkout-confirm-btn');
  btn.textContent = 'Aguarde…'; btn.disabled = true;

  const subtotal = cartState.reduce((s, it) => {
    const p = products.find(x => x.id === it.id);
    return s + (it.piecePrice ?? p?.price ?? 0) * it.qty;
  }, 0);
  const discount = _couponData?.discount || 0;
  const total    = subtotal - discount;

  _checkoutOrder = {
    customer_id:    _currentUser?.id || null,
    customer_name:  document.getElementById('co-name').value,
    customer_email: document.getElementById('co-email').value,
    customer_phone: document.getElementById('co-phone').value,
    items: cartState.map(it => {
      const p = products.find(x => x.id === it.id);
      return { id: it.id, name: p?.name, image: p?.image, size: it.size, piece: it.pieceName || null, qty: it.qty, price: it.piecePrice ?? p?.price };
    }),
    subtotal, discount, total,
    coupon_code: _couponData?.coupon?.code || null,
    address: {
      cep:    document.getElementById('co-cep').value,
      rua:    document.getElementById('co-rua').value,
      num:    document.getElementById('co-num').value,
      comp:   document.getElementById('co-comp').value,
      bairro: document.getElementById('co-bairro').value,
      cidade: document.getElementById('co-cidade').value,
      estado: document.getElementById('co-estado').value,
    },
    notes: document.getElementById('co-notes').value || null,
  };

  btn.textContent = 'Continuar para pagamento'; btn.disabled = false;

  // Avança para step de pagamento
  document.getElementById('checkout-step-form').style.display    = 'none';
  document.getElementById('checkout-step-payment').style.display = 'block';

  // Resumo no topo do step de pagamento
  const summary = document.getElementById('checkout-payment-summary');
  if (summary) summary.innerHTML = `<p>${_checkoutOrder.items.length} item(s) · Total: <strong>${BRL(total)}</strong></p>`;

  // Inicializa o Brick do MP
  await _initMPBrick(total, _checkoutOrder.customer_email);
});

/* Voltar para step 1 */
document.getElementById('checkout-back-btn')?.addEventListener('click', () => {
  if (_mpBrick) { _mpBrick.unmount(); _mpBrick = null; }
  document.getElementById('checkout-step-payment').style.display = 'none';
  document.getElementById('checkout-step-form').style.display    = 'block';
});

function _loadMPSdk() {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago'));
    document.head.appendChild(s);
  });
}

async function _initMPBrick(amount, email) {
  const container = document.getElementById('mp-brick-container');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--warm-gray)">Carregando pagamento…</p>';

  try {
    await _loadMPSdk();
    const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    const builder = mp.bricks();
    _mpBrick = await builder.create('cardPayment', 'mp-brick-container', {
      initialization: {
        amount,
        payer: { email }
      },
      customization: {
        paymentMethods: { minInstallments: 1, maxInstallments: 12 },
        visual: { hideFormTitle: true, hidePaymentButton: false }
      },
      callbacks: {
        onReady: () => {},
        onError: (err) => {
          console.error('[MP Brick]', err);
          toast('Erro ao carregar formulário de pagamento. Recarregue a página.');
        },
        onSubmit: async (formData) => {
          try {
            const resp = await fetch('/api/payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token:              formData.token,
                payment_method_id:  formData.payment_method_id,
                issuer_id:          formData.issuer_id,
                installments:       formData.installments,
                payer:              formData.payer,
                amount,
                description:        'Compra Cor & Flor',
                idempotency_key:    `order-${Date.now()}`
              })
            });
            const payment = await resp.json();

            if (payment.status === 'approved') {
              await _finalizarPedido(payment.id, 'aprovado');
            } else if (payment.status === 'in_process' || payment.status === 'pending') {
              await _finalizarPedido(payment.id, 'pendente');
              document.getElementById('checkout-ok-msg').textContent = 'Pagamento em análise. Você receberá a confirmação por e-mail.';
            } else {
              toast('Pagamento recusado. Verifique os dados do cartão e tente novamente.');
              throw new Error(payment.status_detail);
            }
          } catch (err) {
            console.error('[payment submit]', err);
            throw err; // devolve o erro para o Brick mostrar mensagem
          }
        }
      }
    });
  } catch (err) {
    console.error('[MP init]', err);
    container.innerHTML = '<p style="color:red;text-align:center;padding:20px">Erro ao carregar pagamento. Tente novamente.</p>';
  }
}

async function _finalizarPedido(paymentId, paymentStatus) {
  const order = { ..._checkoutOrder, payment_id: paymentId, payment_status: paymentStatus };
  const { data, error } = await Orders.create(order);

  if (error) { toast('Pagamento aprovado, mas erro ao salvar pedido. Entre em contato.'); console.error(error); return; }

  if (_mpBrick) { _mpBrick.unmount(); _mpBrick = null; }
  cartState = [];
  renderCart();
  _couponData    = null;
  _checkoutOrder = null;

  document.getElementById('checkout-step-payment').style.display = 'none';
  document.getElementById('checkout-step-ok').style.display      = 'block';
  document.getElementById('checkout-order-id').textContent = data.id.slice(0,8).toUpperCase();
}
