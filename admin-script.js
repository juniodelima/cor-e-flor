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
let adminUser = sessionStorage.getItem('cf_admin_user') || 'Admin';

// Async Supabase session verification
(async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { sessionStorage.clear(); window.location.href = 'admin-login.html'; return; }
    const profile = await Auth.profile(session.user.id);
    if (!profile || !profile.is_admin) {
      await sb.auth.signOut(); sessionStorage.clear();
      window.location.href = 'admin-login.html'; return;
    }
    adminUser = profile.name || session.user.email;
    sessionStorage.setItem('cf_admin_user', adminUser);
    document.getElementById('header-name').textContent   = adminUser;
    document.getElementById('dash-name').textContent     = adminUser;
    document.getElementById('header-avatar').textContent = adminUser[0].toUpperCase();
  } catch(e) { /* session check failed silently */ }
})();

// ── Storage helper ────────────────────────────────────────────
const DB = {
  get: k  => JSON.parse(localStorage.getItem(`cf_${k}`) || 'null'),
  set: (k,v) => localStorage.setItem(`cf_${k}`, JSON.stringify(v)),
};

// ── AI Studio state ───────────────────────────────────────────
let aiStudioState = { open:false, referenceImages:[], generatedImages:[], selectedImages:[], generationSlots:[{type:'flatlay',count:1}] };
function resetAIStudio() {
  aiStudioState = { open:false, referenceImages:[], generatedImages:[], selectedImages:[], generationSlots:[{type:'flatlay',count:1}] };
}

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

const STATUSES = ['novo','em_preparo','enviado','entregue','cancelado'];
const STATUS_LABELS = { novo:'Aguardando', confirmado:'Confirmado', em_preparo:'Em preparo', enviado:'Enviado', entregue:'Entregue', cancelado:'Cancelado' };
const STATUS_CSS    = { novo:'pending', confirmado:'processing', em_preparo:'processing', enviado:'shipped', entregue:'delivered', cancelado:'cancelled' };
const PAYMENT_LABELS = { credit_card:'Cartão Crédito', debit_card:'Cartão Débito', pix:'Pix', boleto:'Boleto', dinheiro:'Dinheiro', credito:'Cartão Crédito', debito:'Cartão Débito' };

// ── Cache Supabase ────────────────────────────────────────────
const _cache = { orders: [], physical: [] };

function _normOrder(o) {
  return {
    id: 'CF-' + o.id.slice(0,8).toUpperCase(), _id: o.id,
    customer: {
      name: o.customer_name||'', email: o.customer_email||'', phone: o.customer_phone||'',
      address: {
        street: [o.address?.rua, o.address?.num].filter(Boolean).join(', '),
        neighborhood: o.address?.bairro||'', city: o.address?.cidade||'',
        state: o.address?.estado||'', zip: o.address?.cep||'',
      },
    },
    items: (o.items||[]).map(i=>({name:i.name||'—',qty:i.qty||1,price:i.price||0,size:i.size||''})),
    total: Number(o.total)||0, payment: 'credit_card',
    status: o.status||'novo', notes: o.notes||'', createdAt: o.created_at,
  };
}
function _normPhysical(s) {
  return {
    id: 'FS-'+s.id.slice(0,8).toUpperCase(), _id: s.id,
    product: s.product||'', category: s.category||'outros',
    quantity: s.quantity||1, unitPrice: Number(s.unit_price)||0,
    discount: Number(s.discount)||0, total: Number(s.total)||0,
    payment: s.payment||'dinheiro', seller: s.seller||'', customer: s.customer||'',
    details: s.details||'', notes: s.notes||'', createdAt: s.created_at,
  };
}
async function loadOrders() {
  const { data } = await sb.from('orders').select('*').order('created_at',{ascending:false});
  _cache.orders = (data||[]).map(_normOrder);
}
async function loadPhysical() {
  const { data } = await sb.from('physical_sales').select('*').order('created_at',{ascending:false});
  _cache.physical = (data||[]).map(_normPhysical);
}

