/* ============================================================
   COR & FLOR — Admin Script
   admin-script.js
   Dados salvos em localStorage até integrar banco de dados
============================================================ */

'use strict';

// ── Auth ──────────────────────────────────────────────────────
if (sessionStorage.getItem('cf_admin_logged') !== 'true') {
  window.location.href = 'admin-login.html';
}
const adminUser = sessionStorage.getItem('cf_admin_user') || 'Admin';

// ── Storage helper ────────────────────────────────────────────
const DB = {
  get: k  => JSON.parse(localStorage.getItem(`cf_${k}`) || 'null'),
  set: (k,v) => localStorage.setItem(`cf_${k}`, JSON.stringify(v)),
};

// ── Utilities ─────────────────────────────────────────────────
const fmtBRL = n => 'R$ ' + Number(n).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtDate = s => new Date(s).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric'});
const fmtDateTime = s => new Date(s).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const uid = () => Math.random().toString(36).slice(2,10).toUpperCase();
const now = () => new Date().toISOString();

function toast(msg, type='success') {
  const t = document.getElementById('admin-toast');
  const icons = { success:'bi-check-circle-fill', error:'bi-x-circle-fill', info:'bi-info-circle-fill' };
  t.innerHTML = `<i class="bi ${icons[type]}"></i> ${msg}`;
  t.className = `admin-toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

function confirm2(msg) { return window.confirm(msg); }

// ── Sample Data ───────────────────────────────────────────────
const SAMPLE_PRODUCTS = [
  { id:'P001', name:'Vestido Laranja Floral',  category:'vestidos',  price:299.90, originalPrice:399.90, stock:{P:5,M:8,G:3},  colors:['Laranja','Rosa'],     sizes:['P','M','G'], image:'assets/p-vestido-laranja.png',  status:'active',  description:'Vestido floral levíssimo, perfeito para o verão.' },
  { id:'P002', name:'Blazer Caqui Premium',    category:'blazers',   price:459.90, originalPrice:0,      stock:{P:4,M:6,G:2},  colors:['Caqui'],              sizes:['P','M','G'], image:'assets/p-blazer-caqui.png',     status:'active',  description:'Blazer estruturado em tecido premium.' },
  { id:'P003', name:'Blusa Azul Seda',         category:'blusas',    price:189.90, originalPrice:239.90, stock:{P:10,M:12,G:5}, colors:['Azul'],              sizes:['P','M','G','GG'], image:'assets/p-blusa-azul.png',  status:'active',  description:'Blusa de seda com caimento impecável.' },
  { id:'P004', name:'Body Marrom Decote',      category:'blusas',    price:149.90, originalPrice:0,      stock:{P:8,M:10,G:4},  colors:['Marrom','Preto'],    sizes:['P','M','G'], image:'assets/p-body-marrom.png',      status:'active',  description:'Body com decote elegante e tecido confortável.' },
  { id:'P005', name:'Conjunto Rosa Verão',     category:'conjuntos', price:349.90, originalPrice:420.00, stock:{P:3,M:5,G:2},   colors:['Rosa Claro'],        sizes:['P','M','G'], image:'assets/p-conjunto-rosa.png',    status:'active',  description:'Conjunto cropped + calça wide leg.' },
  { id:'P006', name:'Look Azul Celeste',       category:'conjuntos', price:389.90, originalPrice:0,      stock:{P:2,M:4,G:1},   colors:['Azul Celeste'],      sizes:['P','M','G'], image:'assets/p-look-azul.png',        status:'active',  description:'Look completo, perfeito para eventos.' },
  { id:'P007', name:'Regata Branca Classic',   category:'blusas',    price:99.90,  originalPrice:139.90, stock:{P:15,M:18,G:9}, colors:['Branco','Bege'],     sizes:['P','M','G','GG'], image:'assets/p-regata-branca.png', status:'active',  description:'Regata básica de algodão premium.' },
  { id:'P008', name:'Saia Cetim Midi',         category:'vestidos',  price:259.90, originalPrice:319.90, stock:{P:6,M:7,G:3},   colors:['Champagne','Nude'],  sizes:['P','M','G'], image:'assets/p-saia-cetim.png',       status:'active',  description:'Saia midi em cetim com brilho sutil.' },
];

const STATUSES = ['pending','processing','shipped','delivered','cancelled'];
const STATUS_LABELS = { pending:'Aguardando', processing:'Em preparo', shipped:'Enviado', delivered:'Entregue', cancelled:'Cancelado' };
const PAYMENT_LABELS = { credit_card:'Cartão Crédito', debit_card:'Cartão Débito', pix:'Pix', boleto:'Boleto', dinheiro:'Dinheiro', credito:'Cartão Crédito', debito:'Cartão Débito' };

function mkDate(daysAgo, hour='10:00') {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0,10) + 'T' + hour + ':00';
}

const SAMPLE_ORDERS = [
  { id:'CF-1042', customer:{name:'Camila Rodrigues',email:'camila.r@email.com',phone:'(11) 9 9812-3344',address:{street:'Rua das Flores, 248',neighborhood:'Vila Madalena',city:'São Paulo',state:'SP',zip:'05435-010'}}, items:[{name:'Vestido Laranja Floral',qty:1,price:299.90,size:'M'},{name:'Regata Branca Classic',qty:2,price:99.90,size:'P'}], total:499.70, payment:'pix',         status:'delivered',   createdAt:mkDate(28,'14:32') },
  { id:'CF-1043', customer:{name:'Juliana Mendes',  email:'ju.mendes@gmail.com',phone:'(31) 9 8744-0022',address:{street:'Av. Contorno, 1500',neighborhood:'Funcionários',city:'Belo Horizonte',state:'MG',zip:'30110-920'}}, items:[{name:'Conjunto Rosa Verão',qty:1,price:349.90,size:'M'}], total:349.90, payment:'credit_card', status:'delivered',   createdAt:mkDate(25,'09:18') },
  { id:'CF-1044', customer:{name:'Patricia Santos', email:'patricia.s@icloud.com',phone:'(61) 9 9001-7788',address:{street:'SQN 305 Bloco C, 201',neighborhood:'Asa Norte',city:'Brasília',state:'DF',zip:'70736-030'}}, items:[{name:'Blazer Caqui Premium',qty:1,price:459.90,size:'G'}], total:459.90, payment:'credit_card', status:'shipped',     createdAt:mkDate(20,'16:45') },
  { id:'CF-1045', customer:{name:'Ana Lima',        email:'ana.lima@hotmail.com',phone:'(21) 9 7234-9900',address:{street:'Rua Visconde de Pirajá, 82',neighborhood:'Ipanema',city:'Rio de Janeiro',state:'RJ',zip:'22410-001'}}, items:[{name:'Saia Cetim Midi',qty:1,price:259.90,size:'P'},{name:'Body Marrom Decote',qty:1,price:149.90,size:'P'}], total:409.80, payment:'pix', status:'shipped',  createdAt:mkDate(18,'11:22') },
  { id:'CF-1046', customer:{name:'Fernanda Costa',  email:'fecosta@outlook.com',phone:'(41) 9 8811-6644',address:{street:'Rua XV de Novembro, 330',neighborhood:'Centro',city:'Curitiba',state:'PR',zip:'80020-310'}}, items:[{name:'Blusa Azul Seda',qty:1,price:189.90,size:'M'}], total:189.90, payment:'debit_card',  status:'processing',  createdAt:mkDate(10,'08:05') },
  { id:'CF-1047', customer:{name:'Mariana Ferreira',email:'mfe@email.com',phone:'(51) 9 9500-1133',address:{street:'Av. Osvaldo Aranha, 440',neighborhood:'Bom Fim',city:'Porto Alegre',state:'RS',zip:'90035-190'}}, items:[{name:'Look Azul Celeste',qty:1,price:389.90,size:'M'}], total:389.90, payment:'pix', status:'processing',  createdAt:mkDate(8,'15:30') },
  { id:'CF-1048', customer:{name:'Beatriz Alves',   email:'bia.alves@gmail.com',phone:'(85) 9 8844-2211',address:{street:'Rua Tibúrcio Cavalcante, 66',neighborhood:'Meireles',city:'Fortaleza',state:'CE',zip:'60125-100'}}, items:[{name:'Vestido Laranja Floral',qty:1,price:299.90,size:'G'},{name:'Conjunto Rosa Verão',qty:1,price:349.90,size:'G'}], total:649.80, payment:'credit_card', status:'pending', createdAt:mkDate(4,'19:14') },
  { id:'CF-1049', customer:{name:'Larissa Oliveira',email:'la.oliveira@yahoo.com',phone:'(11) 9 7733-8800',address:{street:'Rua Pamplona, 556',neighborhood:'Jardins',city:'São Paulo',state:'SP',zip:'01405-001'}}, items:[{name:'Regata Branca Classic',qty:3,price:99.90,size:'M'}], total:299.70, payment:'pix', status:'pending', createdAt:mkDate(2,'10:48') },
  { id:'CF-1050', customer:{name:'Tatiane Rocha',   email:'tati.r@email.com',phone:'(62) 9 9600-4455',address:{street:'Av. T-63, 1200',neighborhood:'Setor Bueno',city:'Goiânia',state:'GO',zip:'74230-010'}}, items:[{name:'Saia Cetim Midi',qty:1,price:259.90,size:'M'}], total:259.90, payment:'credit_card', status:'pending', createdAt:mkDate(1,'17:22') },
  { id:'CF-1051', customer:{name:'Renata Pinto',    email:'renata.p@gmail.com',phone:'(11) 9 8822-7766',address:{street:'Rua Oscar Freire, 200',neighborhood:'Cerqueira César',city:'São Paulo',state:'SP',zip:'01426-001'}}, items:[{name:'Blazer Caqui Premium',qty:1,price:459.90,size:'P'},{name:'Body Marrom Decote',qty:1,price:149.90,size:'P'}], total:609.80, payment:'pix', status:'cancelled', createdAt:mkDate(15,'13:10') },
];

function randDate(month, day) {
  return `2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(9+Math.floor(Math.random()*10)).padStart(2,'0')}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}:00`;
}
const SAMPLE_PHYSICAL = [];
const pSellers = ['Ana Paula','Bianca','Carla','Diana'];
const pProds = [
  {name:'Vestido Laranja Floral',cat:'vestidos',price:299.90},
  {name:'Blazer Caqui Premium',cat:'blazers',price:459.90},
  {name:'Blusa Azul Seda',cat:'blusas',price:189.90},
  {name:'Saia Cetim Midi',cat:'vestidos',price:259.90},
  {name:'Conjunto Rosa Verão',cat:'conjuntos',price:349.90},
  {name:'Body Marrom Decote',cat:'blusas',price:149.90},
  {name:'Regata Branca Classic',cat:'blusas',price:99.90},
  {name:'Look Azul Celeste',cat:'conjuntos',price:389.90},
];
const pPays = ['dinheiro','pix','credito','debito'];
for (let i=0; i<22; i++) {
  const prod = pProds[i % pProds.length];
  const qty  = Math.random() > .75 ? 2 : 1;
  const disc = Math.random() > .8 ? 20 : 0;
  const m = (i < 8) ? 4 : (i < 15) ? 5 : 5;
  const day = 1 + (i * 3) % 28;
  SAMPLE_PHYSICAL.push({
    id:'FS'+String(100+i),
    product: prod.name, category: prod.cat,
    quantity: qty, unitPrice: prod.price,
    discount: disc, total: prod.price * qty - disc,
    payment: pPays[i % pPays.length],
    seller: pSellers[i % pSellers.length],
    customer: '', details:'', notes:'',
    createdAt: randDate(m, day),
  });
}

// ── Init ──────────────────────────────────────────────────────
function initData() {
  if (!DB.get('products'))  DB.set('products',  SAMPLE_PRODUCTS);
  if (!DB.get('orders'))    DB.set('orders',     SAMPLE_ORDERS);
  if (!DB.get('physical'))  DB.set('physical',   SAMPLE_PHYSICAL);
  if (!DB.get('notifications')) DB.set('notifications', [
    { id:'n1', text:'Novo pedido CF-1051 — R$ 609,80', time: mkDate(0,'08:30'), icon:'bi-bag-heart', unread:true },
    { id:'n2', text:'Pedido CF-1050 aguardando aprovação', time: mkDate(1,'17:22'), icon:'bi-clock', unread:true },
    { id:'n3', text:'Estoque baixo: Look Azul Celeste (G=1)', time: mkDate(2,'09:00'), icon:'bi-exclamation-triangle', unread:false },
  ]);
}
initData();

// ── Header setup ──────────────────────────────────────────────
document.getElementById('header-name').textContent = adminUser;
document.getElementById('dash-name').textContent   = adminUser;
document.getElementById('header-avatar').textContent = adminUser[0].toUpperCase();
const now_ = new Date();
document.getElementById('dash-date').textContent = now_.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

// ── Navigation ────────────────────────────────────────────────
const SECTION_TITLES = {
  dashboard:'Painel', orders:'Pedidos Online',
  products:'Produtos', physical:'Venda Física',
  metrics:'Métricas', customers:'Clientes',
  inventory:'Estoque', settings:'Configurações',
};
let currentSection = 'dashboard';

function goTo(sec) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.snav').forEach(a => a.classList.remove('active'));
  document.getElementById(`sec-${sec}`).classList.add('active');
  const link = document.querySelector(`.snav[data-sec="${sec}"]`);
  if (link) link.classList.add('active');
  document.getElementById('breadcrumb-title').textContent = SECTION_TITLES[sec] || sec;
  currentSection = sec;
  closeSidebar();

  // lazy render
  if (sec === 'dashboard') renderDashboard();
  if (sec === 'orders')    renderOrders();
  if (sec === 'products')  renderProducts();
  if (sec === 'physical')  { populateCatalogSelect(); renderPhysicalSales(); updateSalePreview(); }
  if (sec === 'metrics')   setTimeout(renderMetrics, 50);
  if (sec === 'customers') renderCustomers();
  if (sec === 'inventory') renderInventory();
  if (sec === 'settings')  loadSettings();
}

// Sidebar mobile
document.getElementById('btn-burger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('mobile-open');
  let veil = document.getElementById('sidebar-veil');
  if (!veil) {
    veil = document.createElement('div'); veil.id='sidebar-veil'; veil.className='sidebar-veil';
    veil.onclick = closeSidebar;
    document.body.appendChild(veil);
  }
  veil.classList.toggle('show');
});
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  const v = document.getElementById('sidebar-veil');
  if (v) v.classList.remove('show');
}

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.clear(); window.location.href = 'admin-login.html';
});

// Notification panel
document.getElementById('btn-notif').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('notif-panel').classList.toggle('open');
});
document.addEventListener('click', (e) => {
  const p = document.getElementById('notif-panel');
  if (!p.contains(e.target) && e.target !== document.getElementById('btn-notif')) {
    p.classList.remove('open');
  }
});


// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const orders   = DB.get('orders')   || [];
  const physical = DB.get('physical') || [];
  const products = DB.get('products') || [];

  const onlineTotal  = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total, 0);
  const physicalTotal= physical.reduce((s,p)=>s+p.total, 0);
  const totalRevenue = onlineTotal + physicalTotal;
  const pendingOrders= orders.filter(o=>o.status==='pending').length;
  const totalClients = new Set(orders.map(o=>o.customer.email)).size;
  const lowStock = products.filter(p=>{
    const t = Object.values(p.stock).reduce((a,b)=>a+b,0);
    return t <= 5;
  }).length;

  // KPIs — 6 cards
  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card kpi-card--rose">
      <div class="kpi-card__icon"><i class="bi bi-currency-dollar"></i></div>
      <p class="kpi-card__label">Receita Total</p>
      <div class="kpi-card__value">${fmtBRL(totalRevenue)}</div>
      <span class="kpi-card__delta kpi-card__delta--up"><i class="bi bi-arrow-up"></i> Online + Física</span>
    </div>
    <div class="kpi-card kpi-card--deep">
      <div class="kpi-card__icon"><i class="bi bi-bag-heart"></i></div>
      <p class="kpi-card__label">Receita Online</p>
      <div class="kpi-card__value">${fmtBRL(onlineTotal)}</div>
      <span class="kpi-card__delta kpi-card__delta--flat">${orders.filter(o=>o.status!=='cancelled').length} pedidos confirmados</span>
    </div>
    <div class="kpi-card kpi-card--gold">
      <div class="kpi-card__icon"><i class="bi bi-shop"></i></div>
      <p class="kpi-card__label">Receita Física</p>
      <div class="kpi-card__value">${fmtBRL(physicalTotal)}</div>
      <span class="kpi-card__delta kpi-card__delta--flat">${physical.length} vendas registradas</span>
    </div>
    <div class="kpi-card kpi-card--rose">
      <div class="kpi-card__icon"><i class="bi bi-clock-history"></i></div>
      <p class="kpi-card__label">Pedidos Pendentes</p>
      <div class="kpi-card__value">${pendingOrders}</div>
      <span class="kpi-card__delta ${pendingOrders>0?'kpi-card__delta--down':'kpi-card__delta--flat'}">
        ${pendingOrders > 0 ? `<i class="bi bi-exclamation-circle"></i> Aguardando ação` : 'Tudo em dia ✓'}
      </span>
    </div>
    <div class="kpi-card kpi-card--green">
      <div class="kpi-card__icon"><i class="bi bi-people"></i></div>
      <p class="kpi-card__label">Clientes</p>
      <div class="kpi-card__value">${totalClients}</div>
      <span class="kpi-card__delta kpi-card__delta--flat">base cadastrada</span>
    </div>
    <div class="kpi-card kpi-card--green">
      <div class="kpi-card__icon"><i class="bi bi-boxes"></i></div>
      <p class="kpi-card__label">Alertas Estoque</p>
      <div class="kpi-card__value">${lowStock}</div>
      <span class="kpi-card__delta ${lowStock>0?'kpi-card__delta--down':'kpi-card__delta--flat'}">
        ${lowStock>0?`<i class="bi bi-exclamation-triangle"></i> ${lowStock} produto(s) baixo`:'Estoque OK ✓'}
      </span>
    </div>
  `;

  // Recent orders (last 5)
  const recent = [...orders].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  document.getElementById('dash-recent-orders').innerHTML = recent.map(o => `
    <div class="recent-order-row">
      <div class="recent-order-row__info">
        <span class="recent-order-row__id">${o.id}</span>
        <span class="recent-order-row__name">${o.customer.name}</span>
      </div>
      <div class="recent-order-row__right">
        <span class="recent-order-row__price">${fmtBRL(o.total)}</span>
        <span class="badge badge--${o.status}">${STATUS_LABELS[o.status]}</span>
      </div>
    </div>
  `).join('') || '<p style="color:var(--warm-gray);font-size:13px;padding:12px 0">Nenhum pedido ainda.</p>';

  // Top products
  const soldMap = {};
  orders.filter(o=>o.status!=='cancelled').forEach(o => {
    o.items.forEach(i => {
      soldMap[i.name] = (soldMap[i.name]||0) + (i.price*i.qty||i.price);
    });
  });
  physical.forEach(p => {
    soldMap[p.product] = (soldMap[p.product]||0) + p.total;
  });
  const top = Object.entries(soldMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxVal = top[0]?.[1] || 1;
  document.getElementById('dash-top-products').innerHTML = top.map(([name,val],i) => `
    <div class="top-prod-row">
      <div class="top-prod-row__rank">${i+1}</div>
      <div class="top-prod-row__name">${name.length>22?name.slice(0,22)+'…':name}</div>
      <div class="top-prod-row__bar"><div class="top-prod-row__bar-fill" style="width:${(val/maxVal*100).toFixed(0)}%"></div></div>
      <div class="top-prod-row__val">${fmtBRL(val)}</div>
    </div>
  `).join('') || '<p style="color:var(--warm-gray);font-size:13px">Nenhuma venda ainda.</p>';

  // Badge on orders nav
  updateOrderBadge();
  renderNotifications();
}

