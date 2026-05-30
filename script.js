/* ========================================================
   COR & FLOR — interactions
======================================================== */

/* ---------- PRODUCT DATA ---------- */
const products = [
  { id: 1, name: "Blusa Drapeado Sereno", category: "Blusa", price: 129, originalPrice: 199.90, badge: "SALE",
    image: "assets/p-blusa-azul.png",
    colors: [{ name: "Azul Sereno", hex: "#9CAEB8" }],
    sizes: ["36","42"],
    description: "Blusa de tecido fluido com drapeado assimétrico que valoriza o corpo com suavidade. Ideal para compor looks do dia a dia com elegância descomplicada.",
    material: "96% viscose, 4% elastano. Tecido leve, fluido e de toque macio. Não amassa.",
    care: "Lavar à mão ou na máquina em ciclo delicado, água fria. Não torcer. Secar à sombra na horizontal.",
    fit: "Modelagem solta com queda suave. Veste bem nos tamanhos 34 ao 42. A modelo usa tamanho 36."
  },
  { id: 2, name: "Vestido Citrus", category: "Vestido Midi", price: 149, originalPrice: null, badge: "NOVO",
    image: "assets/p-vestido-laranja.png",
    colors: [{ name: "Laranja Citrus", hex: "#F4A05B" }, { name: "Rosa Claro", hex: "#F4C9D8" }],
    sizes: ["P","M","G"],
    description: "Vestido midi vibrante em tom citrus, com caimento elegante e corte que valoriza a silhueta. Uma peça que transforma qualquer dia em celebração.",
    material: "100% algodão com fio egípcio. Tecido respirável, macio e de alta durabilidade.",
    care: "Lavar na máquina em ciclo delicado com água fria. Passar com ferro morno pelo avesso.",
    fit: "Modelagem ajustada no busto com saia evazê. Para um caimento soltinho, suba um tamanho."
  },
  { id: 3, name: "Conjunto Rosé", category: "Conjunto Cropped", price: 259, originalPrice: null, badge: "NOVO",
    image: "assets/p-conjunto-rosa.png",
    colors: [{ name: "Rosé", hex: "#E29AB0" }, { name: "Nude", hex: "#F9EFF0" }],
    sizes: ["36","38","40","42"],
    description: "Conjunto cropped + calça pantalona em tecido de malha rosé. Peças vendidas juntas que combinam conforto e sofisticação em harmonia perfeita.",
    material: "85% poliéster, 15% elastano. Malha de alta compressão com brilho acetinado.",
    care: "Lavar à mão com sabão neutro. Não usar amaciante. Secar à sombra.",
    fit: "Cropped com ajuste abaixo do busto. Calça modelagem slim de cintura alta. Segue tabela padrão."
  },
  { id: 4, name: "Body Bronze", category: "Body Drapeado", price: 199, originalPrice: null, badge: "EXCLUSIVO",
    image: "assets/p-body-marrom.png",
    colors: [{ name: "Bronze Escuro", hex: "#7A4234" }, { name: "Caramelo", hex: "#C4956A" }],
    sizes: ["P"],
    description: "Body drapeado em tom bronze com abertura profunda nas costas. Peça exclusiva que exige atitude — para noites que ficam na memória.",
    material: "78% nylon, 22% elastano. Tecido com compressão suave e acabamento fosco premium.",
    care: "Lavar somente à mão com água fria e sabonete neutro. Secar sobre superfície plana.",
    fit: "Modelagem colada ao corpo. Recomendamos medir busto e quadril antes de escolher. Disponível em tamanho P."
  },
  { id: 5, name: "Saia Cetim Lua", category: "Saia Longa", price: 239, originalPrice: null, badge: null,
    image: "assets/p-saia-cetim.png",
    colors: [{ name: "Prata Lua", hex: "#C9CACE" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["36","38","40"],
    description: "Saia longa de cetim com reflexos suaves que evocam o brilho da lua. Fluida, elegante e atemporal — a peça-chave de um guarda-roupa consciente.",
    material: "100% poliéster cetinado de gramatura alta. Forro interno em chiffon.",
    care: "Lavar na máquina em ciclo delicado. Passar com ferro a vapor pelo avesso em temperatura média.",
    fit: "Cós elástico para conforto máximo. Comprimento midi até o tornozelo (aprox. 90cm). Para corpos mais altos, considere um tamanho acima."
  },
  { id: 6, name: "Blazer Camélia", category: "Blazer", price: 379, originalPrice: null, badge: "NOVO",
    image: "assets/p-blazer-caqui.png",
    colors: [{ name: "Caqui Camélia", hex: "#8C7350" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["38","40","42"],
    description: "Blazer estruturado em tweed misto com botões dourados e lapela clássica. Transita do trabalho à noite com elegância natural e sem esforço.",
    material: "60% lã, 35% poliéster, 5% elastano. Forro de seda sintética. Botões em metal dourado.",
    care: "Limpeza a seco recomendada. Para lavagem em casa, ciclo delicado em água fria com cuidado extra na estrutura dos ombros.",
    fit: "Modelagem slim com ombros levemente estruturados. Caimento alinhado ao corpo. Comprimento no quadril."
  },
  { id: 7, name: "Regata Pérola", category: "Regata Cetim", price: 89, originalPrice: 139.90, badge: "SALE",
    image: "assets/p-regata-branca.png",
    colors: [{ name: "Pérola", hex: "#F5F2EC" }, { name: "Bege", hex: "#E8DDD0" }],
    sizes: ["P","M","G","GG"],
    description: "Regata de cetim leve com alças finas e bojo removível. Uma peça versátil que funciona sozinha ou por baixo de sobreposições com charme discreto.",
    material: "100% seda sintética cetinada. Bojo em esponja removível. Alças reguláveis.",
    care: "Lavar somente à mão com sabonete neutro. Não torcer. Secar à sombra deitada sobre toalha.",
    fit: "Modelagem ajustada com bojo leve. Para usar por baixo de blazers e sobreposições, suba um tamanho."
  }
];

const BRL = n => "R$ " + n.toFixed(2).replace(".", ",");

/* ---------- RENDER PRODUCT GRID ---------- */
const grid = document.getElementById("news-grid");
products.forEach((p, i) => {
  const badgeClass = p.badge === "SALE" ? "card__badge--sale"
                    : p.badge === "EXCLUSIVO" ? "card__badge--exclusive" : "";
  const badge = p.badge ? `<span class="card__badge ${badgeClass}">${p.badge}</span>` : "";
  const was = p.originalPrice ? `<span class="card__price-was">${BRL(p.originalPrice)}</span>` : "";
  const swatches = p.colors.map(c => `<span class="card__sw" style="background:${c.hex||c}"></span>`).join("");
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
    </div>
  `;
  el.querySelector('.card__media').addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      window.location.href = `produto.html?id=${p.id}`;
    }
  });
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
  document.querySelectorAll("[data-parallax], .hs-img").forEach(el => {
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
