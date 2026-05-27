/* ========================================================
   COR & FLOR — interactions
======================================================== */

/* ---------- PRODUCT DATA ---------- */
const products = [
  { id: 1, name: "Blusa Drapeado Sereno", category: "Blusa", price: 129, originalPrice: 199.90, badge: "SALE",
    image: "assets/p-blusa-azul.png",
    colors: ["#9CAEB8"], sizes: ["36","42"] },
  { id: 2, name: "Vestido Citrus", category: "Vestido Midi", price: 149, originalPrice: null, badge: "NOVO",
    image: "assets/p-vestido-laranja.png",
    colors: ["#F4A05B"], sizes: ["P","M","G"] },
  { id: 3, name: "Conjunto Rosé", category: "Conjunto Cropped", price: 259, originalPrice: null, badge: "NOVO",
    image: "assets/p-conjunto-rosa.png",
    colors: ["#E29AB0"], sizes: ["36","38","40","42"] },
  { id: 4, name: "Body Bronze", category: "Body Drapeado", price: 199, originalPrice: null, badge: "EXCLUSIVO",
    image: "assets/p-body-marrom.png",
    colors: ["#7A4234"], sizes: ["P"] },
  { id: 5, name: "Saia Cetim Lua", category: "Saia Longa", price: 239, originalPrice: null, badge: null,
    image: "assets/p-saia-cetim.png",
    colors: ["#C9CACE"], sizes: ["36"] },
  { id: 6, name: "Blazer Camélia", category: "Blazer", price: 379, originalPrice: null, badge: "NOVO",
    image: "assets/p-blazer-caqui.png",
    colors: ["#8C7350"], sizes: ["40","42"] },
  { id: 7, name: "Regata Pérola", category: "Regata Cetim", price: 89, originalPrice: 139.90, badge: "SALE",
    image: "assets/p-regata-branca.png",
    colors: ["#F5F2EC"], sizes: ["42"] }
];

const BRL = n => "R$ " + n.toFixed(2).replace(".", ",");

/* ---------- RENDER PRODUCT GRID ---------- */
const grid = document.getElementById("news-grid");
products.forEach((p, i) => {
  const badgeClass = p.badge === "SALE" ? "card__badge--sale"
                    : p.badge === "EXCLUSIVO" ? "card__badge--exclusive" : "";
  const badge = p.badge ? `<span class="card__badge ${badgeClass}">${p.badge}</span>` : "";
  const was = p.originalPrice ? `<span class="card__price-was">${BRL(p.originalPrice)}</span>` : "";
  const swatches = p.colors.map(c => `<span class="card__sw" style="background:${c}"></span>`).join("");
  const delay = (i % 4) * 100;

  const el = document.createElement("article");
  el.className = "card reveal";
  el.style.transitionDelay = `${delay}ms`;
  el.dataset.id = p.id;
  el.innerHTML = `
    <div class="card__media">
      ${badge}
      <button class="card__fav" aria-label="Favoritar ${p.name}">
        <svg width="18" height="18"><use href="#i-heart"/></svg>
      </button>
      <img src="${p.image}" alt="${p.name}" loading="lazy"/>
      <button class="card__add" data-add="${p.id}">+ Adicionar ao carrinho</button>
    </div>
    <div class="card__body">
      <span class="card__cat">${p.category}</span>
      <h3 class="card__name">${p.name}</h3>
      <div class="card__price">
        <span class="card__price-now">${BRL(p.price)}</span>
        ${was}
      </div>
      <div class="card__colors" aria-label="Cores disponíveis">${swatches}</div>
    </div>
  `;
  grid.appendChild(el);
});

/* Favoritar */
grid.addEventListener("click", e => {
  const fav = e.target.closest(".card__fav");
  if (fav) {
    fav.classList.toggle("is-on");
    const svg = fav.querySelector("use");
    svg.setAttribute("href", fav.classList.contains("is-on") ? "#i-heart-fill" : "#i-heart");
    return;
  }
  const add = e.target.closest("[data-add]");
  if (add) {
    const id = parseInt(add.dataset.add, 10);
    addToCart(id);
  }
});


/* ---------- NAVBAR SCROLL STATE ---------- */
const nav = document.getElementById("nav");
const onScroll = () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 80);
  // parallax
  document.querySelectorAll("[data-parallax]").forEach(el => {
    const speed = parseFloat(el.dataset.parallax);
    const rect = el.getBoundingClientRect();
    const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed * -1;
    el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  });
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();


/* ---------- PAGE LOAD VEIL + HERO ANIM ---------- */
window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("page-veil").classList.add("is-out");
    document.querySelector(".hero").classList.add("is-ready");
  }, 350);
  setTimeout(() => {
    document.getElementById("page-veil").remove();
  }, 1900);
});


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

// seed cart with 3 items (matches default count)
let cartState = [
  { id: 1, qty: 1, size: "36" },   // Blusa azul
  { id: 5, qty: 1, size: "36" },   // Saia cetim
  { id: 7, qty: 1, size: "42" }    // Regata
];

function renderCart() {
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
  const existing = cartState.find(x => x.id === id);
  if (existing) existing.qty += 1;
  else cartState.push({ id, qty: 1, size: p.sizes[1] || p.sizes[0] });
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


/* ---------- CUSTOM CURSOR ---------- */
const cursor = document.getElementById("cursor");
if (window.matchMedia("(hover:hover) and (pointer:fine)").matches){
  let x = 0, y = 0, cx = 0, cy = 0;
  window.addEventListener("mousemove", e => { x = e.clientX; y = e.clientY; });
  const tick = () => {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(tick);
  };
  tick();
  document.querySelectorAll("a, button, .card").forEach(el => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
  });
}