function updateOrderBadge() {
  const orders = DB.get('orders') || [];
  const pending = orders.filter(o=>o.status==='pending').length;
  const badge = document.getElementById('badge-orders');
  badge.textContent = pending;
  badge.classList.toggle('show', pending > 0);
  // notif dot
  const notifs = DB.get('notifications') || [];
  const unread = notifs.filter(n=>n.unread).length;
  document.getElementById('notif-dot').style.display = unread > 0 ? 'block' : 'none';
}


// ── ORDERS ─────────────────────────────────────────────────────
function renderOrders() {
  const orders  = DB.get('orders') || [];
  const filter  = document.getElementById('order-status-filter')?.value || '';
  const filtered= filter ? orders.filter(o=>o.status===filter) : orders;
  const sorted  = [...filtered].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  document.getElementById('orders-tbody').innerHTML = sorted.length ? sorted.map(o => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>
        <div style="font-weight:500">${o.customer.name}</div>
        <div style="font-size:11px;color:var(--warm-gray)">${o.customer.email}</div>
      </td>
      <td style="white-space:nowrap">
        <div style="font-size:12px">${o.customer.phone}</div>
        <div style="font-size:11px;color:var(--warm-gray)">${o.customer.address.city}/${o.customer.address.state}</div>
      </td>
      <td>
        <div style="font-size:12px">${o.items.map(i=>`${i.name} (${i.size||''}) x${i.qty||1}`).join('<br>')}</div>
      </td>
      <td><strong style="color:var(--rose-deep)">${fmtBRL(o.total)}</strong></td>
      <td><span class="badge badge--${o.status}"><span class="status-dot status-dot--${o.status}"></span> ${STATUS_LABELS[o.status]}</span></td>
      <td style="white-space:nowrap;font-size:12px">${fmtDateTime(o.createdAt)}</td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" title="Ver detalhes" onclick="openOrderDetail('${o.id}')"><i class="bi bi-eye"></i></button>
          <select class="status-select" onchange="updateOrderStatus('${o.id}',this.value)" title="Alterar status">
            ${STATUSES.map(s=>`<option value="${s}"${o.status===s?' selected':''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--warm-gray)">Nenhum pedido encontrado.</td></tr>`;
}

function updateOrderStatus(id, status) {
  const orders = DB.get('orders') || [];
  const idx = orders.findIndex(o=>o.id===id);
  if (idx < 0) return;
  const prev = orders[idx].status;
  orders[idx].status = status;

  // Deduz estoque ao confirmar preparo (pending → processing)
  if (status === 'processing' && !orders[idx].stockDeducted && prev === 'pending') {
    deductStockForOrder(orders[idx]);
    orders[idx].stockDeducted = true;
    toast(`Pedido ${id} em preparo — estoque atualizado ✓`, 'success');
  }
  // Restaura estoque se cancelado após já ter deduzido
  else if (status === 'cancelled' && orders[idx].stockDeducted) {
    restoreStockForOrder(orders[idx]);
    orders[idx].stockDeducted = false;
    toast(`Pedido ${id} cancelado — estoque restaurado`, 'info');
  }
  else {
    toast(`Pedido ${id} → ${STATUS_LABELS[status]}`, 'success');
  }

  DB.set('orders', orders);
  updateOrderBadge();
  renderOrders();
}

function deductStockForOrder(order) {
  const products = DB.get('products') || [];
  let changed = false;
  order.items.forEach(item => {
    const pIdx = products.findIndex(p => p.name === item.name);
    if (pIdx < 0) return;
    const size = item.size || 'M';
    const qty  = item.qty  || 1;
    if (products[pIdx].stock[size] !== undefined) {
      products[pIdx].stock[size] = Math.max(0, products[pIdx].stock[size] - qty);
      changed = true;
    }
  });
  if (changed) {
    DB.set('products', products);
    if (currentSection === 'inventory') renderInventory();
  }
}

function restoreStockForOrder(order) {
  const products = DB.get('products') || [];
  let changed = false;
  order.items.forEach(item => {
    const pIdx = products.findIndex(p => p.name === item.name);
    if (pIdx < 0) return;
    const size = item.size || 'M';
    const qty  = item.qty  || 1;
    if (products[pIdx].stock[size] !== undefined) {
      products[pIdx].stock[size] += qty;
      changed = true;
    }
  });
  if (changed) {
    DB.set('products', products);
    if (currentSection === 'inventory') renderInventory();
  }
}

function openOrderDetail(id) {
  const orders = DB.get('orders') || [];
  const o = orders.find(o=>o.id===id);
  if (!o) return;
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <h3 class="modal-title"><i class="bi bi-bag-heart"></i> Pedido ${o.id}</h3>
    <div class="order-detail">
      <div class="order-detail__section">
        <h5>👤 Dados do Cliente</h5>
        <div class="order-detail__grid">
          <div class="order-detail__field"><label>Nome</label><p>${o.customer.name}</p></div>
          <div class="order-detail__field"><label>E-mail</label><p>${o.customer.email}</p></div>
          <div class="order-detail__field"><label>Telefone</label><p>${o.customer.phone}</p></div>
          <div class="order-detail__field"><label>Pagamento</label><p>${PAYMENT_LABELS[o.payment]||o.payment}</p></div>
        </div>
      </div>
      <div class="order-detail__section">
        <h5>📍 Endereço de Entrega</h5>
        <div class="order-detail__grid">
          <div class="order-detail__field" style="grid-column:1/-1"><label>Rua / Número</label><p>${o.customer.address.street}</p></div>
          <div class="order-detail__field"><label>Bairro</label><p>${o.customer.address.neighborhood||'—'}</p></div>
          <div class="order-detail__field"><label>Cidade/UF</label><p>${o.customer.address.city} — ${o.customer.address.state}</p></div>
          <div class="order-detail__field"><label>CEP</label><p>${o.customer.address.zip}</p></div>
        </div>
      </div>
      <div class="order-detail__section">
        <h5>🛍️ Itens do Pedido</h5>
        <div class="order-detail__items">
          ${o.items.map(i=>`
            <div class="order-detail__item">
              <div><strong>${i.name}</strong><br><small style="color:var(--warm-gray)">Tam.: ${i.size||'—'} — Qtd: ${i.qty||1}</small></div>
              <strong style="color:var(--rose-deep)">${fmtBRL(i.price*(i.qty||1))}</strong>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;padding:14px 14px 0;font-weight:600;font-family:var(--serif);font-size:16px">
          <span>Total</span><span style="color:var(--rose-deep)">${fmtBRL(o.total)}</span>
        </div>
      </div>
      <div class="order-detail__section">
        <h5>⚙️ Atualizar Status</h5>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${STATUSES.map(s=>`
            <button onclick="updateOrderStatus('${o.id}','${s}');closeModal();" class="${o.status===s?'btn-primary':'btn-outline'}" style="padding:8px 14px;font-size:11px">
              ${STATUS_LABELS[s]}
            </button>
          `).join('')}
        </div>
      </div>
      <div style="font-size:11px;color:var(--warm-gray);text-align:right;margin-top:8px">
        Data do pedido: ${fmtDateTime(o.createdAt)}
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay') || e.currentTarget.classList?.contains('modal-close')) {
    document.getElementById('modal-overlay').classList.remove('open');
    window._pendingImgBase64 = null;
  }
}


// ── PRODUCTS ─────────────────────────────────────────────────
function renderProducts() {
  const products = DB.get('products') || [];
  const search   = (document.getElementById('product-search')?.value || '').toLowerCase();
  const cat      = document.getElementById('product-cat-filter')?.value || '';
  const status   = document.getElementById('product-status-filter')?.value || '';

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search) || p.category.includes(search);
    const matchCat    = !cat    || p.category === cat;
    const matchStatus = !status || p.status === status;
    return matchSearch && matchCat && matchStatus;
  });

  const CAT_LABELS = {vestidos:'Vestidos',blusas:'Blusas',conjuntos:'Conjuntos',calcas:'Calças',blazers:'Blazers',acessorios:'Acessórios'};

  document.getElementById('products-grid').innerHTML = filtered.length ? filtered.map(p => {
    const totalStock = Object.values(p.stock).reduce((a,b)=>a+b,0);
    return `
      <div class="prod-card">
        <div class="prod-card__img">
          <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.3'">
          <span class="prod-card__status badge badge--${p.status==='active'?'active':'inactive'}">${p.status==='active'?'Ativo':'Inativo'}</span>
          <div class="prod-card__actions">
            <button class="btn-edit" onclick="openProductModal('${p.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
            <button class="btn-del" onclick="deleteProduct('${p.id}')" title="Excluir"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div class="prod-card__body">
          <div class="prod-card__cat">${CAT_LABELS[p.category]||p.category}</div>
          <div class="prod-card__name">${p.name}</div>
          <div class="prod-card__price">
            <span class="prod-card__price-now">${fmtBRL(p.price)}</span>
            ${p.originalPrice>0?`<span class="prod-card__price-was">${fmtBRL(p.originalPrice)}</span>`:''}
          </div>
          <div class="prod-card__stock">
            Estoque: ${totalStock} un.
            ${totalStock<=5?`<span class="badge badge--${totalStock===0?'out-stock':'low-stock'}" style="font-size:9px;padding:2px 7px">${totalStock===0?'Esgotado':'Baixo'}</span>`:''}
          </div>
        </div>
      </div>
    `;
  }).join('') : `
    <div class="empty-state">
      <i class="bi bi-grid-x"></i>
      <p>Nenhum produto encontrado.<br><button class="btn-link" onclick="openProductModal()">Cadastrar primeiro produto</button></p>
    </div>
  `;
}

function openProductModal(id) {
  window._pendingImgBase64 = null;
  const products = DB.get('products') || [];
  const p = id ? products.find(x=>x.id===id) : null;

  const imgAreaHtml = p?.image
    ? `<img src="${p.image}" class="img-upload-preview" id="img-preview">
       <p style="font-size:11px;color:var(--rose-deep);margin-top:8px">Clique para trocar a foto</p>`
    : `<i class="bi bi-cloud-upload" style="font-size:36px;color:var(--rose-soft)"></i>
       <p style="font-size:13px;color:var(--warm-gray);margin:8px 0 2px">Clique ou arraste a foto aqui</p>
       <p style="font-size:11px;color:rgba(74,64,64,.35)">PNG, JPG, WEBP — Máx. 5MB</p>`;

  document.getElementById('modal-body').innerHTML = `
    <h3 class="modal-title"><i class="bi bi-${p?'pencil':'plus-circle'}"></i> ${p?'Editar':'Novo'} Produto</h3>
    <form id="prod-form" onsubmit="saveProduct(event,'${id||''}')">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nome do Produto *</label>
          <input type="text" class="form-input" id="pf-name" value="${p?.name||''}" required placeholder="ex: Vestido Floral Rosa"></div>
        <div class="form-group"><label class="form-label">Categoria *</label>
          <select class="form-select" id="pf-cat">
            ${[['vestidos','Vestidos & Saias'],['blusas','Blusas & Tops'],['conjuntos','Conjuntos'],['calcas','Calças'],['blazers','Blazers'],['acessorios','Acessórios']].map(([v,l])=>`<option value="${v}"${p?.category===v?' selected':''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Preço (R$) *</label>
          <input type="number" class="form-input" id="pf-price" value="${p?.price||''}" step="0.01" min="0" required placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Preço Original (R$)</label>
          <input type="number" class="form-input" id="pf-orig" value="${p?.originalPrice||''}" step="0.01" min="0" placeholder="Deixe 0 se não houver"></div>
      </div>

      <!-- Upload de foto -->
      <div class="form-group">
        <label class="form-label">Foto do Produto</label>
        <div class="img-upload-area" id="img-upload-area"
             onclick="document.getElementById('pf-img-file').click()"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')"
             ondrop="event.preventDefault();this.classList.remove('drag-over');handleImgDrop(event)">
          ${imgAreaHtml}
        </div>
        <input type="file" id="pf-img-file" accept="image/png,image/jpeg,image/webp,image/gif"
               style="display:none" onchange="onImageUpload(event)">
        <input type="hidden" id="pf-img-current" value="${p?.image||''}">
      </div>

      <div class="form-group"><label class="form-label">Descrição</label>
        <textarea class="form-input" id="pf-desc" rows="2" placeholder="Descreva o produto...">${p?.description||''}</textarea></div>
      <div class="form-group"><label class="form-label">Cores (separadas por vírgula)</label>
        <input type="text" class="form-input" id="pf-colors" value="${p?.colors?.join(', ')||''}" placeholder="Rosa, Azul, Preto"></div>
      <div class="form-group"><label class="form-label">Tamanhos disponíveis</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          ${['PP','P','M','G','GG','U'].map(sz=>`
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
              <input type="checkbox" value="${sz}" ${p?.sizes?.includes(sz)?'checked':''} class="pf-size"> ${sz}
            </label>
          `).join('')}
        </div>
      </div>
      <p class="form-label" style="margin-bottom:10px">Estoque por Tamanho</p>
      <div class="form-row">
        <div class="form-group"><label class="form-label">P</label><input type="number" class="form-input" id="pf-stk-P" value="${p?.stock?.P||0}" min="0"></div>
        <div class="form-group"><label class="form-label">M</label><input type="number" class="form-input" id="pf-stk-M" value="${p?.stock?.M||0}" min="0"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">G</label><input type="number" class="form-input" id="pf-stk-G" value="${p?.stock?.G||0}" min="0"></div>
        <div class="form-group"><label class="form-label">GG</label><input type="number" class="form-input" id="pf-stk-GG" value="${p?.stock?.GG||0}" min="0"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="pf-status">
          <option value="active"  ${p?.status==='active'?' selected':''}>Ativo</option>
          <option value="inactive"${p?.status==='inactive'?' selected':''}>Inativo</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button type="submit" class="btn-primary" style="flex:1;justify-content:center"><i class="bi bi-check-lg"></i> ${p?'Salvar Alterações':'Cadastrar Produto'}</button>
        <button type="button" class="btn-outline" onclick="closeModal()">Cancelar</button>
      </div>
    </form>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

function onImageUpload(e) {
  const file = e.target.files[0];
  if (file) processImageFile(file);
}
function handleImgDrop(e) {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processImageFile(file);
}
function processImageFile(file) {
  if (file.size > 5 * 1024 * 1024) { toast('Imagem muito grande. Máx. 5MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    window._pendingImgBase64 = ev.target.result;
    const area = document.getElementById('img-upload-area');
    if (area) area.innerHTML = `
      <img src="${ev.target.result}" class="img-upload-preview" id="img-preview">
      <p style="font-size:11px;color:var(--rose-deep);margin-top:8px;cursor:pointer"
         onclick="event.stopPropagation();clearImageUpload()">
        <i class="bi bi-arrow-repeat"></i> Trocar foto
      </p>`;
  };
  reader.readAsDataURL(file);
}
function clearImageUpload() {
  window._pendingImgBase64 = null;
  const area = document.getElementById('img-upload-area');
  if (area) area.innerHTML = `
    <i class="bi bi-cloud-upload" style="font-size:36px;color:var(--rose-soft)"></i>
    <p style="font-size:13px;color:var(--warm-gray);margin:8px 0 2px">Clique ou arraste a foto aqui</p>
    <p style="font-size:11px;color:rgba(74,64,64,.35)">PNG, JPG, WEBP — Máx. 5MB</p>`;
  const fi = document.getElementById('pf-img-file');
  if (fi) fi.value = '';
  const hi = document.getElementById('pf-img-current');
  if (hi) hi.value = '';
}

function saveProduct(e, id) {
  e.preventDefault();
  const products = DB.get('products') || [];
  const sizes = [...document.querySelectorAll('.pf-size:checked')].map(c=>c.value);
  const prod = {
    id: id || 'P' + uid(),
    name:          document.getElementById('pf-name').value.trim(),
    category:      document.getElementById('pf-cat').value,
    price:         parseFloat(document.getElementById('pf-price').value) || 0,
    originalPrice: parseFloat(document.getElementById('pf-orig').value)  || 0,
    image:         window._pendingImgBase64 || document.getElementById('pf-img-current')?.value || '',
    description:   document.getElementById('pf-desc').value.trim(),
    colors:        document.getElementById('pf-colors').value.split(',').map(s=>s.trim()).filter(Boolean),
    sizes,
    stock: {
      P:  parseInt(document.getElementById('pf-stk-P').value)  || 0,
      M:  parseInt(document.getElementById('pf-stk-M').value)  || 0,
      G:  parseInt(document.getElementById('pf-stk-G').value)  || 0,
      GG: parseInt(document.getElementById('pf-stk-GG').value) || 0,
    },
    status: document.getElementById('pf-status').value,
    createdAt: id ? (products.find(p=>p.id===id)?.createdAt || now()) : now(),
  };

  if (id) {
    const idx = products.findIndex(p=>p.id===id);
    if (idx>=0) products[idx] = prod; else products.push(prod);
    toast('Produto atualizado com sucesso!', 'success');
  } else {
    products.push(prod);
    toast('Produto cadastrado com sucesso!', 'success');
  }
  DB.set('products', products);
  closeModal();
  renderProducts();
}

function deleteProduct(id) {
  if (!confirm2('Excluir este produto? Esta ação não pode ser desfeita.')) return;
  const products = (DB.get('products') || []).filter(p=>p.id!==id);
  DB.set('products', products);
  renderProducts();
  toast('Produto removido.', 'info');
}


// ── PHYSICAL SALES ────────────────────────────────────────────
function submitPhysicalSale(e) {
  e.preventDefault();
  const isCatalog = document.querySelector('input[name="ps-prod-type"]:checked')?.value === 'catalog';
  const qty   = parseInt(document.getElementById('ps-qty').value)        || 1;
  const price = parseFloat(document.getElementById('ps-price').value)    || 0;
  const disc  = parseFloat(document.getElementById('ps-discount').value) || 0;

  if (price <= 0) { toast('Informe o valor unitário da venda.', 'error'); return; }

  let productName, categoryVal, catalogProductId = null, saleSize = '';

  if (isCatalog) {
    const sel = document.getElementById('ps-catalog-select');
    if (!sel.value) { toast('Selecione um produto do catálogo.', 'error'); return; }
    const products = DB.get('products') || [];
    const p = products.find(x => x.id === sel.value);
    if (!p) { toast('Produto não encontrado.', 'error'); return; }
    productName      = p.name;
    categoryVal      = p.category;
    catalogProductId = p.id;
    saleSize         = document.getElementById('ps-size-select')?.value || '';
  } else {
    productName = document.getElementById('ps-product-new')?.value.trim();
    categoryVal = document.getElementById('ps-category')?.value || 'outros';
    if (!productName) { toast('Informe o nome do produto.', 'error'); return; }
  }

  const sale = {
    id: 'FS' + uid(),
    product: productName, category: categoryVal,
    catalogProductId, size: saleSize,
    quantity: qty, unitPrice: price, discount: disc,
    total: Math.max(0, price * qty - disc),
    payment:  document.getElementById('ps-payment').value,
    seller:   document.getElementById('ps-seller').value.trim(),
    customer: document.getElementById('ps-customer').value.trim(),
    details:  document.getElementById('ps-details').value.trim(),
    notes:    document.getElementById('ps-notes').value.trim(),
    createdAt: now(),
  };

  // ── Deduz estoque do produto do catálogo ──────────────────
  if (catalogProductId) {
    const products = DB.get('products') || [];
    const pIdx = products.findIndex(p => p.id === catalogProductId);
    if (pIdx >= 0) {
      if (saleSize && products[pIdx].stock[saleSize] !== undefined) {
        products[pIdx].stock[saleSize] = Math.max(0, products[pIdx].stock[saleSize] - qty);
      } else {
        // Deduz do tamanho com mais estoque
        const maxEntry = Object.entries(products[pIdx].stock).sort((a,b) => b[1]-a[1])[0];
        if (maxEntry) products[pIdx].stock[maxEntry[0]] = Math.max(0, maxEntry[1] - qty);
      }
      DB.set('products', products);
      const total = Object.values(products[pIdx].stock).reduce((a,b)=>a+b,0);
      if (total <= 3) addNotification(`⚠️ Estoque baixo: ${products[pIdx].name} (${total} un. restantes)`, 'bi-exclamation-triangle');
      if (currentSection === 'inventory') renderInventory();
    }
  }

  const physical = DB.get('physical') || [];
  physical.unshift(sale);
  DB.set('physical', physical);
  e.target.reset();
  document.getElementById('ps-qty').value = 1;
  document.getElementById('ps-discount').value = 0;
  togglePsType('catalog');
  populateCatalogSelect();
  updateSalePreview();
  renderPhysicalSales();
  toast(`Venda registrada — ${fmtBRL(sale.total)} ✓`, 'success');
  addNotification(`Nova venda física: ${sale.product} — ${fmtBRL(sale.total)}`, 'bi-shop');
}

// ── Toggle catálogo / novo produto ────────────────────────────
function togglePsType(type) {
  const catalogWrap = document.getElementById('ps-catalog-wrap');
  const newWrap     = document.getElementById('ps-new-wrap');
  if (catalogWrap) catalogWrap.style.display = type === 'catalog' ? '' : 'none';
  if (newWrap)     newWrap.style.display     = type === 'new'     ? '' : 'none';
  document.querySelectorAll('.ps-type-opt').forEach(opt => {
    opt.classList.toggle('ps-type-opt--active', opt.dataset.type === type);
  });
  const radio = document.querySelector(`input[name="ps-prod-type"][value="${type}"]`);
  if (radio) radio.checked = true;
  // Limpa price ao trocar para novo produto
  if (type === 'new') {
    const priceInput = document.getElementById('ps-price');
    if (priceInput) priceInput.value = '';
    updateSalePreview();
  }
}

function populateCatalogSelect() {
  const sel = document.getElementById('ps-catalog-select');
  if (!sel) return;
  const products = DB.get('products') || [];
  const active   = products.filter(p => p.status === 'active');
  sel.innerHTML  = '<option value="">— Selecione um produto —</option>' +
    active.map(p => {
      const total = Object.values(p.stock).reduce((a,b)=>a+b,0);
      return `<option value="${p.id}">${p.name} — ${fmtBRL(p.price)} · Estoque: ${total} un.</option>`;
    }).join('');
}

function onCatalogSelect() {
  const products = DB.get('products') || [];
  const id = document.getElementById('ps-catalog-select').value;
  const p  = products.find(x => x.id === id);
  const sizeSelect = document.getElementById('ps-size-select');
  const stockInfo  = document.getElementById('ps-stock-info');
  const priceInput = document.getElementById('ps-price');

  if (!p) {
    sizeSelect.innerHTML  = '<option value="">Todos / Único</option>';
    stockInfo.textContent = 'Selecione um produto';
    if (priceInput) priceInput.value = '';
    updateSalePreview();
    return;
  }

  // Tamanhos disponíveis com estoque
  sizeSelect.innerHTML = '<option value="">Todos / Único</option>' +
    Object.entries(p.stock)
      .filter(([,v]) => v > 0)
      .map(([sz, qty]) => `<option value="${sz}">${sz} — ${qty} un. disponíveis</option>`)
      .join('');

  // Preço do catálogo (editável)
  if (priceInput) priceInput.value = p.price;

  // Info de estoque
  const total = Object.values(p.stock).reduce((a,b)=>a+b,0);
  const color = total === 0 ? '#dc2626' : total <= 5 ? '#d97706' : '#059669';
  stockInfo.innerHTML = `Estoque total: <strong style="color:${color}">${total} un.</strong>`;

  updateSalePreview();
}

function onSizeSelect() {
  const products = DB.get('products') || [];
  const prodId = document.getElementById('ps-catalog-select')?.value;
  const size   = document.getElementById('ps-size-select')?.value;
  const p = products.find(x => x.id === prodId);
  if (!p || !size) return;
  const qty = p.stock[size] || 0;
  const color = qty === 0 ? '#dc2626' : qty <= 3 ? '#d97706' : '#059669';
  const stockInfo = document.getElementById('ps-stock-info');
  if (stockInfo) stockInfo.innerHTML = `Tamanho <strong>${size}</strong>: <strong style="color:${color}">${qty} un. disponíveis</strong>`;
}

function renderPhysicalSales() {
  const physical = DB.get('physical') || [];
  const period   = document.getElementById('ps-period-filter')?.value || 'all';
  const now2 = new Date();

  const filtered = physical.filter(s => {
    const d = new Date(s.createdAt);
    if (period === 'today') return d.toDateString() === now2.toDateString();
    if (period === 'week') {
      const weekAgo = new Date(now2); weekAgo.setDate(weekAgo.getDate()-7);
      return d >= weekAgo;
    }
    if (period === 'month') return d.getMonth()===now2.getMonth() && d.getFullYear()===now2.getFullYear();
    return true;
  });

  const totalPeriod = filtered.reduce((s,p)=>s+p.total,0);
  document.getElementById('ps-total-badge').textContent = fmtBRL(totalPeriod);

  const PAYMNT_ICONS = { dinheiro:'💵', pix:'📱', credito:'💳', debito:'💳', boleto:'🏦' };

  document.getElementById('physical-tbody').innerHTML = filtered.length ? filtered.map(s=>`
    <tr>
      <td style="font-size:11px;color:var(--warm-gray)">${s.id}</td>
      <td>
        <div style="font-weight:500">${s.product}</div>
        ${s.details?`<div style="font-size:11px;color:var(--warm-gray)">${s.details}</div>`:''}
        ${s.customer?`<div style="font-size:11px;color:var(--warm-gray)">👤 ${s.customer}</div>`:''}
      </td>
      <td style="text-align:center">${s.quantity}</td>
      <td><strong style="color:var(--rose-deep)">${fmtBRL(s.total)}</strong>
        ${s.discount>0?`<div style="font-size:10px;color:var(--warm-gray)">desc. ${fmtBRL(s.discount)}</div>`:''}
      </td>
      <td>${PAYMNT_ICONS[s.payment]||''} ${PAYMENT_LABELS[s.payment]||s.payment}</td>
      <td style="font-size:12px">${s.seller||'—'}</td>
      <td style="font-size:11px;white-space:nowrap">${fmtDateTime(s.createdAt)}</td>
      <td><button class="btn-icon btn-icon--danger" onclick="deletePhysical('${s.id}')" title="Remover"><i class="bi bi-trash"></i></button></td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--warm-gray)">Nenhuma venda no período selecionado.</td></tr>`;
}

function deletePhysical(id) {
  if (!confirm2('Remover este registro de venda?')) return;
  const physical = (DB.get('physical') || []).filter(s=>s.id!==id);
  DB.set('physical', physical);
  renderPhysicalSales();
  toast('Venda removida.', 'info');
}

// Live total preview
function updateSalePreview() {
  const qty   = parseFloat(document.getElementById('ps-qty')?.value)      || 0;
  const price = parseFloat(document.getElementById('ps-price')?.value)    || 0;
  const disc  = parseFloat(document.getElementById('ps-discount')?.value) || 0;
  const total = Math.max(0, qty * price - disc);
  const el = document.getElementById('sale-total-val');
  if (el) el.textContent = fmtBRL(total);
}
document.addEventListener('input', e => {
  if (['ps-qty','ps-price','ps-discount'].includes(e.target?.id)) updateSalePreview();
});


// ── METRICS / CHARTS ──────────────────────────────────────────
let charts = {};

function renderMetrics() {
  const orders   = DB.get('orders')   || [];
  const physical = DB.get('physical') || [];
  const year     = parseInt(document.getElementById('metrics-year')?.value || new Date().getFullYear());
  const MONTHS   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Monthly revenue arrays
  const onlineMonthly   = Array(12).fill(0);
  const physicalMonthly = Array(12).fill(0);
  const ordersMonthly   = Array(12).fill(0);

  orders.filter(o=>o.status!=='cancelled' && new Date(o.createdAt).getFullYear()===year).forEach(o=>{
    const m = new Date(o.createdAt).getMonth();
    onlineMonthly[m]  += o.total;
    ordersMonthly[m]  += 1;
  });
  physical.filter(p=>new Date(p.createdAt).getFullYear()===year).forEach(p=>{
    const m = new Date(p.createdAt).getMonth();
    physicalMonthly[m] += p.total;
  });

  const totalRevOnline  = onlineMonthly.reduce((a,b)=>a+b,0);
  const totalRevPhysical= physicalMonthly.reduce((a,b)=>a+b,0);
  const totalOrders     = ordersMonthly.reduce((a,b)=>a+b,0);
  const avgTicket       = totalOrders>0 ? (totalRevOnline/totalOrders) : 0;

  // Metric KPIs
  document.getElementById('metrics-kpi').innerHTML = `
    <div class="kpi-card kpi-card--rose">
      <div class="kpi-card__icon"><i class="bi bi-currency-dollar"></i></div>
      <p class="kpi-card__label">Receita Online ${year}</p>
      <div class="kpi-card__value">${fmtBRL(totalRevOnline)}</div>
      <span class="kpi-card__delta kpi-card__delta--up">${totalOrders} pedidos</span>
    </div>
    <div class="kpi-card kpi-card--deep">
      <div class="kpi-card__icon"><i class="bi bi-shop"></i></div>
      <p class="kpi-card__label">Receita Física ${year}</p>
      <div class="kpi-card__value">${fmtBRL(totalRevPhysical)}</div>
      <span class="kpi-card__delta kpi-card__delta--up">${physical.filter(p=>new Date(p.createdAt).getFullYear()===year).length} vendas</span>
    </div>
    <div class="kpi-card kpi-card--gold">
      <div class="kpi-card__icon"><i class="bi bi-graph-up"></i></div>
      <p class="kpi-card__label">Ticket Médio Online</p>
      <div class="kpi-card__value">${fmtBRL(avgTicket)}</div>
      <span class="kpi-card__delta kpi-card__delta--flat">Por pedido</span>
    </div>
    <div class="kpi-card kpi-card--green">
      <div class="kpi-card__icon"><i class="bi bi-trophy"></i></div>
      <p class="kpi-card__label">Total Consolidado</p>
      <div class="kpi-card__value">${fmtBRL(totalRevOnline+totalRevPhysical)}</div>
      <span class="kpi-card__delta kpi-card__delta--up">Online + Física</span>
    </div>
  `;

  const palette = {
    rose:     'rgba(212,103,154,1)',
    roseA:    'rgba(212,103,154,0.18)',
    deep:     'rgba(155,48,104,1)',
    deepA:    'rgba(155,48,104,0.15)',
    gold:     'rgba(196,149,106,1)',
    goldA:    'rgba(196,149,106,0.18)',
    green:    'rgba(16,185,129,1)',
    greenA:   'rgba(16,185,129,0.15)',
    blue:     'rgba(59,130,246,1)',
    blueA:    'rgba(59,130,246,0.15)',
    purple:   'rgba(139,92,246,1)',
  };

  const chartDefaults = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend:{ labels:{ font:{family:'Raleway',size:11}, boxWidth:12, padding:16 } } },
    animation: { duration:600 },
  };

  function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  // ── Revenue bar chart
  destroyChart('revenue');
  charts.revenue = new Chart(document.getElementById('chart-revenue'), {
    type:'bar',
    data: {
      labels: MONTHS,
      datasets: [
        { label:'Online', data:onlineMonthly,   backgroundColor:palette.roseA, borderColor:palette.rose,  borderWidth:2, borderRadius:6 },
        { label:'Física', data:physicalMonthly, backgroundColor:palette.goldA, borderColor:palette.gold,  borderWidth:2, borderRadius:6 },
      ]
    },
    options: { ...chartDefaults, scales:{ y:{ ticks:{ callback:v=>'R$'+v.toLocaleString('pt-BR') }, grid:{ color:'rgba(212,103,154,.1)' } }, x:{ grid:{ display:false } } } },
  });

  // ── Channel doughnut
  destroyChart('channel');
  charts.channel = new Chart(document.getElementById('chart-channel'), {
    type:'doughnut',
    data: {
      labels:['Online','Loja Física'],
      datasets:[{ data:[totalRevOnline, totalRevPhysical], backgroundColor:[palette.rose, palette.gold], borderWidth:0, hoverOffset:6 }]
    },
    options: { ...chartDefaults, cutout:'65%' },
  });

  // ── Orders line chart
  destroyChart('ordersChart');
  charts.ordersChart = new Chart(document.getElementById('chart-orders'), {
    type:'line',
    data: {
      labels: MONTHS,
      datasets:[{ label:'Pedidos', data:ordersMonthly, borderColor:palette.deep, backgroundColor:palette.deepA, fill:true, tension:.4, pointBackgroundColor:palette.deep, pointRadius:4 }]
    },
    options: { ...chartDefaults, scales:{ y:{ ticks:{stepSize:1}, grid:{ color:'rgba(155,48,104,.08)' } }, x:{ grid:{display:false} } } },
  });

  // ── Top products horizontal bar
  const soldMap2 = {};
  orders.filter(o=>o.status!=='cancelled'&&new Date(o.createdAt).getFullYear()===year).forEach(o=>
    o.items.forEach(i=>{ soldMap2[i.name]=(soldMap2[i.name]||0)+(i.price*(i.qty||1)); })
  );
  physical.filter(p=>new Date(p.createdAt).getFullYear()===year).forEach(p=>{
    soldMap2[p.product]=(soldMap2[p.product]||0)+p.total;
  });
  const topProds = Object.entries(soldMap2).sort((a,b)=>b[1]-a[1]).slice(0,8);
  destroyChart('topProd');
  charts.topProd = new Chart(document.getElementById('chart-top-prod'), {
    type:'bar',
    data: {
      labels: topProds.map(([n])=>n.length>20?n.slice(0,20)+'…':n),
      datasets:[{ label:'Receita (R$)', data:topProds.map(([,v])=>v), backgroundColor:topProds.map((_,i)=>[palette.rose,palette.deep,palette.gold,palette.green,palette.blue,palette.purple,palette.rose,palette.deep][i]), borderRadius:6 }]
    },
    options: { ...chartDefaults, indexAxis:'y', scales:{ x:{ ticks:{callback:v=>'R$'+Number(v).toLocaleString('pt-BR')}, grid:{color:'rgba(212,103,154,.1)'} }, y:{grid:{display:false}} } },
  });

  // ── Payment methods
  const payMap = {};
  orders.filter(o=>o.status!=='cancelled').forEach(o=>{ payMap[o.payment]=(payMap[o.payment]||0)+o.total; });
  physical.forEach(p=>{ payMap[p.payment]=(payMap[p.payment]||0)+p.total; });
  const payEntries = Object.entries(payMap).sort((a,b)=>b[1]-a[1]);
  destroyChart('payment');
  charts.payment = new Chart(document.getElementById('chart-payment'), {
    type:'bar',
    data: {
      labels: payEntries.map(([k])=>PAYMENT_LABELS[k]||k),
      datasets:[{ label:'Total (R$)', data:payEntries.map(([,v])=>v), backgroundColor:[palette.rose,palette.deep,palette.gold,palette.green,palette.blue], borderRadius:6 }]
    },
    options: { ...chartDefaults, scales:{ y:{ticks:{callback:v=>'R$'+Number(v).toLocaleString('pt-BR')},grid:{color:'rgba(212,103,154,.1)'}}, x:{grid:{display:false}} } },
  });

  // ── Category breakdown
  const catMap = {};
  orders.filter(o=>o.status!=='cancelled').forEach(o=>o.items.forEach(i=>{
    const prod = (DB.get('products')||[]).find(p=>p.name===i.name);
    const cat = prod?.category || 'outros';
    catMap[cat]=(catMap[cat]||0)+(i.price*(i.qty||1));
  }));
  physical.forEach(p=>{ catMap[p.category]=(catMap[p.category]||0)+p.total; });
  const CAT_LABELS2 = {vestidos:'Vestidos',blusas:'Blusas',conjuntos:'Conjuntos',calcas:'Calças',blazers:'Blazers',acessorios:'Acessórios',outros:'Outros'};
  const catEntries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  destroyChart('category');
  charts.category = new Chart(document.getElementById('chart-category'), {
    type:'doughnut',
    data: {
      labels: catEntries.map(([k])=>CAT_LABELS2[k]||k),
      datasets:[{ data:catEntries.map(([,v])=>v), backgroundColor:[palette.rose,palette.deep,palette.gold,palette.green,palette.blue,palette.purple,palette.rose], borderWidth:0, hoverOffset:8 }]
    },
    options: { ...chartDefaults, cutout:'55%' },
  });
}


// ── CUSTOMERS ─────────────────────────────────────────────────
function renderCustomers() {
  const orders = DB.get('orders') || [];
  const search = (document.getElementById('customer-search')?.value || '').toLowerCase();

  // Group by email
  const custMap = {};
  orders.forEach(o => {
    const k = o.customer.email;
    if (!custMap[k]) {
      custMap[k] = { ...o.customer, orders:0, totalSpent:0, lastOrder:o.createdAt };
    }
    if (o.status !== 'cancelled') {
      custMap[k].orders++;
      custMap[k].totalSpent += o.total;
    }
    if (new Date(o.createdAt) > new Date(custMap[k].lastOrder)) {
      custMap[k].lastOrder = o.createdAt;
    }
  });

  let customers = Object.values(custMap);
  if (search) customers = customers.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.email.toLowerCase().includes(search) ||
    c.phone.includes(search)
  );
  customers.sort((a,b) => b.totalSpent - a.totalSpent);

  document.getElementById('customers-tbody').innerHTML = customers.length ? customers.map((c,i) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--rose),var(--rose-deep));color:#fff;display:grid;place-items:center;font-weight:600;font-size:14px;flex-shrink:0">${c.name[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:500">${c.name}</div>
            ${i===0?`<span class="badge badge--rose" style="font-size:9px;padding:2px 7px">✦ Top cliente</span>`:''}
          </div>
        </div>
      </td>
      <td>${c.email}</td>
      <td>${c.phone}</td>
      <td style="font-size:12px">${c.address.street}, ${c.address.city}/${c.address.state} <br><span style="color:var(--warm-gray)">${c.address.zip}</span></td>
      <td style="text-align:center;font-weight:600">${c.orders}</td>
      <td><strong style="color:var(--rose-deep)">${fmtBRL(c.totalSpent)}</strong></td>
      <td style="font-size:12px;white-space:nowrap">${fmtDate(c.lastOrder)}</td>
    </tr>
  `).join('') : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--warm-gray)">Nenhum cliente encontrado.</td></tr>`;
}


// ── INVENTORY ─────────────────────────────────────────────────
function renderInventory() {
  const products = DB.get('products') || [];
  const filter   = document.getElementById('inv-filter')?.value || 'all';
  const CAT_LABELS = {vestidos:'Vestidos',blusas:'Blusas',conjuntos:'Conjuntos',calcas:'Calças',blazers:'Blazers',acessorios:'Acessórios'};

  let list = products.filter(p => {
    const total = Object.values(p.stock).reduce((a,b)=>a+b,0);
    if (filter === 'low') return total <= 5 && total > 0;
    if (filter === 'out') return total === 0;
    return true;
  });

  document.getElementById('inventory-tbody').innerHTML = list.length ? list.map(p => {
    const total = Object.values(p.stock).reduce((a,b)=>a+b,0);
    const stockStatus = total === 0 ? 'out-stock' : total <= 5 ? 'low-stock' : 'active';
    const stockLabel  = total === 0 ? 'Esgotado'  : total <= 5 ? 'Baixo'    : 'OK';
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <img src="${p.image}" style="width:38px;height:48px;object-fit:cover;border-radius:4px;background:var(--nude)" onerror="this.style.opacity='.3'">
            <div>
              <div style="font-weight:500">${p.name}</div>
              <div style="font-size:11px;color:var(--warm-gray)">${p.id}</div>
            </div>
          </div>
        </td>
        <td>${CAT_LABELS[p.category]||p.category}</td>
        <td>${fmtBRL(p.price)}</td>
        <td><input type="number" class="stock-input" value="${p.stock.P||0}" min="0" onchange="updateStock('${p.id}','P',this.value)"></td>
        <td><input type="number" class="stock-input" value="${p.stock.M||0}" min="0" onchange="updateStock('${p.id}','M',this.value)"></td>
        <td><input type="number" class="stock-input" value="${p.stock.G||0}" min="0" onchange="updateStock('${p.id}','G',this.value)"></td>
        <td><strong>${total}</strong></td>
        <td><span class="badge badge--${stockStatus}">${stockLabel}</span></td>
        <td>
          <button class="btn-icon" onclick="openProductModal('${p.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--warm-gray)">Nenhum produto encontrado.</td></tr>`;
}

function updateStock(id, size, val) {
  const products = DB.get('products') || [];
  const idx = products.findIndex(p=>p.id===id);
  if (idx < 0) return;
  products[idx].stock[size] = parseInt(val) || 0;
  DB.set('products', products);
  toast(`Estoque atualizado — ${products[idx].name} (${size})`, 'success');
}


// ── SETTINGS ─────────────────────────────────────────────────
function loadSettings() {
  const cfg = DB.get('settings') || {};
  if (cfg.storeName)   document.getElementById('cfg-store-name').value = cfg.storeName;
  if (cfg.cnpj)        document.getElementById('cfg-cnpj').value = cfg.cnpj;
  if (cfg.phone)       document.getElementById('cfg-phone').value = cfg.phone;
  if (cfg.email)       document.getElementById('cfg-email').value = cfg.email;
  if (cfg.address)     document.getElementById('cfg-address').value = cfg.address;
  if (cfg.ig)          document.getElementById('cfg-ig').value = cfg.ig;
  if (cfg.freeShip)    document.getElementById('cfg-free-ship').value = cfg.freeShip;
  if (cfg.shipCost)    document.getElementById('cfg-ship-cost').value = cfg.shipCost;
  if (cfg.shipDays)    document.getElementById('cfg-ship-days').value = cfg.shipDays;
  if (cfg.adminName)   document.getElementById('cfg-admin-name').value = cfg.adminName;
  if (cfg.notifOrder  !== undefined) document.getElementById('cfg-notif-order').checked = cfg.notifOrder;
  if (cfg.notifStock  !== undefined) document.getElementById('cfg-notif-stock').checked = cfg.notifStock;
  if (cfg.notifReview !== undefined) document.getElementById('cfg-notif-review').checked = cfg.notifReview;
  if (cfg.notifDaily  !== undefined) document.getElementById('cfg-notif-daily').checked = cfg.notifDaily;
  renderCoupons();
}

function saveSettings(e, group) {
  e.preventDefault();
  const cfg = DB.get('settings') || {};
  if (group === 'store') {
    cfg.storeName = document.getElementById('cfg-store-name').value;
    cfg.cnpj      = document.getElementById('cfg-cnpj').value;
    cfg.phone     = document.getElementById('cfg-phone').value;
    cfg.email     = document.getElementById('cfg-email').value;
    cfg.address   = document.getElementById('cfg-address').value;
    cfg.ig        = document.getElementById('cfg-ig').value;
  }
  if (group === 'shipping') {
    cfg.freeShip = document.getElementById('cfg-free-ship').value;
    cfg.shipCost = document.getElementById('cfg-ship-cost').value;
    cfg.shipDays = document.getElementById('cfg-ship-days').value;
    cfg.coupons  = getCoupons();
  }
  if (group === 'account') {
    const n = document.getElementById('cfg-admin-name').value;
    const p1= document.getElementById('cfg-new-pass').value;
    const p2= document.getElementById('cfg-new-pass2').value;
    if (p1 && p1 !== p2) { toast('As senhas não coincidem.', 'error'); return; }
    if (n) cfg.adminName = n;
    if (p1) cfg.adminPass = p1;
  }
  if (group === 'notif') {
    cfg.notifOrder  = document.getElementById('cfg-notif-order').checked;
    cfg.notifStock  = document.getElementById('cfg-notif-stock').checked;
    cfg.notifReview = document.getElementById('cfg-notif-review').checked;
    cfg.notifDaily  = document.getElementById('cfg-notif-daily').checked;
  }
  DB.set('settings', cfg);
  toast('Configurações salvas com sucesso!', 'success');
}

function renderCoupons() {
  const cfg = DB.get('settings') || {};
  const coupons = cfg.coupons || [];
  document.getElementById('coupons-list').innerHTML = coupons.map((c,i)=>`
    <div class="coupon-item">
      <input type="text" class="form-input" value="${c.code}" placeholder="Código" data-ci="${i}" data-field="code" oninput="couponEdit(this)">
      <input type="number" class="form-input" value="${c.discount}" placeholder="%" style="max-width:70px" data-ci="${i}" data-field="discount" oninput="couponEdit(this)">
      <select class="form-select" style="max-width:90px" data-ci="${i}" data-field="type" onchange="couponEdit(this)">
        <option value="percent"${c.type==='percent'?' selected':''}> % </option>
        <option value="fixed"  ${c.type==='fixed'  ?' selected':''}>R$</option>
      </select>
      <button type="button" class="btn-icon btn-icon--danger" onclick="removeCoupon(${i})"><i class="bi bi-trash"></i></button>
    </div>
  `).join('');
}
function couponEdit(el) {
  const cfg = DB.get('settings') || {};
  const coupons = cfg.coupons || [];
  const i = el.dataset.ci; const f = el.dataset.field;
  if (!coupons[i]) coupons[i] = {};
  coupons[i][f] = el.value;
  cfg.coupons = coupons; DB.set('settings', cfg);
}
function getCoupons() {
  const inputs = document.querySelectorAll('.coupon-item');
  return [...inputs].map(row=>{
    const [code,,, type] = row.querySelectorAll('input,select');
    return { code: row.querySelectorAll('input')[0].value, discount: row.querySelectorAll('input')[1].value, type: row.querySelector('select').value };
  });
}
function addCoupon() {
  const cfg = DB.get('settings') || {};
  const coupons = cfg.coupons || [];
  coupons.push({ code:'', discount:10, type:'percent' });
  cfg.coupons = coupons; DB.set('settings', cfg);
  renderCoupons();
}
function removeCoupon(i) {
  const cfg = DB.get('settings') || {};
  const coupons = cfg.coupons || [];
  coupons.splice(i,1);
  cfg.coupons = coupons; DB.set('settings', cfg);
  renderCoupons();
}


// ── NOTIFICATIONS ─────────────────────────────────────────────
function renderNotifications() {
  const notifs = DB.get('notifications') || [];
  const list   = document.getElementById('notif-list');
  if (!notifs.length) {
    list.innerHTML = '<div class="notif-empty"><i class="bi bi-bell-slash" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3"></i>Nenhuma notificação</div>';
    return;
  }
  list.innerHTML = notifs.slice(0,10).map(n=>`
    <div class="notif-item ${n.unread?'unread':''}">
      <div class="notif-item__icon"><i class="bi ${n.icon||'bi-bell'}"></i></div>
      <div class="notif-item__body">
        <div class="notif-item__text">${n.text}</div>
        <div class="notif-item__time">${fmtDateTime(n.time)}</div>
      </div>
    </div>
  `).join('');
  const unread = notifs.filter(n=>n.unread).length;
  document.getElementById('notif-dot').style.display = unread > 0 ? 'block' : 'none';
}

function addNotification(text, icon='bi-bell') {
  const notifs = DB.get('notifications') || [];
  notifs.unshift({ id:'n'+uid(), text, time:now(), icon, unread:true });
  DB.set('notifications', notifs.slice(0,30));
  renderNotifications();
}

function clearNotifications() {
  const notifs = (DB.get('notifications')||[]).map(n=>({...n,unread:false}));
  DB.set('notifications', notifs);
  renderNotifications();
  document.getElementById('notif-dot').style.display = 'none';
}


// ── Init page ─────────────────────────────────────────────────
goTo('dashboard');
