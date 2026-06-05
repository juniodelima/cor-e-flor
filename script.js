/* ========================================================
   COR & FLOR, interactions
======================================================== */

/* Sempre inicia no topo ao carregar/recarregar */
if (history.scrollRestoration) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

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
let _veilDone = false;
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