// --- dados fictícios removidos, agora usa Supabase ---
const _SAMPLE_ORDERS_REMOVED = [
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

// vendas físicas fictícias removidas — agora vêm do Supabase (physical_sales)

// Mapeia categorias do catálogo da loja para os slugs do admin
function _normCat(cat) {
  if (!cat) return 'outros';
  const c = cat.toLowerCase();
  if (['vestidos','blusas','conjuntos','calcas','blazers','acessorios'].includes(c)) return c;
  if (c.includes('vest') || c.includes('saia')) return 'vestidos';
  if (c.includes('blazer') || c.includes('colete')) return 'blazers';
  if (c.includes('calç') || c.includes('calc') || c.includes('short') || c.includes('jeans')) return 'calcas';
  if (c.includes('conj') || c.includes('macac') || c.includes('look')) return 'conjuntos';
  return 'blusas'; // blusa, body, regata, cropped, top, tule, corset, tricot
}

// ── Init ──────────────────────────────────────────────────────
function initData() {
  const stored = DB.get('products');
  if (!stored || stored.length === 0) {
    // Usa os produtos reais do catálogo da loja como fonte inicial
    const source = (typeof products !== 'undefined' && products.length > 0) ? products : SAMPLE_PRODUCTS;
    DB.set('products', source.map(p => ({
      id:            String(p.id),
      name:          p.name || '',
      category:      _normCat(p.category),
      price:         Number(p.price)         || 0,
      originalPrice: Number(p.originalPrice) || 0,
      image:         p.image  || '',
      images:        p.images || (p.image ? [p.image] : []),
      description:   p.description || '',
      colors: Array.isArray(p.colors)
        ? p.colors.map(c => (typeof c === 'string' ? c : c.name))
        : [],
      sizes:         p.sizes  || [],
      stock:         p.stock  || { P:0, M:0, G:0, GG:0 },
      status:        p.status || 'active',
      createdAt:     p.createdAt || now(),
    })));
  }
  if (!DB.get('notifications')) DB.set('notifications', []);
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

  // lazy render — dados reais do Supabase
  if (sec === 'dashboard') Promise.all([loadOrders(), loadPhysical()]).then(renderDashboard);
  if (sec === 'orders')    loadOrders().then(renderOrders);
  if (sec === 'products')  renderProducts();
  if (sec === 'physical')  loadPhysical().then(() => { populateCatalogSelect(); renderPhysicalSales(); updateSalePreview(); });
  if (sec === 'metrics')   Promise.all([loadOrders(), loadPhysical()]).then(() => setTimeout(renderMetrics, 50));
  if (sec === 'customers') loadOrders().then(renderCustomers);
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
document.getElementById('btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  sessionStorage.clear();
  window.location.href = 'admin-login.html';
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
  const orders   = _cache.orders;
  const physical = _cache.physical;
  const products = DB.get('products') || [];

  const onlineTotal  = orders.filter(o=>o.status!=='cancelado').reduce((s,o)=>s+o.total, 0);
  const physicalTotal= physical.reduce((s,p)=>s+p.total, 0);
  const totalRevenue = onlineTotal + physicalTotal;
  const pendingOrders= orders.filter(o=>o.status==='novo').length;
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
      <span class="kpi-card__delta kpi-card__delta--flat">${orders.filter(o=>o.status!=='cancelado').length} pedidos confirmados</span>
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
        <span class="badge badge--${STATUS_CSS[o.status]||o.status}">${STATUS_LABELS[o.status]||o.status}</span>
      </div>
    </div>
  `).join('') || '<p style="color:var(--warm-gray);font-size:13px;padding:12px 0">Nenhum pedido ainda.</p>';

  // Top products
  const soldMap = {};
  orders.filter(o=>o.status!=='cancelado').forEach(o => {
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
  const orders = _cache.orders;
  const pending = orders.filter(o=>o.status==='novo').length;
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
  const orders  = _cache.orders;
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
      <td><span class="badge badge--${STATUS_CSS[o.status]||o.status}"><span class="status-dot status-dot--${STATUS_CSS[o.status]||o.status}"></span> ${STATUS_LABELS[o.status]||o.status}</span></td>
      <td style="white-space:nowrap;font-size:12px">${fmtDateTime(o.createdAt)}</td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" title="Ver detalhes" onclick="openOrderDetail('${o._id}')"><i class="bi bi-eye"></i></button>
          <select class="status-select" onchange="updateOrderStatus('${o._id}',this.value)" title="Alterar status">
            ${STATUSES.map(s=>`<option value="${s}"${o.status===s?' selected':''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--warm-gray)">Nenhum pedido encontrado.</td></tr>`;
}

async function updateOrderStatus(supabaseId, status) {
  const { error } = await sb.from('orders').update({ status }).eq('id', supabaseId);
  if (error) { toast('Erro ao atualizar status: ' + error.message, 'error'); return; }
  const o = _cache.orders.find(x => x._id === supabaseId);
  const shortId = o ? o.id : 'CF-' + supabaseId.slice(0,8).toUpperCase();
  if (o) o.status = status;
  toast(`${shortId} → ${STATUS_LABELS[status]}`, 'success');
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

function openOrderDetail(supabaseId) {
  const o = _cache.orders.find(o=>o._id===supabaseId);
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
            <button onclick="updateOrderStatus('${o._id}','${s}');closeModal();" class="${o.status===s?'btn-primary':'btn-outline'}" style="padding:8px 14px;font-size:11px">
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
  resetAIStudio();
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

      <p class="modal-section-label"><i class="bi bi-images"></i> Fotos do Produto</p>
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

      <div class="ai-studio-bar">
        <button type="button" class="ai-studio-bar__btn" onclick="toggleAIStudio()">
          <i class="bi bi-stars"></i>
          <span>Gerar mais fotos com IA</span>
          <i class="bi bi-chevron-down" id="ai-chev" style="margin-left:auto;transition:transform .3s"></i>
        </button>
      </div>
      <div class="ai-studio-panel" id="ai-studio-panel" style="display:none">
        <div class="ai-ref-section">
          <p class="form-label">Fotos de referência (até 3)</p>
          <div class="ai-ref-list" id="ai-ref-list">
            <button type="button" class="ai-ref-add-btn" onclick="document.getElementById('ai-ref-input').click()"><i class="bi bi-plus-lg"></i></button>
          </div>
          <input type="file" id="ai-ref-input" accept="image/*" multiple style="display:none" onchange="addAIRefImages(event)">
          <p style="font-size:11px;color:rgba(74,64,64,.45);margin-top:8px">Envie fotos reais do produto para a IA usar de referência.</p>
        </div>
        <div class="ai-slots-section">
          <div class="ai-slots-header">
            <p class="form-label" style="margin:0">O que gerar</p>
            <span id="ai-slots-total" class="ai-slots-total"></span>
          </div>
          <div id="ai-slots-container"></div>
        </div>
        <button type="button" class="ai-gen-btn" id="ai-gen-btn" onclick="generateWithAI()">
          <i class="bi bi-stars"></i> Gerar imagens com IA
        </button>
        <div id="ai-gen-status" style="display:none"></div>
        <div id="ai-results-section" style="display:none">
          <p class="form-label" style="margin-top:16px">Imagens geradas — clique para selecionar</p>
          <div class="ai-results-grid" id="ai-results-grid"></div>
        </div>
        <div id="ai-final-section" style="display:none">
          <p class="form-label" style="margin-top:16px">
            Fotos do produto <span class="ai-sel-badge" id="ai-sel-count">0</span>
            <small style="font-weight:400;color:rgba(74,64,64,.6)"> — ordene com as setas</small>
          </p>
          <div class="ai-final-list" id="ai-final-list"></div>
          <p class="ai-final-note">A 1ª foto será a principal exibida na loja.</p>
        </div>
      </div>

      <div class="modal-section-divider"><span>Informações do Produto</span></div>

      <div class="ai-context-group">
        <label class="form-label">Descreva o produto com suas palavras <span class="ai-context-hint">(a IA completa o resto)</span></label>
        <div class="ai-context-wrap">
          <input type="text" class="form-input" id="ai-product-context"
            placeholder="ex: calça de couro preta com cinto dourado, elegante para eventos...">
          <button type="button" class="ai-text-gen-btn" id="ai-text-btn" onclick="generateProductText()">
            <i class="bi bi-stars"></i> Gerar com IA
          </button>
        </div>
        <p class="ai-context-tip">Fale o que a imagem não mostra — a peça principal, material, estilo — a IA cria o título e descrição completos.</p>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label class="form-label">Nome do Produto *</label>
          <input type="text" class="form-input" id="pf-name" value="${p?.name||''}" required placeholder="ex: Vestido Floral Rosa">
        </div>
        <div class="form-group">
          <label class="form-label">Categoria *</label>
          <select class="form-select" id="pf-cat">
            ${[['vestidos','Vestidos & Saias'],['blusas','Blusas & Tops'],['conjuntos','Conjuntos'],['calcas','Calças'],['blazers','Blazers'],['acessorios','Acessórios']].map(([v,l])=>`<option value="${v}"${p?.category===v?' selected':''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Preço (R$) *</label>
          <input type="number" class="form-input" id="pf-price" value="${p?.price||''}" step="0.01" min="0" required placeholder="0,00">
        </div>
        <div class="form-group">
          <label class="form-label">Preço Original (R$)</label>
          <input type="number" class="form-input" id="pf-orig" value="${p?.originalPrice||''}" step="0.01" min="0" placeholder="Deixe 0 se não houver">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="form-input" id="pf-desc" rows="3" placeholder="Descreva o produto, tecido, caimento, ocasião de uso...">${p?.description||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Cores (separadas por vírgula)</label>
        <input type="text" class="form-input" id="pf-colors" value="${p?.colors?.join(', ')||''}" placeholder="Rosa, Azul, Preto">
      </div>

      <div class="modal-section-divider"><span>Tamanhos & Estoque</span></div>

      <div class="form-group">
        <label class="form-label">Tamanhos disponíveis</label>
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
  renderAISlots();
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

// ── AI STUDIO FUNCTIONS ───────────────────────────────────────

function getOpenAIKey() {
  return (DB.get('settings') || {}).openaiKey || '';
}

function toggleAIStudio() {
  aiStudioState.open = !aiStudioState.open;
  const panel = document.getElementById('ai-studio-panel');
  const chev  = document.getElementById('ai-chev');
  if (!panel) return;
  panel.style.display = aiStudioState.open ? 'block' : 'none';
  if (chev) chev.style.transform = aiStudioState.open ? 'rotate(180deg)' : '';
}

function addAIRefImages(e) {
  const maxMore = 3 - aiStudioState.referenceImages.length;
  const files = [...e.target.files].slice(0, maxMore);
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = ev => {
      aiStudioState.referenceImages.push({ dataUrl: ev.target.result, name: f.name });
      renderAIRefImages();
    };
    reader.readAsDataURL(f);
  });
  e.target.value = '';
}

function renderAIRefImages() {
  const list = document.getElementById('ai-ref-list');
  if (!list) return;
  list.innerHTML = aiStudioState.referenceImages.map((img, i) => `
    <div class="ai-ref-thumb-wrap">
      <img src="${img.dataUrl}" class="ai-ref-thumb" alt="">
      <button type="button" class="ai-ref-remove" onclick="removeAIRefImage(${i})">
        <i class="bi bi-x"></i>
      </button>
    </div>
  `).join('');
  if (aiStudioState.referenceImages.length < 3) {
    list.innerHTML += `<button type="button" class="ai-ref-add-btn" onclick="document.getElementById('ai-ref-input').click()">
      <i class="bi bi-plus-lg"></i>
    </button>`;
  }
}

function removeAIRefImage(idx) {
  aiStudioState.referenceImages.splice(idx, 1);
  renderAIRefImages();
}

function setAIType(type) {
  document.querySelectorAll('.ai-type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type)
  );
}

async function generateWithAI() {
  const key = getOpenAIKey();
  if (!key) { toast('Configure a chave API OpenAI em Configurações → Estúdio IA.', 'error'); return; }

  const PROMPTS = {
    flatlay:   'Professional fashion product photography. Clothing item displayed hanging on a wooden hanger against a clean warm cream background. Studio lighting. High-end Brazilian fashion brand Cor & Flor. Ultra detailed, editorial quality.',
    modelo:    'Professional Brazilian fashion photography. A stylish woman with natural makeup wearing this clothing item. Confident elegant pose. Neutral studio background. Premium fashion brand look. High quality.',
    editorial: 'Editorial fashion photography for Brazilian women\'s fashion brand Cor & Flor. Artistic composition with rose and cream tones. Luxurious feminine aesthetic. Premium quality.',
  };
  const cfg     = DB.get('settings') || {};
  const quality = cfg.aiQuality || 'medium';
  const slots   = aiStudioState.generationSlots;
  const total   = slots.reduce((s, sl) => s + sl.count, 0);
  const genBtn  = document.getElementById('ai-gen-btn');
  const statusEl= document.getElementById('ai-gen-status');

  if (genBtn)   { genBtn.disabled = true; genBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Gerando...'; }
  if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = `<div class="ai-loading"><div class="ai-spinner"></div> Gerando ${total} foto${total>1?'s':''} com IA… isso leva cerca de ${total * 15} segundos.</div>`; }

  const hasRef = aiStudioState.referenceImages.length > 0;
  let refBlob = null;
  if (hasRef) {
    refBlob = await fetch(aiStudioState.referenceImages[0].dataUrl).then(r => r.blob());
  }

  async function callAPI(slotType, count) {
    if (hasRef) {
      const fd = new FormData();
      fd.append('model', 'gpt-image-1');
      fd.append('prompt', PROMPTS[slotType]);
      fd.append('n', String(count));
      fd.append('size', '1024x1024');
      fd.append('quality', quality);
      fd.append('image[]', refBlob, 'reference.png');
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method:'POST', headers:{'Authorization':`Bearer ${key}`}, body:fd
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      return (await res.json()).data;
    } else {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method:'POST',
        headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
        body: JSON.stringify({ model:'gpt-image-1', prompt:PROMPTS[slotType], n:count, size:'1024x1024', quality, output_format:'b64_json' })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      return (await res.json()).data;
    }
  }

  try {
    const allImages = [];
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i];
      if (statusEl) statusEl.innerHTML = `<div class="ai-loading"><div class="ai-spinner"></div> Gerando tipo ${i+1}/${slots.length}: ${AI_TYPE_LABELS[sl.type]}…</div>`;
      const imgs = await callAPI(sl.type, sl.count);
      imgs.forEach(d => allImages.push({ url: d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url, type: sl.type }));
    }
    aiStudioState.generatedImages = allImages.map(x => x.url);
    if (statusEl) statusEl.style.display = 'none';
    renderAIGeneratedImages();
    toast(`${allImages.length} imagem${allImages.length>1?'s':''} gerada${allImages.length>1?'s':''}! Clique para selecionar.`, 'success');
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<div class="ai-error"><i class="bi bi-x-circle"></i> Erro: ${err.message}</div>`;
    toast('Erro ao gerar: ' + err.message, 'error');
  } finally {
    if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<i class="bi bi-stars"></i> Gerar imagens com IA'; }
  }
}

function renderAIGeneratedImages() {
  const section = document.getElementById('ai-results-section');
  const grid    = document.getElementById('ai-results-grid');
  if (!section || !grid) return;
  section.style.display = 'block';
  const genHtml = aiStudioState.generatedImages.map((url, i) => {
    const sel = aiStudioState.selectedImages.includes(url);
    return `<div class="ai-result-item${sel?' selected':''}" id="ai-gen-item-${i}" onclick="toggleAIImageSelect('gen',${i})">
      <img src="${url}" alt="Gerada ${i+1}">
      <div class="ai-result-check"><i class="bi bi-check-lg"></i></div>
      <div class="ai-result-label">Gerada ${i+1}</div>
      <button type="button" class="ai-preview-btn" onclick="event.stopPropagation();showImagePreview('gen',${i})" title="Visualizar foto">
        <i class="bi bi-eye"></i>
      </button>
    </div>`;
  }).join('');
  const refHtml = aiStudioState.referenceImages.length > 0
    ? `<div class="ai-result-divider" style="grid-column:1/-1">Fotos de referência</div>` +
      aiStudioState.referenceImages.map((img, i) => {
        const sel = aiStudioState.selectedImages.includes(img.dataUrl);
        return `<div class="ai-result-item${sel?' selected':''}" id="ai-ref-item-${i}" onclick="toggleAIImageSelect('ref',${i})">
          <img src="${img.dataUrl}" alt="Ref ${i+1}">
          <div class="ai-result-check"><i class="bi bi-check-lg"></i></div>
          <div class="ai-result-label">Referência ${i+1}</div>
          <button type="button" class="ai-preview-btn" onclick="event.stopPropagation();showImagePreview('ref',${i})" title="Visualizar foto">
            <i class="bi bi-eye"></i>
          </button>
        </div>`;
      }).join('')
    : '';
  grid.innerHTML = genHtml + refHtml;
}

function showImagePreview(source, idx) {
  const url   = source === 'gen'
    ? aiStudioState.generatedImages[idx]
    : aiStudioState.referenceImages[idx].dataUrl;
  const label = source === 'gen' ? `Gerada ${idx + 1}` : `Referência ${idx + 1}`;

  let box = document.getElementById('ai-img-preview-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ai-img-preview-box';
    box.innerHTML = `
      <div class="ai-preview-overlay" onclick="closeImagePreview()"></div>
      <div class="ai-preview-content">
        <button type="button" class="ai-preview-close" onclick="closeImagePreview()"><i class="bi bi-x-lg"></i></button>
        <img id="ai-preview-img" src="" alt="">
        <p id="ai-preview-label"></p>
      </div>`;
    document.body.appendChild(box);
  }
  document.getElementById('ai-preview-img').src = url;
  document.getElementById('ai-preview-label').textContent = label;
  box.style.display = 'flex';

  const onKey = e => { if (e.key === 'Escape') { closeImagePreview(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

function closeImagePreview() {
  const box = document.getElementById('ai-img-preview-box');
  if (box) box.style.display = 'none';
}

function toggleAIImageSelect(source, idx) {
  const url = source === 'gen'
    ? aiStudioState.generatedImages[idx]
    : aiStudioState.referenceImages[idx].dataUrl;
  const pos = aiStudioState.selectedImages.indexOf(url);
  if (pos >= 0) aiStudioState.selectedImages.splice(pos, 1);
  else          aiStudioState.selectedImages.push(url);
  renderAIGeneratedImages();
  renderAIFinalImages();
}

function renderAIFinalImages() {
  const section  = document.getElementById('ai-final-section');
  const list     = document.getElementById('ai-final-list');
  const countEl  = document.getElementById('ai-sel-count');
  if (!section || !list) return;
  const imgs = aiStudioState.selectedImages;
  if (countEl) countEl.textContent = imgs.length;
  if (imgs.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = imgs.map((url, i) => `
    <div class="ai-final-item">
      <span class="ai-final-order">${i + 1}</span>
      <img src="${url}" alt="Foto ${i+1}">
      <div class="ai-final-arrows">
        ${i > 0 ? `<button type="button" class="ai-arrow-btn" onclick="moveAIImage(${i},-1)" title="Mover esquerda"><i class="bi bi-arrow-left"></i></button>` : '<span></span>'}
        ${i < imgs.length-1 ? `<button type="button" class="ai-arrow-btn" onclick="moveAIImage(${i},1)" title="Mover direita"><i class="bi bi-arrow-right"></i></button>` : '<span></span>'}
      </div>
      <button type="button" class="ai-final-remove" onclick="removeAIFinalImage(${i})" title="Remover"><i class="bi bi-x-lg"></i></button>
    </div>
  `).join('');
}

function moveAIImage(idx, dir) {
  const arr = aiStudioState.selectedImages;
  const t   = idx + dir;
  if (t < 0 || t >= arr.length) return;
  [arr[idx], arr[t]] = [arr[t], arr[idx]];
  renderAIFinalImages();
}

function removeAIFinalImage(idx) {
  aiStudioState.selectedImages.splice(idx, 1);
  renderAIGeneratedImages();
  renderAIFinalImages();
}

function toggleKeyVisibility() {
  const inp  = document.getElementById('cfg-openai-key');
  const icon = document.getElementById('key-eye-icon');
  if (!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  if (icon) { icon.className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye'; }
}

// ── AI SLOTS ──────────────────────────────────────────────────
const AI_TYPE_LABELS = {
  flatlay:   'Flat lay — peça em cabide',
  modelo:    'Na modelo — vestindo a peça',
  editorial: 'Editorial — foto artística',
};

function renderAISlots() {
  const container = document.getElementById('ai-slots-container');
  const totalEl   = document.getElementById('ai-slots-total');
  if (!container) return;

  const slots = aiStudioState.generationSlots;
  container.innerHTML = slots.map((slot, i) => `
    <div class="ai-slot-row">
      <select class="ai-slot-select" onchange="updateAISlot(${i},'type',this.value)">
        ${Object.entries(AI_TYPE_LABELS).map(([v,l]) =>
          `<option value="${v}"${slot.type===v?' selected':''}>${l}</option>`
        ).join('')}
      </select>
      <select class="ai-slot-qty" onchange="updateAISlot(${i},'count',+this.value)">
        ${[1,2,3].map(n => `<option value="${n}"${slot.count===n?' selected':''}>${n} foto${n>1?'s':''}</option>`).join('')}
      </select>
      ${slots.length > 1
        ? `<button type="button" class="ai-slot-remove" onclick="removeAISlot(${i})"><i class="bi bi-x"></i></button>`
        : '<span class="ai-slot-spacer"></span>'
      }
    </div>
  `).join('');

  if (slots.length < 4) {
    container.innerHTML += `<button type="button" class="ai-add-slot-btn" onclick="addAISlot()">
      <i class="bi bi-plus"></i> Adicionar outro tipo
    </button>`;
  }

  const total = slots.reduce((s, sl) => s + sl.count, 0);
  if (totalEl) totalEl.textContent = `${total} foto${total > 1 ? 's' : ''} no total`;
}

function addAISlot() {
  if (aiStudioState.generationSlots.length >= 4) return;
  aiStudioState.generationSlots.push({ type: 'modelo', count: 1 });
  renderAISlots();
}

function removeAISlot(idx) {
  aiStudioState.generationSlots.splice(idx, 1);
  renderAISlots();
}

function updateAISlot(idx, field, val) {
  aiStudioState.generationSlots[idx][field] = val;
  renderAISlots();
}

// ── AI TEXT GENERATION ────────────────────────────────────────
async function generateProductText() {
  const key = getOpenAIKey();
  if (!key) { toast('Configure a chave API OpenAI em Configurações → Estúdio IA.', 'error'); return; }

  const imageCtx = aiStudioState.selectedImages[0]
    || aiStudioState.referenceImages[0]?.dataUrl
    || window._pendingImgBase64
    || document.getElementById('pf-img-current')?.value
    || '';

  const userContext = (document.getElementById('ai-product-context')?.value || '').trim();

  const btn = document.getElementById('ai-text-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Gerando...'; }

  const contextLine = userContext
    ? `Informação da lojista sobre o produto: "${userContext}". Use isso como base principal — a IA deve complementar e enriquecer, não ignorar. `
    : '';

  const systemPrompt = 'Você é especialista em moda feminina brasileira premium. '
    + contextLine
    + 'Crie: '
    + '1) Um título comercial atraente para loja online (máx 55 caracteres, sem emoji, português) '
    + '2) Uma descrição persuasiva (2-3 frases: tecido, caimento, ocasião de uso). '
    + 'A loja se chama Cor & Flor, moda feminina premium de Brasília — DF. '
    + 'Responda APENAS com JSON válido: {"title":"...","description":"..."}';

  try {
    const content = imageCtx
      ? [{ type:'image_url', image_url:{ url: imageCtx } }, { type:'text', text: systemPrompt }]
      : systemPrompt + (!userContext && document.getElementById('pf-name')?.value ? ` Peça: ${document.getElementById('pf-name').value}.` : '');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role:'user', content }],
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || `HTTP ${res.status}`); }
    const data = await res.json();
    const json = JSON.parse(data.choices[0].message.content);

    const nameEl = document.getElementById('pf-name');
    const descEl = document.getElementById('pf-desc');
    if (nameEl && json.title)       { nameEl.value = json.title;       nameEl.classList.add('ai-filled'); setTimeout(() => nameEl.classList.remove('ai-filled'), 2500); }
    if (descEl && json.description) { descEl.value = json.description; descEl.classList.add('ai-filled'); setTimeout(() => descEl.classList.remove('ai-filled'), 2500); }
    toast('Título e descrição gerados! Edite à vontade antes de salvar.', 'success');
  } catch (err) {
    toast('Erro ao gerar texto: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-stars"></i> Gerar título e descrição com IA'; }
  }
}

// ─────────────────────────────────────────────────────────────

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
    images:        aiStudioState.selectedImages.length > 0
                     ? aiStudioState.selectedImages
                     : (window._pendingImgBase64
                         ? [window._pendingImgBase64]
                         : (p?.images || (p?.image ? [p.image] : []))),
    image:         aiStudioState.selectedImages[0] || window._pendingImgBase64 || document.getElementById('pf-img-current')?.value || '',
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

function restoreProductCatalog() {
  if (!confirm2(`Isso vai substituir os produtos atuais do painel pelos ${products.length} produtos do catálogo da loja. Continuar?`)) return;
  const source = (typeof products !== 'undefined' && products.length > 0) ? products : SAMPLE_PRODUCTS;
  DB.set('products', source.map(p => ({
    id:            String(p.id),
    name:          p.name || '',
    category:      _normCat(p.category),
    price:         Number(p.price)         || 0,
    originalPrice: Number(p.originalPrice) || 0,
    image:         p.image  || '',
    images:        p.images || (p.image ? [p.image] : []),
    description:   p.description || '',
    colors: Array.isArray(p.colors)
      ? p.colors.map(c => (typeof c === 'string' ? c : c.name))
      : [],
    sizes:         p.sizes  || [],
    stock:         p.stock  || { P:0, M:0, G:0, GG:0 },
    status:        p.status || 'active',
    createdAt:     p.createdAt || now(),
  })));
  renderProducts();
  toast(`${source.length} produtos do catálogo restaurados com sucesso!`, 'success');
}

function deleteProduct(id) {
  if (!confirm2('Excluir este produto? Esta ação não pode ser desfeita.')) return;
  const products = (DB.get('products') || []).filter(p=>p.id!==id);
  DB.set('products', products);
  renderProducts();
  toast('Produto removido.', 'info');
}


// ── BULK PRODUCT ENTRY ────────────────────────────────────────
const BULK_CATS = [
  ['vestidos','Vestidos & Saias'],
  ['blusas','Blusas & Tops'],
  ['conjuntos','Conjuntos'],
  ['calcas','Calças'],
  ['blazers','Blazers'],
  ['acessorios','Acessórios'],
];
let _bulkRowCount = 0;

function openBulkModal() {
  _bulkRowCount = 0;
  document.getElementById('bulk-rows-container').innerHTML = '';
  addBulkRow();
  document.getElementById('bulk-overlay').classList.add('open');
}

function closeBulkModal(e) {
  if (e && e.target !== document.getElementById('bulk-overlay')) return;
  document.getElementById('bulk-overlay').classList.remove('open');
}

function addBulkRow() {
  const idx = _bulkRowCount++;

  // Herda categoria do produto anterior para agilizar entrada de itens similares
  let prevCat = 'vestidos';
  if (idx > 0) {
    const prevSel = document.querySelector(`#bulk-row-${idx-1} .bulk-cat`);
    prevCat = prevSel?.value || 'vestidos';
  }

  const catOptions = BULK_CATS.map(([v,l]) =>
    `<option value="${v}"${v===prevCat?' selected':''}>${l}</option>`
  ).join('');

  const sizesHtml = ['P','M','G','GG'].map(s => `
    <div class="bulk-sz">
      <input type="checkbox" id="bsz-${idx}-${s}" class="bulk-sz-chk" value="${s}"
             onchange="toggleBulkSzStock(this)">
      <label class="bulk-sz-label" for="bsz-${idx}-${s}">${s}</label>
      <input type="number" class="bulk-stk-input" placeholder="0" min="0" disabled data-sz="${s}">
    </div>
  `).join('');

  const html = `
    <div class="bulk-row" id="bulk-row-${idx}">
      <div class="bulk-row__head">
        <span class="bulk-row__num"><i class="bi bi-tag"></i> Produto ${idx+1}</span>
        ${idx > 0 ? `<button type="button" class="bulk-row__del" onclick="removeBulkRow('bulk-row-${idx}')" title="Remover"><i class="bi bi-trash"></i></button>` : ''}
      </div>
      <div class="bulk-main-fields">
        <div class="bulk-fg">
          <label class="form-label">Nome *</label>
          <input type="text" class="form-input bulk-name" placeholder="ex: Vestido Floral Rosa"
                 oninput="updateBulkCount()" autocomplete="off">
        </div>
        <div class="bulk-fg">
          <label class="form-label">Categoria</label>
          <select class="form-select bulk-cat">${catOptions}</select>
        </div>
        <div class="bulk-fg">
          <label class="form-label">Preço R$ *</label>
          <input type="number" class="form-input bulk-price" placeholder="0,00"
                 step="0.01" min="0" oninput="updateBulkCount()">
        </div>
        <div class="bulk-fg">
          <label class="form-label">Original R$</label>
          <input type="number" class="form-input bulk-orig" placeholder="—" step="0.01" min="0">
        </div>
        <div class="bulk-fg">
          <label class="form-label">Status</label>
          <select class="form-select bulk-status">
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>
      <div class="bulk-sizes-strip">
        <span class="bulk-sizes-label">Tamanhos & Estoque:</span>
        ${sizesHtml}
      </div>
      <div class="bulk-img-row">
        <div class="bulk-fg">
          <label class="form-label">URL da Foto (opcional — pode adicionar depois)</label>
          <input type="text" class="form-input bulk-img" placeholder="https://..." oninput="previewBulkImg(this)">
        </div>
        <img class="bulk-img-preview" id="bulk-img-prev-${idx}" alt="">
      </div>
    </div>`;

  document.getElementById('bulk-rows-container').insertAdjacentHTML('beforeend', html);

  // Foca no nome do novo produto e rola até ele
  setTimeout(() => {
    const row = document.getElementById(`bulk-row-${idx}`);
    row?.querySelector('.bulk-name')?.focus();
    row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);

  updateBulkCount();
}

function toggleBulkSzStock(chk) {
  const stk = chk.closest('.bulk-sz').querySelector('.bulk-stk-input');
  stk.disabled = !chk.checked;
  if (chk.checked) {
    stk.value = stk.value || '0';
    stk.focus();
    stk.select();
  }
}

function removeBulkRow(rowId) {
  document.getElementById(rowId)?.remove();
  updateBulkCount();
}

function previewBulkImg(input) {
  const row = input.closest('.bulk-row');
  const prev = row?.querySelector('.bulk-img-preview');
  if (!prev) return;
  const url = input.value.trim();
  if (url) { prev.src = url; prev.style.display = 'block'; }
  else { prev.style.display = 'none'; }
}

function updateBulkCount() {
  const rows = document.querySelectorAll('#bulk-rows-container .bulk-row');
  let valid = 0;
  rows.forEach(row => {
    const name  = row.querySelector('.bulk-name')?.value.trim();
    const price = parseFloat(row.querySelector('.bulk-price')?.value);
    if (name && price > 0) valid++;
  });
  const btn = document.getElementById('bulk-save-btn');
  if (btn) btn.textContent = valid > 0
    ? `Salvar ${valid} produto${valid > 1 ? 's' : ''}`
    : 'Salvar produtos';
}

function saveBulkProducts() {
  const rows = document.querySelectorAll('#bulk-rows-container .bulk-row');
  const products = DB.get('products') || [];
  let saved = 0, skipped = 0;

  rows.forEach(row => {
    const name  = row.querySelector('.bulk-name')?.value.trim();
    const price = parseFloat(row.querySelector('.bulk-price')?.value);

    if (!name || !(price > 0)) {
      row.classList.add('bulk-row--error');
      skipped++;
      return;
    }
    row.classList.remove('bulk-row--error');

    const sizes = [];
    const stock = { P:0, M:0, G:0, GG:0 };
    row.querySelectorAll('.bulk-sz-chk:checked').forEach(chk => {
      sizes.push(chk.value);
      const stkInput = chk.closest('.bulk-sz').querySelector('.bulk-stk-input');
      stock[chk.value] = parseInt(stkInput?.value) || 0;
    });

    const imgUrl = row.querySelector('.bulk-img')?.value.trim() || '';

    products.push({
      id:            'P' + uid(),
      name,
      category:      row.querySelector('.bulk-cat')?.value || 'vestidos',
      price,
      originalPrice: parseFloat(row.querySelector('.bulk-orig')?.value) || 0,
      image:         imgUrl,
      images:        imgUrl ? [imgUrl] : [],
      description:   '',
      colors:        [],
      sizes,
      stock,
      status:        row.querySelector('.bulk-status')?.value || 'active',
      createdAt:     now(),
    });
    saved++;
  });

  if (saved === 0) {
    toast('Preencha pelo menos um produto com nome e preço.', 'error');
    return;
  }

  DB.set('products', products);
  renderProducts();
  document.getElementById('bulk-overlay').classList.remove('open');
  toast(`${saved} produto${saved > 1 ? 's cadastrados' : ' cadastrado'} com sucesso!`, 'success');
  if (skipped > 0)
    setTimeout(() => toast(`${skipped} linha${skipped > 1 ? 's ignoradas' : ' ignorada'} por falta de nome/preço.`, 'info'), 700);
}


// ── PHYSICAL SALES ────────────────────────────────────────────
async function submitPhysicalSale(e) {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('button[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  const isCatalog = document.querySelector('input[name="ps-prod-type"]:checked')?.value === 'catalog';
  const qty   = parseInt(document.getElementById('ps-qty').value)        || 1;
  const price = parseFloat(document.getElementById('ps-price').value)    || 0;
  const disc  = parseFloat(document.getElementById('ps-discount').value) || 0;

  if (price <= 0) {
    toast('Informe o valor unitário da venda.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; }
    return;
  }

  let productName, categoryVal, catalogProductId = null, saleSize = '';

  if (isCatalog) {
    const sel = document.getElementById('ps-catalog-select');
    if (!sel.value) { toast('Selecione um produto do catálogo.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; } return; }
    const p = products.find(x => x.id === Number(sel.value));
    if (!p) { toast('Produto não encontrado.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; } return; }
    productName      = p.name;
    categoryVal      = p.category;
    catalogProductId = String(p.id);
    saleSize         = document.getElementById('ps-size-select')?.value || '';
  } else {
    productName = document.getElementById('ps-product-new')?.value.trim();
    categoryVal = document.getElementById('ps-category')?.value || 'outros';
    if (!productName) { toast('Informe o nome do produto.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; } return; }
  }

  const total = Math.max(0, price * qty - disc);

  const record = {
    product:            productName,
    category:           categoryVal,
    catalog_product_id: catalogProductId,
    size:               saleSize,
    quantity:           qty,
    unit_price:         price,
    discount:           disc,
    total,
    payment:  document.getElementById('ps-payment').value,
    seller:   document.getElementById('ps-seller').value.trim() || null,
    customer: document.getElementById('ps-customer').value.trim() || null,
    details:  document.getElementById('ps-details').value.trim() || null,
    notes:    document.getElementById('ps-notes').value.trim() || null,
  };

  const { error } = await sb.from('physical_sales').insert(record);
  if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; }
  if (error) { toast('Erro ao salvar venda: ' + error.message, 'error'); return; }

  e.target.reset();
  document.getElementById('ps-qty').value = 1;
  document.getElementById('ps-discount').value = 0;
  togglePsType('catalog');
  populateCatalogSelect();
  updateSalePreview();
  await loadPhysical();
  renderPhysicalSales();
  toast(`Venda registrada — ${fmtBRL(total)} ✓`, 'success');
  addNotification(`Nova venda física: ${productName} — ${fmtBRL(total)}`, 'bi-shop');
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
  sel.innerHTML = '<option value="">— Selecione um produto —</option>' +
    products.map(p =>
      `<option value="${p.id}">${p.name} — ${fmtBRL(p.price)}</option>`
    ).join('');
}

function onCatalogSelect() {
  const id = document.getElementById('ps-catalog-select').value;
  const p  = products.find(x => x.id === Number(id));
  const sizeSelect = document.getElementById('ps-size-select');
  const stockInfo  = document.getElementById('ps-stock-info');
  const priceInput = document.getElementById('ps-price');

  if (!p) {
    sizeSelect.innerHTML  = '<option value="">Todos / Único</option>';
    if (stockInfo) stockInfo.textContent = 'Selecione um produto';
    if (priceInput) priceInput.value = '';
    updateSalePreview();
    return;
  }

  sizeSelect.innerHTML = '<option value="">Todos / Único</option>' +
    (p.sizes || []).map(sz => `<option value="${sz}">${sz}</option>`).join('');

  if (priceInput) priceInput.value = p.price;
  if (stockInfo) stockInfo.textContent = p.category || '';

  updateSalePreview();
}

function onSizeSelect() {
  // Stock data not tracked for site products
}

function renderPhysicalSales() {
  const physical = _cache.physical;
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
      <td><button class="btn-icon btn-icon--danger" onclick="deletePhysical('${s._id}')" title="Remover"><i class="bi bi-trash"></i></button></td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--warm-gray)">Nenhuma venda no período selecionado.</td></tr>`;
}

async function deletePhysical(supabaseId) {
  if (!confirm2('Remover este registro de venda?')) return;
  const { error } = await sb.from('physical_sales').delete().eq('id', supabaseId);
  if (error) { toast('Erro ao remover venda.', 'error'); return; }
  await loadPhysical();
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
  const orders   = _cache.orders;
  const physical = _cache.physical;
  const year     = parseInt(document.getElementById('metrics-year')?.value || new Date().getFullYear());
  const MONTHS   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Monthly revenue arrays
  const onlineMonthly   = Array(12).fill(0);
  const physicalMonthly = Array(12).fill(0);
  const ordersMonthly   = Array(12).fill(0);

  orders.filter(o=>o.status!=='cancelado' && new Date(o.createdAt).getFullYear()===year).forEach(o=>{
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
  orders.filter(o=>o.status!=='cancelado'&&new Date(o.createdAt).getFullYear()===year).forEach(o=>
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
  orders.filter(o=>o.status!=='cancelado').forEach(o=>{ payMap[o.payment]=(payMap[o.payment]||0)+o.total; });
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
  orders.filter(o=>o.status!=='cancelado').forEach(o=>o.items.forEach(i=>{
    const prod = products.find(p=>p.name===i.name);
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
  const orders = _cache.orders;
  const search = (document.getElementById('customer-search')?.value || '').toLowerCase();

  // Group by email
  const custMap = {};
  orders.forEach(o => {
    const k = o.customer.email;
    if (!custMap[k]) {
      custMap[k] = { ...o.customer, orders:0, totalSpent:0, lastOrder:o.createdAt };
    }
    if (o.status !== 'cancelado') {
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
  if (cfg.openaiKey)  document.getElementById('cfg-openai-key').value = cfg.openaiKey;
  if (cfg.aiQuality)  document.getElementById('cfg-ai-quality').value = cfg.aiQuality;
  renderCoupons();
  loadInvites();
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
  if (group === 'ai') {
    const k = document.getElementById('cfg-openai-key').value.trim();
    if (!k) { toast('Informe a chave API OpenAI.', 'error'); return; }
    cfg.openaiKey = k;
    cfg.aiQuality = document.getElementById('cfg-ai-quality').value;
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


// ── ADMIN INVITES ─────────────────────────────────────────────
async function loadInvites() {
  const list = document.getElementById('invites-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--warm-gray);font-size:13px;opacity:.7">Carregando...</p>';
  const { data, error } = await sb.from('admin_invites')
    .select('*').order('created_at', { ascending: false });
  if (error) {
    list.innerHTML = '<p style="color:#dc2626;font-size:13px">Erro ao carregar convites.</p>';
    return;
  }
  if (!data || !data.length) {
    list.innerHTML = '<p style="color:var(--warm-gray);font-size:13px;opacity:.6">Nenhum convite gerado ainda.</p>';
    return;
  }
  const base = window.location.origin + '/admin-register.html';
  list.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:1px solid rgba(212,103,154,.2)">
      <th style="text-align:left;padding:8px 0;color:var(--warm-gray);font-weight:500">Código</th>
      <th style="text-align:left;padding:8px 0;color:var(--warm-gray);font-weight:500">Status</th>
      <th style="text-align:left;padding:8px 0;color:var(--warm-gray);font-weight:500">Expira</th>
      <th style="padding:8px 0"></th>
    </tr></thead>
    <tbody>${data.map(inv => `
      <tr style="border-bottom:1px solid rgba(212,103,154,.06)">
        <td style="padding:10px 0"><code style="background:rgba(212,103,154,.1);padding:3px 8px;border-radius:6px;font-size:12px;letter-spacing:1px">${inv.code}</code></td>
        <td style="padding:10px 0">${inv.used
          ? '<span style="color:#16a34a;font-size:12px">✓ Usado</span>'
          : '<span style="color:var(--rose);font-size:12px">● Disponível</span>'
        }</td>
        <td style="padding:10px 0;color:var(--warm-gray);font-size:12px">${fmtDate(inv.expires_at)}</td>
        <td style="padding:10px 0">
          <div style="display:flex;gap:6px;justify-content:flex-end">
            ${!inv.used ? `<button onclick="copyInviteLink('${inv.code}')" style="background:rgba(212,103,154,.12);border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--rose)"><i class='bi bi-link-45deg'></i> Copiar link</button>` : ''}
            <button onclick="deleteInvite('${inv.id}')" style="background:rgba(239,68,68,.08);border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:#dc2626"><i class='bi bi-trash'></i></button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
}

function _mkInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

async function generateInvite() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const code = _mkInviteCode();
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('admin_invites').insert({ code, created_by: session.user.id, expires_at });
  if (error) { toast('Erro ao gerar convite: ' + error.message, 'error'); return; }
  toast('Convite gerado: ' + code, 'success');
  loadInvites();
}

function copyInviteLink(code) {
  const url = window.location.origin + '/admin-register.html?code=' + code;
  navigator.clipboard.writeText(url)
    .then(() => toast('Link copiado para a área de transferência!', 'success'))
    .catch(() => toast('Link: ' + url, 'info'));
}

async function deleteInvite(id) {
  if (!confirm2('Remover este convite? A ação não pode ser desfeita.')) return;
  const { error } = await sb.from('admin_invites').delete().eq('id', id);
  if (error) { toast('Erro ao remover convite.', 'error'); return; }
  loadInvites();
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
