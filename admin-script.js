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

/* ── Storage helper ────────────────────────────────────────────
   'products' e 'settings' moram no Supabase: são os dados que precisam
   valer para todos os administradores e para a loja. Ficam em memória
   durante a sessão (por isso o get continua síncrono, como o resto do
   painel espera) e cada gravação é espelhada no banco.

   'notifications' e a chave da OpenAI seguem no navegador — são coisas
   de quem está usando o painel naquele computador. */
const _mem = { products: null, settings: null };
let _nuvemPronta = false;   // trava gravações até a primeira leitura do banco

const DB = {
  get(k) {
    if (k === 'products') return _mem.products;
    if (k === 'settings') return _mem.settings;
    return JSON.parse(localStorage.getItem(`cf_${k}`) || 'null');
  },
  set(k, v) {
    if (k === 'products') {
      _mem.products = v;
      // Sem a tabela no banco, o painel volta a guardar no navegador
      if (!CatalogDB.disponivel) return _gravarLocal('products', v);
      if (_nuvemPronta) salvarProdutosNaNuvem(v);
      return true;
    }
    if (k === 'settings') {
      _mem.settings = v;
      if (_nuvemPronta) salvarConfigNaNuvem(v);
      return true;
    }
    return _gravarLocal(k, v);
  },
};

// O navegador reserva um espaço limitado por site. Com várias fotos por
// produto dá para encher — nesse caso avisa em vez de falhar em silêncio.
function _gravarLocal(k, v) {
  try {
    localStorage.setItem(`cf_${k}`, JSON.stringify(v));
    return true;
  } catch (e) {
    toast('Espaço do navegador cheio — remova algumas fotos de produtos antigos e tente de novo.', 'error');
    return false;
  }
}

/* Cópia do que está no banco, para gravar só o que mudou de verdade */
let _snapshotNuvem = {};

function _assinatura(p) {
  const row = CatalogDB.toRow(p);
  delete row.updated_at;          // muda a cada gravação, não serve para comparar
  return JSON.stringify(row);
}

async function salvarProdutosNaNuvem(lista) {
  if (!CatalogDB.disponivel) return;
  const alterados = [];
  const idsAgora = new Set();

  for (const p of lista || []) {
    const id = String(p.id);
    idsAgora.add(id);
    const assin = _assinatura(p);
    if (_snapshotNuvem[id] !== assin) { alterados.push(p); _snapshotNuvem[id] = assin; }
  }
  const removidos = Object.keys(_snapshotNuvem).filter(id => !idsAgora.has(id));
  removidos.forEach(id => delete _snapshotNuvem[id]);

  try {
    if (alterados.length) {
      const { error } = await CatalogDB.upsert(alterados);
      if (error) throw error;
    }
    if (removidos.length) {
      const { error } = await CatalogDB.remove(removidos);
      if (error) throw error;
    }
  } catch (e) {
    // Snapshot volta ao estado anterior para tentar de novo na próxima gravação
    alterados.forEach(p => { delete _snapshotNuvem[String(p.id)]; });
    toast('Não foi possível salvar no servidor: ' + (e.message || 'erro de conexão'), 'error');
  }
}

/* A chave da OpenAI não vai para o banco público — fica só neste navegador. */
const CHAVES_LOCAIS = ['openaiKey', 'adminPass'];

async function salvarConfigNaNuvem(cfg) {
  const publico = {}, local = {};
  for (const [k, v] of Object.entries(cfg || {})) {
    (CHAVES_LOCAIS.includes(k) ? local : publico)[k] = v;
  }
  try { localStorage.setItem('cf_settings_local', JSON.stringify(local)); } catch {}
  const { error } = await SiteSettings.set('store_settings', publico);
  if (error) toast('Configurações salvas aqui, mas não no servidor: ' + error.message, 'error');
}

/* Primeira carga: traz produtos e configurações do banco. Se a tabela ainda
   não existe (SQL do painel não rodado), avisa e continua com o navegador. */
async function carregarPainelDaNuvem() {
  const [produtos, cfgRemota] = await Promise.all([
    CatalogDB.getAll(),
    SiteSettings.get('store_settings').catch(() => null),
  ]);

  /* ── Configurações da loja (site_settings já existe, não depende do SQL novo) */
  const local  = JSON.parse(localStorage.getItem('cf_settings_local') || 'null') || {};
  const legado = JSON.parse(localStorage.getItem('cf_settings')       || 'null') || {};
  if (cfgRemota && Object.keys(cfgRemota).length) {
    _mem.settings = { ...cfgRemota, ...local };
  } else {
    // Primeira vez: leva para o banco o que estiver salvo neste navegador
    _mem.settings = { ...legado, ...local };
    if (Object.keys(legado).length) await salvarConfigNaNuvem(_mem.settings);
  }

  /* ── Produtos (dependem da tabela criada por schema-painel.sql) */
  if (!CatalogDB.disponivel) {
    _mem.products = JSON.parse(localStorage.getItem('cf_products') || 'null');
    avisarBancoPendente();
    return;
  }

  /* Migração: banco vazio + edições antigas neste navegador = sobe o que existe
     aqui para não perder o trabalho já feito. */
  const antigos = JSON.parse(localStorage.getItem('cf_products') || 'null');
  if (!produtos.length && Array.isArray(antigos) && antigos.length) {
    _mem.products = antigos;
    await CatalogDB.upsert(antigos);
    antigos.forEach(p => { _snapshotNuvem[String(p.id)] = _assinatura(p); });
    toast('Produtos deste navegador foram enviados para o servidor.', 'info');
  } else {
    _mem.products = produtos;
    produtos.forEach(p => { _snapshotNuvem[String(p.id)] = _assinatura(p); });
  }
}

function avisarBancoPendente() {
  if (document.getElementById('db-warning')) return;
  const bar = document.createElement('div');
  bar.id = 'db-warning';
  bar.className = 'db-warning';
  bar.innerHTML =
    '<i class="bi bi-exclamation-triangle-fill"></i>' +
    '<span><strong>Produtos e configurações ainda estão salvos só neste navegador.</strong> ' +
    'Rode o arquivo <code>schema-painel.sql</code> no Supabase (SQL Editor) para que as edições ' +
    'valham para todos os administradores e apareçam na loja.</span>';
  document.querySelector('.admin-content')?.prepend(bar);
}

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

// Escapa HTML de textos vindos de clientes antes de renderizar (anti-XSS)
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

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
  { id:'P001', name:'Vestido Laranja Floral',  category:'vestidos',  price:299.90, originalPrice:399.90, stock:{P:5,M:8,G:3},  colors:['Laranja','Rosa'],     sizes:['P','M','G'], image:'assets/p-vestido-laranja.webp',  status:'active',  description:'Vestido floral levíssimo, perfeito para o verão.' },
  { id:'P002', name:'Blazer Caqui Premium',    category:'blazers',   price:459.90, originalPrice:0,      stock:{P:4,M:6,G:2},  colors:['Caqui'],              sizes:['P','M','G'], image:'assets/p-blazer-caqui.webp',     status:'active',  description:'Blazer estruturado em tecido premium.' },
  { id:'P003', name:'Blusa Azul Seda',         category:'blusas',    price:189.90, originalPrice:239.90, stock:{P:10,M:12,G:5}, colors:['Azul'],              sizes:['P','M','G','GG'], image:'assets/p-blusa-azul.webp',  status:'active',  description:'Blusa de seda com caimento impecável.' },
  { id:'P004', name:'Body Marrom Decote',      category:'blusas',    price:149.90, originalPrice:0,      stock:{P:8,M:10,G:4},  colors:['Marrom','Preto'],    sizes:['P','M','G'], image:'assets/p-body-marrom.webp',      status:'active',  description:'Body com decote elegante e tecido confortável.' },
  { id:'P005', name:'Conjunto Rosa Verão',     category:'conjuntos', price:349.90, originalPrice:420.00, stock:{P:3,M:5,G:2},   colors:['Rosa Claro'],        sizes:['P','M','G'], image:'assets/p-conjunto-rosa.webp',    status:'active',  description:'Conjunto cropped + calça wide leg.' },
  { id:'P006', name:'Look Azul Celeste',       category:'conjuntos', price:389.90, originalPrice:0,      stock:{P:2,M:4,G:1},   colors:['Azul Celeste'],      sizes:['P','M','G'], image:'assets/p-look-azul.webp',        status:'active',  description:'Look completo, perfeito para eventos.' },
  { id:'P007', name:'Regata Branca Classic',   category:'blusas',    price:99.90,  originalPrice:139.90, stock:{P:15,M:18,G:9}, colors:['Branco','Bege'],     sizes:['P','M','G','GG'], image:'assets/p-regata-branca.webp', status:'active',  description:'Regata básica de algodão premium.' },
  { id:'P008', name:'Saia Cetim Midi',         category:'vestidos',  price:259.90, originalPrice:319.90, stock:{P:6,M:7,G:3},   colors:['Champagne','Nude'],  sizes:['P','M','G'], image:'assets/p-saia-cetim.webp',       status:'active',  description:'Saia midi em cetim com brilho sutil.' },
];

const STATUSES = ['novo','em_preparo','enviado','entregue','cancelado'];
const STATUS_LABELS = { novo:'Aguardando', confirmado:'Confirmado', em_preparo:'Em preparo', enviado:'Enviado', entregue:'Entregue', cancelado:'Cancelado' };
const STATUS_CSS    = { novo:'pending', confirmado:'processing', em_preparo:'processing', enviado:'shipped', entregue:'delivered', cancelado:'cancelled' };
const PAYMENT_LABELS = { credit_card:'Cartão Crédito', debit_card:'Cartão Débito', pix:'Pix', boleto:'Boleto', dinheiro:'Dinheiro', credito:'Cartão Crédito', debito:'Cartão Débito' };

// ── Cache Supabase ────────────────────────────────────────────
const _cache = { orders: [], physical: [] };

function _normOrder(o) {
  // esc() em tudo que o cliente digitou: esses textos vão direto para innerHTML
  return {
    id: 'CF-' + o.id.slice(0,8).toUpperCase(), _id: o.id,
    customer: {
      name: esc(o.customer_name), email: esc(o.customer_email), phone: esc(o.customer_phone),
      address: {
        street: esc([o.address?.rua, o.address?.num].filter(Boolean).join(', ')),
        rua: esc(o.address?.rua), num: esc(o.address?.num), comp: esc(o.address?.comp),
        neighborhood: esc(o.address?.bairro), city: esc(o.address?.cidade),
        state: esc(o.address?.estado), zip: esc(o.address?.cep),
      },
    },
    items: (o.items||[]).map(i=>({
      id: i.id, name:esc(i.name||'—'), qty:i.qty||1, price:i.price||0,
      size:esc(i.size), image: esc(i.image||''),
    })),
    total: Number(o.total)||0, payment: 'credit_card',
    status: o.status||'novo', notes: esc(o.notes), createdAt: o.created_at,
  };
}
function _normPhysical(s) {
  return {
    id: 'FS-'+s.id.slice(0,8).toUpperCase(), _id: s.id,
    product: esc(s.product), category: esc(s.category||'outros'),
    quantity: s.quantity||1, unitPrice: Number(s.unit_price)||0,
    discount: Number(s.discount)||0, total: Number(s.total)||0,
    payment: esc(s.payment||'dinheiro'), seller: esc(s.seller), customer: esc(s.customer),
    details: esc(s.details), notes: esc(s.notes), createdAt: s.created_at,
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

// --- dados fictícios removidos, agora usa Supabase (orders e physical_sales) ---

// Mapeia categorias do catálogo da loja para os slugs do admin
function _normCat(cat) {
  if (!cat) return 'outros';
  const c = cat.toLowerCase();
  if (['vestidos','blusas','conjuntos','calcas','shorts','macacoes','macaquinhos','blazers','acessorios'].includes(c)) return c;
  if (c.includes('vest') || c.includes('saia')) return 'vestidos';
  if (c.includes('blazer') || c.includes('colete')) return 'blazers';
  if (c.includes('macaquinho')) return 'macaquinhos';
  if (c.includes('macac')) return 'macacoes';          // macacão / macacao
  if (c.includes('short')) return 'shorts';
  if (c.includes('calç') || c.includes('calc') || c.includes('jeans')) return 'calcas';
  if (c.includes('conj') || c.includes('look')) return 'conjuntos';
  return 'blusas'; // blusa, body, regata, cropped, top, tule, corset, tricot
}

// Categorias usadas nos selects do painel (mesmos slugs da loja)
const ADMIN_CATEGORIES = [
  ['vestidos',    'Vestidos & Saias'],
  ['blusas',      'Blusas & Tops'],
  ['conjuntos',   'Conjuntos'],
  ['calcas',      'Calças'],
  ['shorts',      'Shorts'],
  ['macacoes',    'Macacões'],
  ['macaquinhos', 'Macaquinhos'],
  ['blazers',     'Blazers'],
  ['acessorios',  'Acessórios'],
];
const CAT_LABELS = Object.fromEntries(ADMIN_CATEGORIES);

// Fotos do catálogo são arquivos da pasta assets/ — só products-data.js sabe o
// caminho certo. O admin só consegue criar foto por upload (data:) ou IA (http),
// então qualquer 'assets/...' guardado no localStorage é cópia velha e deve ser
// relida do catálogo (senão uma troca de arquivo quebra todas as miniaturas).
function _isUploadedImage(src) {
  return typeof src === 'string' && /^(data:|https?:|blob:)/.test(src);
}

function _normProduct(p, existing) {
  const catalogImages = p.images ?? (p.image ? [p.image] : []);
  const keepUploaded  = _isUploadedImage(existing?.image);
  return {
    id:            String(p.id),
    name:          existing?.name          ?? p.name          ?? '',
    category:      existing?.category      ?? _normCat(p.category),
    price:         existing?.price         ?? Number(p.price)         ?? 0,
    originalPrice: existing?.originalPrice ?? Number(p.originalPrice) ?? 0,
    image:         keepUploaded ? existing.image  : (p.image ?? ''),
    images:        keepUploaded ? (existing.images?.length ? existing.images : [existing.image])
                                : catalogImages,
    description:   existing?.description   ?? p.description ?? '',
    colors: existing?.colors ?? (Array.isArray(p.colors)
      ? p.colors.map(c => (typeof c === 'string' ? c : c.name))
      : []),
    sizes:     existing?.sizes  ?? p.sizes  ?? [],
    sizeType:  existing?.sizeType ?? ((p.sizes || []).some(sz => /^\d+$/.test(sz)) ? 'number' : 'letter'),
    stock:     existing?.stock  ?? p.stock  ?? { P:0, M:0, G:0, GG:0 },
    pieceOptions: existing?.pieceOptions ?? p.pieceOptions ?? [],
    status:    existing?.status ?? p.status ?? 'active',
    createdAt: existing?.createdAt ?? p.createdAt ?? now(),
  };
}

// ── Init ──────────────────────────────────────────────────────
function initData() {
  // Sempre sincroniza com products-data.js preservando edições do admin (status, estoque, etc.)
  if (typeof products !== 'undefined' && products.length > 0) {
    const stored    = DB.get('products') || [];
    const storedMap = Object.fromEntries(stored.map(p => [String(p.id), p]));
    const catalogIds = new Set(products.map(p => String(p.id)));

    // Produtos do catálogo (com edições do admin preservadas)
    const merged = products.map(p => _normProduct(p, storedMap[String(p.id)]));

    // Produtos adicionados manualmente no admin (não estão em products-data.js)
    const adminAdded = stored.filter(p => !catalogIds.has(String(p.id)));

    DB.set('products', [...merged, ...adminAdded]);
  } else if (!DB.get('products')) {
    DB.set('products', SAMPLE_PRODUCTS);
  }
  if (!DB.get('notifications')) DB.set('notifications', []);
}
/* initData() roda só depois da carga da nuvem (ver "Init page", no fim do
   arquivo) — senão o catálogo estático sobrescreveria as edições salvas. */

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
  if (sec === 'physical')  loadPhysical().then(() => { renderPhysicalForm(); renderPhysicalSales(); updateSalePreview(); });
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
    <tr class="row-clickable" onclick="openOrderDetail('${o._id}')" title="Clique para ver o pedido completo">
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
        <div class="td-actions" onclick="event.stopPropagation()">
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

/* Foto do item do pedido. A foto gravada no pedido é uma cópia do momento da
   compra — pode estar cortada (o servidor limita o tamanho do campo) ou apontar
   para um arquivo que já mudou de nome. Por isso a foto do catálogo vem
   primeiro, e a do pedido fica como reserva. */
const _ORDER_ITEM_FALLBACK_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="66">' +
    '<rect width="52" height="66" fill="%23FBF3F5"/>' +
    '<path d="M14 24h24l-2 24H16z" fill="none" stroke="%23D4679A" stroke-opacity=".45" stroke-width="1.6"/>' +
    '<path d="M21 24v-3a5 5 0 0 1 10 0v3" fill="none" stroke="%23D4679A" stroke-opacity=".45" stroke-width="1.6"/></svg>');

function _orderItemImage(item) {
  const catalog = (typeof products !== 'undefined' ? products : []);
  const p = catalog.find(x => String(x.id) === String(item.id))
         || catalog.find(x => esc(x.name) === item.name);
  if (p && p.image) return esc(p.image);
  // Foto gravada no pedido: só serve se for caminho ou URL inteira
  if (item.image && !item.image.startsWith('data:')) return item.image;
  return '';
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
          ${o.items.map(i=>{
            const img = _orderItemImage(i);
            return `
            <div class="order-detail__item">
              <div class="order-detail__item-info">
                <img class="order-detail__item-img" src="${img || _ORDER_ITEM_FALLBACK_IMG}"
                     alt="${i.name}" loading="lazy"
                     onerror="this.onerror=null;this.src='${_ORDER_ITEM_FALLBACK_IMG}'">
                <div>
                  <strong>${i.name}</strong><br>
                  <small style="color:var(--warm-gray)">Tam.: ${i.size||'—'} — Qtd: ${i.qty||1}</small>
                </div>
              </div>
              <strong style="color:var(--rose-deep)">${fmtBRL(i.price*(i.qty||1))}</strong>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;padding:14px 14px 0;font-weight:600;font-family:var(--serif);font-size:16px">
          <span>Total</span><span style="color:var(--rose-deep)">${fmtBRL(o.total)}</span>
        </div>
      </div>
      <div class="order-detail__section">
        <h5>📦 Envio</h5>
        <button class="btn-outline" onclick="printShippingLabel('${o._id}')" style="padding:8px 14px;font-size:12px">
          <i class="bi bi-printer"></i> Imprimir Etiqueta de Envio
        </button>
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

function printShippingLabel(supabaseId) {
  const o = _cache.orders.find(x=>x._id===supabaseId);
  if (!o) return;
  const cfg = DB.get('settings') || {};
  const remetente = {
    nome: cfg.storeName || 'Cor & Flor',
    fone: cfg.phone || '',
    rua: cfg.rua || '', num: cfg.num || '', comp: cfg.comp || '',
    bairro: cfg.bairro || '', cidade: cfg.cidade || '', estado: cfg.estado || '', cep: cfg.cep || '',
  };
  if (!remetente.rua || !remetente.cep) {
    toast('Cadastre o endereço da loja em Configurações antes de imprimir a etiqueta.', 'error');
    return;
  }
  const dest = o.customer;
  if (!dest.address.zip) {
    toast('Este pedido não tem endereço de entrega cadastrado.', 'error');
    return;
  }
  const win = window.open('', '_blank', 'width=420,height=650');
  if (!win) { toast('Permita pop-ups para imprimir a etiqueta.', 'error'); return; }
  win.document.write(`<!doctype html><html><head><title>Etiqueta ${o.id}</title>
  <style>
    @page { size: 100mm 150mm; margin: 5mm; }
    * { box-sizing:border-box; }
    body { font-family: Arial, sans-serif; color:#111; margin:0; padding:0; }
    .label { width:100%; }
    .box { border:2px solid #111; border-radius:6px; padding:10px 12px; margin-bottom:10px; }
    .box h4 { margin:0 0 6px; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#555; }
    .box p { margin:0; font-size:14px; line-height:1.5; }
    .box p.name { font-size:16px; font-weight:700; }
    .meta { display:flex; justify-content:space-between; font-size:11px; color:#555; margin-bottom:8px; }
    .cep { font-size:20px; font-weight:700; letter-spacing:1px; margin-top:4px; }
    @media screen { body{ background:#eee; padding:20px; } .label{ max-width:380px; margin:0 auto; background:#fff; padding:16px; box-shadow:0 2px 10px rgba(0,0,0,.15);} }
  </style></head>
  <body>
    <div class="label">
      <div class="meta"><span>Pedido ${o.id}</span><span>${fmtDateTime(o.createdAt)}</span></div>
      <div class="box">
        <h4>Remetente</h4>
        <p class="name">${remetente.nome}</p>
        <p>${[remetente.rua, remetente.num].filter(Boolean).join(', ')}${remetente.comp?' — '+remetente.comp:''}</p>
        <p>${remetente.bairro}</p>
        <p>${remetente.cidade} - ${remetente.estado}</p>
        <p class="cep">CEP ${remetente.cep}</p>
        ${remetente.fone?`<p>Tel: ${remetente.fone}</p>`:''}
      </div>
      <div class="box">
        <h4>Destinatário</h4>
        <p class="name">${dest.name}</p>
        <p>${[dest.address.rua, dest.address.num].filter(Boolean).join(', ')}${dest.address.comp?' — '+dest.address.comp:''}</p>
        <p>${dest.address.neighborhood||''}</p>
        <p>${dest.address.city} - ${dest.address.state}</p>
        <p class="cep">CEP ${dest.address.zip}</p>
        ${dest.phone?`<p>Tel: ${dest.phone}</p>`:''}
      </div>
    </div>
    <script>window.onload = () => { window.print(); };<\/script>
  </body></html>`);
  win.document.close();
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay') || e.currentTarget.classList?.contains('modal-close')) {
    document.getElementById('modal-overlay').classList.remove('open');
    window._pfImages = [];
  }
}


// ── PRODUCTS ─────────────────────────────────────────────────
function renderProducts() {
  // Garante que os produtos do catálogo estejam sempre sincronizados
  let prods = DB.get('products') || [];
  if (prods.length === 0) {
    initData();
    prods = DB.get('products') || [];
  }
  const products = prods;

  const search = (document.getElementById('product-search')?.value || '').toLowerCase();
  const cat    = document.getElementById('product-cat-filter')?.value  || '';
  const status = document.getElementById('product-status-filter')?.value || '';

  const filtered = products.filter(p => {
    const matchSearch = !search || (p.name || '').toLowerCase().includes(search) || (p.category || '').includes(search);
    const matchCat    = !cat    || p.category === cat;
    const matchStatus = !status || p.status === status;
    return matchSearch && matchCat && matchStatus;
  });

  document.getElementById('products-grid').innerHTML = filtered.length ? filtered.map(p => {
    const stock = p.stock || {};
    const totalStock = Object.values(stock).reduce((a,b) => a + Number(b), 0);
    const photoCount = p.images?.length || (p.image ? 1 : 0);
    return `
      <div class="prod-card">
        <div class="prod-card__img">
          <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.3'">
          ${photoCount > 1 ? `<span class="prod-card__photos"><i class="bi bi-images"></i> ${photoCount}</span>` : ''}
          <span class="prod-card__status badge badge--${p.status==='active'?'active':'inactive'}"
                style="cursor:pointer" onclick="toggleProductActive('${p.id}')"
                title="Clique para ativar/desativar este produto na loja">${p.status==='active'?'Ativo':'Inativo'}</span>
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

const LETTER_SIZES = ['PP','P','M','G','GG','U'];
const NUMBER_SIZES = ['34','35','36','37','38','39','40','41','42','43','44','45','46'];

function openProductModal(id) {
  resetAIStudio();
  const products = DB.get('products') || [];
  const p = id ? products.find(x=>x.id===id) : null;
  const pSizeType = p?.sizeType || (p?.sizes?.some(sz=>/^\d+$/.test(sz)) ? 'number' : 'letter');
  window._pfExistingStock = p?.stock || {};

  // Galeria do produto: várias fotos, a primeira é a que aparece na loja.
  window._pfImages = p ? (p.images?.length ? [...p.images] : (p.image ? [p.image] : [])) : [];

  document.getElementById('modal-body').innerHTML = `
    <h3 class="modal-title"><i class="bi bi-${p?'pencil':'plus-circle'}"></i> ${p?'Editar':'Novo'} Produto</h3>
    <form id="prod-form" onsubmit="saveProduct(event,'${id||''}')">

      <p class="modal-section-label"><i class="bi bi-images"></i> Fotos do Produto</p>
      <div id="pf-img-gallery"
           ondragover="event.preventDefault();this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="handleImgDrop(event)"></div>
      <p class="img-gallery-hint" id="pf-img-hint"></p>
      <input type="file" id="pf-img-file" accept="image/png,image/jpeg,image/webp,image/gif"
             multiple style="display:none" onchange="onImageUpload(event)">

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
          <p class="ai-final-note">Estas fotos entram na galeria do produto, depois das que você enviou.</p>
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
          <select class="form-select" id="pf-cat" onchange="onProductCategoryChange()">
            ${ADMIN_CATEGORIES.map(([v,l])=>`<option value="${v}"${p?.category===v?' selected':''}>${l}</option>`).join('')}
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
        <label class="form-label">Tipo de tamanho</label>
        <div style="display:flex;gap:16px;margin-top:4px">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
            <input type="radio" name="pf-sizetype" value="letter" ${pSizeType!=='number'?'checked':''} onchange="toggleSizeType()"> Letra (PP, P, M, G, GG, U)
          </label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
            <input type="radio" name="pf-sizetype" value="number" ${pSizeType==='number'?'checked':''} onchange="toggleSizeType()"> Número (34, 36, 38...)
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tamanhos disponíveis</label>
        <div id="pf-sizes-letter" style="display:${pSizeType==='number'?'none':'flex'};gap:8px;flex-wrap:wrap;margin-top:4px">
          ${LETTER_SIZES.map(sz=>`
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
              <input type="checkbox" value="${sz}" ${p?.sizes?.includes(sz)?'checked':''} class="pf-size" onchange="renderProductSizeStock()"> ${sz}
            </label>
          `).join('')}
        </div>
        <div id="pf-sizes-number" style="display:${pSizeType==='number'?'flex':'none'};gap:8px;flex-wrap:wrap;margin-top:4px">
          ${NUMBER_SIZES.map(sz=>`
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
              <input type="checkbox" value="${sz}" ${p?.sizes?.includes(sz)?'checked':''} class="pf-size" onchange="renderProductSizeStock()"> ${sz}
            </label>
          `).join('')}
        </div>
      </div>
      <p class="form-label" style="margin-bottom:10px">Estoque por Tamanho</p>
      <div class="form-row" id="pf-stock-container" style="flex-wrap:wrap;gap:10px"></div>

      <div class="modal-section-divider"><span>Peças vendidas separadamente</span></div>
      <label class="pf-pieces-switch">
        <input type="checkbox" id="pf-has-pieces" ${p?.pieceOptions?.length ? 'checked' : ''} onchange="togglePieceSection()">
        <span>Vender as peças deste conjunto separadamente</span>
      </label>
      <p class="pf-pieces-note" id="pf-pieces-hint" style="display:${p?.category === 'conjuntos' ? '' : 'none'}">
        <i class="bi bi-lightbulb"></i> Conjunto costuma ser vendido também peça a peça — cadastre cada peça com o preço e os tamanhos dela.
      </p>
      <div id="pf-pieces-wrap" style="display:${p?.pieceOptions?.length ? '' : 'none'}">
        <div id="pf-pieces-list"></div>
        <button type="button" class="btn-outline" style="width:100%;justify-content:center;margin-top:8px;border-style:dashed;padding:9px"
                onclick="addPieceRow()">
          <i class="bi bi-plus-lg"></i> Adicionar peça
        </button>
        <p class="pf-pieces-note">
          A primeira opção é a que aparece marcada na loja. Deixe o conjunto completo em primeiro
          lugar para quem quiser levar tudo.
        </p>
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
      ${p ? '' : `
      <button type="button" class="btn-outline" onclick="saveProductAndAddMore()"
              style="width:100%;justify-content:center;margin-top:10px;border-style:dashed">
        <i class="bi bi-plus-circle"></i> Salvar e Adicionar Mais
      </button>
      <p style="font-size:11px;color:rgba(74,64,64,.5);text-align:center;margin-top:6px">
        Salva este produto e abre um formulário em branco para cadastrar o próximo.
      </p>`}
    </form>
  `;
  window._pfPieces = (p?.pieceOptions || []).map(pc => ({
    name:  pc.name  || '',
    price: pc.price ?? '',
    sizes: Array.isArray(pc.sizes) ? [...pc.sizes] : [],
  }));

  document.getElementById('modal-overlay').classList.add('open');
  renderProductImages();
  renderAISlots();
  renderProductSizeStock();
  renderPieceRows();
}

/* ── PEÇAS SEPARADAS (conjuntos) ───────────────────────────────
   Cada peça tem nome, preço e tamanhos próprios: dá para vender o
   conjunto completo e também só a calça, só o top, etc. */
function onProductCategoryChange() {
  const cat  = document.getElementById('pf-cat')?.value;
  const hint = document.getElementById('pf-pieces-hint');
  if (hint) hint.style.display = (cat === 'conjuntos') ? '' : 'none';
}

function togglePieceSection() {
  const chk  = document.getElementById('pf-has-pieces');
  const wrap = document.getElementById('pf-pieces-wrap');
  if (!chk || !wrap) return;
  wrap.style.display = chk.checked ? '' : 'none';
  if (chk.checked && !(window._pfPieces || []).length) {
    const price = parseFloat(document.getElementById('pf-price')?.value) || '';
    window._pfPieces = [
      { name: 'Conjunto completo', price, sizes: _pfCheckedSizes() },
      { name: '', price: '', sizes: [] },
    ];
  }
  renderPieceRows();
}

function _pfCheckedSizes() {
  return [...document.querySelectorAll('.pf-size:checked')].map(c => c.value);
}

function addPieceRow() {
  window._pfPieces = window._pfPieces || [];
  window._pfPieces.push({ name: '', price: '', sizes: [] });
  renderPieceRows();
}

function removePieceRow(i) {
  window._pfPieces.splice(i, 1);
  renderPieceRows();
}

function updatePieceField(i, field, value) {
  if (!window._pfPieces?.[i]) return;
  window._pfPieces[i][field] = value;
}

function togglePieceSize(i, size) {
  const piece = window._pfPieces?.[i];
  if (!piece) return;
  const idx = piece.sizes.indexOf(size);
  if (idx >= 0) piece.sizes.splice(idx, 1); else piece.sizes.push(size);
  renderPieceRows();
}

function renderPieceRows() {
  const list = document.getElementById('pf-pieces-list');
  if (!list) return;
  const pieces = window._pfPieces || [];
  const sizes  = _pfCheckedSizes();

  list.innerHTML = pieces.map((pc, i) => `
    <div class="pf-piece-row">
      <div class="pf-piece-row__top">
        <input type="text" class="form-input" placeholder="Nome da peça (ex.: Somente a calça)"
               value="${esc(pc.name)}" oninput="updatePieceField(${i},'name',this.value)">
        <input type="number" class="form-input pf-piece-row__price" placeholder="Preço" step="0.01" min="0"
               value="${pc.price === '' || pc.price == null ? '' : pc.price}"
               oninput="updatePieceField(${i},'price',this.value)">
        <button type="button" class="btn-icon btn-icon--danger" title="Remover peça"
                onclick="removePieceRow(${i})"><i class="bi bi-trash"></i></button>
      </div>
      <div class="pf-piece-row__sizes">
        ${sizes.length
          ? sizes.map(sz => `
              <button type="button" class="ps-chip${pc.sizes.includes(sz) ? ' is-active' : ''}"
                      onclick="togglePieceSize(${i},'${sz}')">${sz}</button>`).join('') +
            `<span class="pf-piece-row__hint">${pc.sizes.length ? 'tamanhos desta peça' : 'nenhum tamanho marcado — a peça usa os tamanhos do produto'}</span>`
          : '<span class="pf-piece-row__hint">Marque os tamanhos do produto acima para escolher os desta peça.</span>'}
      </div>
    </div>`).join('') ||
    '<p class="pf-pieces-note">Nenhuma peça cadastrada ainda.</p>';
}

function toggleSizeType() {
  const isNumber = document.querySelector('input[name="pf-sizetype"]:checked')?.value === 'number';
  document.getElementById('pf-sizes-letter').style.display = isNumber ? 'none' : 'flex';
  document.getElementById('pf-sizes-number').style.display = isNumber ? 'flex' : 'none';
  document.querySelectorAll(`#pf-sizes-${isNumber?'letter':'number'} .pf-size`).forEach(c=>c.checked=false);
  renderProductSizeStock();
}

function renderProductSizeStock() {
  const checked = [...document.querySelectorAll('.pf-size:checked')].map(c=>c.value);
  const container = document.getElementById('pf-stock-container');
  if (!container) return;
  const current = {};
  container.querySelectorAll('input[data-size]').forEach(inp => { current[inp.dataset.size] = inp.value; });
  const existing = window._pfExistingStock || {};
  container.innerHTML = checked.length ? checked.map(sz => `
    <div class="form-group" style="flex:0 0 70px">
      <label class="form-label">${sz}</label>
      <input type="number" class="form-input pf-stock-input" data-size="${sz}" min="0"
             value="${current[sz] ?? (existing[sz] ?? 0)}">
    </div>
  `).join('') : `<p style="font-size:12px;color:rgba(74,64,64,.5)">Selecione ao menos um tamanho acima.</p>`;

  // Tamanho desmarcado no produto some também das peças separadas
  (window._pfPieces || []).forEach(pc => {
    pc.sizes = (pc.sizes || []).filter(sz => checked.includes(sz));
  });
  renderPieceRows();
}

// ── GALERIA DE FOTOS DO PRODUTO ───────────────────────────────
// Cada produto guarda uma lista de fotos: a primeira é a que aparece na
// vitrine da loja, as demais entram nas miniaturas da página do produto.
const PF_MAX_IMAGES  = 8;
const PF_MAX_FILE_MB = 5;
const PF_MAX_EDGE    = 1400; // px — foto maior que isso é reduzida antes de salvar

function pickProductImages() {
  document.getElementById('pf-img-file')?.click();
}

function renderProductImages() {
  const box  = document.getElementById('pf-img-gallery');
  const hint = document.getElementById('pf-img-hint');
  if (!box) return;
  const imgs = window._pfImages || [];

  if (!imgs.length) {
    box.className = 'img-upload-area';
    box.onclick = pickProductImages;
    box.innerHTML = `
      <i class="bi bi-cloud-upload" style="font-size:36px;color:var(--rose-soft)"></i>
      <p style="font-size:13px;color:var(--warm-gray);margin:8px 0 2px">Clique ou arraste as fotos aqui</p>
      <p style="font-size:11px;color:rgba(74,64,64,.35)">Pode enviar várias de uma vez — PNG, JPG, WEBP, até ${PF_MAX_FILE_MB}MB cada</p>`;
    if (hint) hint.textContent = '';
    return;
  }

  box.className = 'img-gallery';
  box.onclick = null;
  box.innerHTML = imgs.map((src, i) => `
    <div class="img-thumb${i === 0 ? ' is-main' : ''}">
      <img src="${src}" alt="Foto ${i+1}" onerror="this.style.opacity='.25'">
      ${i === 0 ? '<span class="img-thumb__tag">Principal</span>' : ''}
      <div class="img-thumb__tools">
        <button type="button" title="Mover para a esquerda" onclick="moveProductImage(${i},-1)" ${i === 0 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
        <button type="button" title="Mover para a direita"  onclick="moveProductImage(${i},1)"  ${i === imgs.length-1 ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
        <button type="button" class="img-thumb__del" title="Remover foto" onclick="removeProductImage(${i})"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join('') +
    (imgs.length < PF_MAX_IMAGES ? `
    <button type="button" class="img-thumb-add" onclick="pickProductImages()">
      <i class="bi bi-plus-lg"></i><span>Adicionar</span>
    </button>` : '');

  if (hint) hint.textContent = imgs.length === 1
    ? '1 foto — adicione outras para o cliente ver a peça de vários ângulos.'
    : `${imgs.length} fotos — a 1ª é a que aparece na vitrine. Use as setas para reordenar.`;
}

function onImageUpload(e) {
  addProductImages(e.target.files);
  e.target.value = '';
}
function handleImgDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  addProductImages(e.dataTransfer.files);
}

async function addProductImages(fileList) {
  const files = [...(fileList || [])].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  window._pfImages = window._pfImages || [];

  const room = PF_MAX_IMAGES - window._pfImages.length;
  if (room <= 0) { toast(`Este produto já tem o máximo de ${PF_MAX_IMAGES} fotos.`, 'error'); return; }
  if (files.length > room) toast(`Cabem mais ${room} foto(s) neste produto — o resto foi ignorado.`, 'info');

  for (const file of files.slice(0, room)) {
    if (file.size > PF_MAX_FILE_MB * 1024 * 1024) {
      toast(`"${file.name}" passa de ${PF_MAX_FILE_MB}MB e foi ignorada.`, 'error');
      continue;
    }
    try {
      window._pfImages.push(await _readImageResized(file));
      renderProductImages();
    } catch {
      toast(`Não foi possível ler "${file.name}".`, 'error');
    }
  }
}

/* As fotos ficam salvas no navegador, que tem espaço limitado. Foto de celular
   tem uns 4000px de largura sem necessidade nenhuma — reduzir antes de guardar
   é o que permite ter várias fotos por produto sem estourar o armazenamento. */
function _readImageResized(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const original = ev.target.result;
      const img = new Image();
      img.onerror = () => resolve(original); // formato exótico: guarda como veio
      img.onload  = () => {
        const scale = Math.min(1, PF_MAX_EDGE / Math.max(img.width, img.height));
        if (scale === 1 && original.length < 400000) return resolve(original);
        const cv = document.createElement('canvas');
        cv.width  = Math.round(img.width  * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const webp = cv.toDataURL('image/webp', 0.85);
        resolve(webp.startsWith('data:image/webp') ? webp : cv.toDataURL('image/jpeg', 0.85));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

function moveProductImage(i, dir) {
  const arr = window._pfImages || [];
  const t = i + dir;
  if (t < 0 || t >= arr.length) return;
  [arr[i], arr[t]] = [arr[t], arr[i]];
  renderProductImages();
}

function removeProductImage(i) {
  (window._pfImages || []).splice(i, 1);
  renderProductImages();
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

  const imageCtx = window._pfImages?.[0]
    || aiStudioState.selectedImages[0]
    || aiStudioState.referenceImages[0]?.dataUrl
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

function _saveProductFromForm(id) {
  const products = DB.get('products') || [];
  const existing = id ? products.find(p=>p.id===id) : null;
  const sizes = [...document.querySelectorAll('.pf-size:checked')].map(c=>c.value);
  const sizeType = document.querySelector('input[name="pf-sizetype"]:checked')?.value || 'letter';
  const stock = {};
  document.querySelectorAll('.pf-stock-input').forEach(inp => { stock[inp.dataset.size] = parseInt(inp.value) || 0; });
  /* Galeria final = fotos enviadas na ordem escolhida + as geradas pela IA que
     ainda não estejam lá. A primeira é a capa do produto na vitrine. */
  const gallery = [...(window._pfImages || [])];
  aiStudioState.selectedImages.forEach(url => { if (!gallery.includes(url)) gallery.push(url); });

  /* Peças separadas: entram no produto só se tiverem nome e preço.
     Sem tamanho marcado, a peça herda os tamanhos do produto. */
  const wantsPieces = document.getElementById('pf-has-pieces')?.checked;
  const pieceOptions = !wantsPieces ? [] : (window._pfPieces || [])
    .map(pc => ({
      name:  String(pc.name || '').trim(),
      price: parseFloat(pc.price) || 0,
      sizes: (pc.sizes || []).filter(sz => sizes.includes(sz)),
    }))
    .filter(pc => pc.name && pc.price > 0)
    .map(pc => (pc.sizes.length ? pc : { name: pc.name, price: pc.price, sizes: [...sizes] }));

  const prod = {
    id: id || 'P' + uid(),
    name:          document.getElementById('pf-name').value.trim(),
    category:      document.getElementById('pf-cat').value,
    price:         parseFloat(document.getElementById('pf-price').value) || 0,
    originalPrice: parseFloat(document.getElementById('pf-orig').value)  || 0,
    images:        gallery,
    image:         gallery[0] || '',
    description:   document.getElementById('pf-desc').value.trim(),
    colors:        document.getElementById('pf-colors').value.split(',').map(s=>s.trim()).filter(Boolean),
    sizes,
    sizeType,
    stock,
    pieceOptions,
    status: document.getElementById('pf-status').value,
    createdAt: existing?.createdAt || now(),
  };

  if (id) {
    const idx = products.findIndex(p=>p.id===id);
    if (idx>=0) products[idx] = prod; else products.push(prod);
  } else {
    products.push(prod);
  }
  DB.set('products', products);
  renderProducts();
  _syncProductStatus(prod);
  return prod;
}

// Envia status (ativo/inativo), estoque total e peças avulsas para o Supabase,
// que é de onde a loja e o servidor de pagamento leem esses dados.
function _syncProductStatus(prod) {
  const stockTotal = Object.values(prod.stock || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  ProductStatus.setOne(prod.id, { active: prod.status === 'active', stock: stockTotal }).catch(() => {
    toast('Produto salvo aqui, mas não foi possível sincronizar com a loja online.', 'error');
  });
  if (prod.pieceOptions !== undefined) {
    ProductPieces.setOne(prod.id, prod.pieceOptions).catch(() => {
      toast('As peças separadas não foram sincronizadas com a loja online.', 'error');
    });
  }
}

// Ativa/desativa um produto direto no card, sem abrir o formulário completo.
function toggleProductActive(id) {
  const products = DB.get('products') || [];
  const idx = products.findIndex(p => p.id === id);
  if (idx < 0) return;
  products[idx].status = products[idx].status === 'active' ? 'inactive' : 'active';
  DB.set('products', products);
  renderProducts();
  _syncProductStatus(products[idx]);
  toast(products[idx].status === 'active' ? 'Produto ativado na loja.' : 'Produto ocultado da loja.',
        products[idx].status === 'active' ? 'success' : 'info');
}

function saveProduct(e, id) {
  e.preventDefault();
  _saveProductFromForm(id);
  toast(id ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!', 'success');
  closeModal();
}

// Salva o produto atual e reabre o formulário limpo para cadastrar o próximo
function saveProductAndAddMore() {
  const form = document.getElementById('prod-form');
  if (!form || !form.reportValidity()) return;
  const prod = _saveProductFromForm('');
  openProductModal();
  toast(`"${prod.name}" cadastrado! Adicione o próximo produto.`, 'success');
}

function restoreProductCatalog() {
  if (!confirm2(`Recarregar os ${products.length} produtos do catálogo? Edições de estoque e status feitas no painel serão mantidas.`)) return;
  initData();
  renderProducts();
  toast(`${products.length} produtos sincronizados com o catálogo!`, 'success');
}

function deleteProduct(id) {
  if (!confirm2('Excluir este produto? Esta ação não pode ser desfeita.')) return;
  const products = (DB.get('products') || []).filter(p=>p.id!==id);
  DB.set('products', products);
  renderProducts();
  toast('Produto removido.', 'info');
}


// ── PROMOS DO DIA ─────────────────────────────────────────────
// Seleção manual salva no Supabase (site_settings). Vazio = modo
// automático: o site sorteia 4 produtos em oferta e troca a cada 24h.
async function openPromosModal() {
  const catalog = typeof products !== 'undefined' ? products : [];
  if (!catalog.length) { toast('Catálogo da loja não carregado.', 'error'); return; }

  let selected = [], promoPrices = {};
  try { selected = (await SiteSettings.get('promo_products')) || []; } catch {}
  try { promoPrices = await PromoPrices.getAll(); } catch {}
  selected = selected.map(Number);

  document.getElementById('modal-body').innerHTML = `
    <h3 class="modal-title"><i class="bi bi-fire"></i> Promos do Dia</h3>
    <p style="font-size:13px;color:var(--warm-gray);margin:0 0 6px;line-height:1.6">
      Escolha até <strong>4 produtos</strong> para aparecerem na vitrine <strong>Promos do Dia</strong> da loja.
    </p>
    <p style="font-size:12px;color:rgba(74,64,64,.55);margin:0 0 16px;line-height:1.6">
      <i class="bi bi-magic"></i> Se nenhum produto for escolhido, a seleção fica <strong>automática</strong>:
      o site sorteia entre os produtos em oferta e troca a cada 24 horas.<br>
      <i class="bi bi-tag"></i> O <strong>preço promocional</strong> é opcional — preenchido, passa a valer na loja
      inteira (vitrine, página do produto e checkout) e o preço antigo aparece riscado. Em branco, o produto entra na
      vitrine pelo preço normal.
    </p>
    <div id="promo-pick-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-height:46vh;overflow-y:auto;padding:2px">
      ${catalog.map(p => {
        const isSel = selected.includes(Number(p.id));
        const promo = promoPrices[String(p.id)];
        return `
        <div class="promo-pick-card${isSel ? ' is-selected' : ''}" id="promo-card-${p.id}">
          <label style="cursor:pointer;display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center">
            <input type="checkbox" class="promo-pick" value="${p.id}" ${isSel ? 'checked' : ''}
                   onchange="onPromoPickToggle(this)" style="accent-color:var(--rose);width:16px;height:16px">
            <img src="${p.image}" style="width:100%;height:105px;object-fit:cover;border-radius:8px;background:var(--nude)" onerror="this.style.opacity='.3'">
            <span style="font-size:12px;font-weight:500;line-height:1.3">${esc(p.name)}</span>
            <span style="font-size:11px;color:var(--warm-gray)">de ${fmtBRL(p.price)}</span>
          </label>
          <div class="promo-price-field">
            <span>R$</span>
            <input type="number" class="promo-price" data-id="${p.id}" step="0.01" min="0"
                   value="${promo != null ? promo : ''}" placeholder="promo"
                   ${isSel ? '' : 'disabled'} oninput="previewPromoPrice(this, ${p.price})">
          </div>
          <span class="promo-price-hint" id="promo-hint-${p.id}"></span>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <button class="btn-primary" style="flex:1;justify-content:center;min-width:150px" onclick="savePromoPicks(false)">
        <i class="bi bi-check-lg"></i> Salvar Promos
      </button>
      <button class="btn-outline" onclick="savePromoPicks(true)" title="Limpa a seleção e os preços promocionais, voltando ao sorteio automático diário">
        <i class="bi bi-magic"></i> Modo automático
      </button>
      <button class="btn-outline" onclick="closeModal()">Cancelar</button>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
  // Mostra o desconto já calculado nos preços que vieram salvos
  document.querySelectorAll('.promo-price').forEach(inp => {
    const p = catalog.find(x => String(x.id) === inp.dataset.id);
    if (p) previewPromoPrice(inp, p.price);
  });
}

function onPromoPickToggle(chk) {
  if (document.querySelectorAll('.promo-pick:checked').length > 4) {
    chk.checked = false;
    toast('Máximo de 4 produtos nas Promos do Dia.', 'error');
  }
  const card  = document.getElementById('promo-card-' + chk.value);
  const price = card?.querySelector('.promo-price');
  if (price) {
    price.disabled = !chk.checked;
    if (!chk.checked) { price.value = ''; previewPromoPrice(price, 0); }
  }
  card?.classList.toggle('is-selected', chk.checked);
}

// Mostra o % de desconto e avisa quando o valor digitado não é promoção
function previewPromoPrice(input, fullPrice) {
  const hint = document.getElementById('promo-hint-' + input.dataset.id);
  if (!hint) return;
  const v = parseFloat(input.value);
  if (!v) { hint.textContent = ''; hint.className = 'promo-price-hint'; return; }
  if (v >= fullPrice) {
    hint.textContent = 'precisa ser menor que o preço atual';
    hint.className = 'promo-price-hint is-error';
    return;
  }
  hint.textContent = `-${Math.round((1 - v / fullPrice) * 100)}% na loja`;
  hint.className = 'promo-price-hint is-ok';
}

async function savePromoPicks(autoMode) {
  const catalog = typeof products !== 'undefined' ? products : [];
  const ids = autoMode ? [] : [...document.querySelectorAll('.promo-pick:checked')].map(c => Number(c.value));

  // Preços promocionais: só os produtos marcados, e só se realmente baratearem
  const prices = {};
  if (!autoMode) {
    for (const inp of document.querySelectorAll('.promo-price')) {
      const id = inp.dataset.id;
      if (!ids.includes(Number(id)) || !inp.value) continue;
      const v = parseFloat(inp.value);
      const p = catalog.find(x => String(x.id) === id);
      if (!v || v <= 0) continue;
      if (p && v >= p.price) {
        toast(`O preço promocional de "${p.name}" precisa ser menor que ${fmtBRL(p.price)}.`, 'error');
        return;
      }
      prices[id] = v;
    }
  }

  const r1 = await SiteSettings.set('promo_products', ids);
  if (r1.error) { toast('Erro ao salvar: ' + r1.error.message, 'error'); return; }
  const r2 = await PromoPrices.set(prices);
  if (r2.error) { toast('Promos salvas, mas os preços não: ' + r2.error.message, 'error'); return; }

  closeModal();
  const comPreco = Object.keys(prices).length;
  toast(ids.length
    ? `${ids.length} produto(s) nas Promos do Dia${comPreco ? ` — ${comPreco} com preço promocional` : ''}!`
    : 'Promos do Dia em modo automático — troca a cada 24h.', 'success');
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

  let productName, categoryVal, catalogProductId = null, saleSize = _psSelection.size || '';

  if (isCatalog) {
    const sel = document.getElementById('ps-catalog-select');
    if (!sel.value) { toast('Selecione um produto do catálogo.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; } return; }
    const p = products.find(x => String(x.id) === String(sel.value));
    if (!p) { toast('Produto não encontrado.', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; } return; }
    productName      = p.name;
    categoryVal      = p.category;
    catalogProductId = String(p.id);
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
    seller:   null,
    customer: document.getElementById('ps-customer').value.trim() || null,
    details:  [_psSelection.size, _psSelection.color].filter(Boolean).join(' / ') || null,
    notes:    document.getElementById('ps-notes').value.trim() || null,
  };

  const { error } = await sb.from('physical_sales').insert(record);
  if (btn) { btn.disabled = false; btn.textContent = 'Registrar Venda'; }
  if (error) { toast('Erro ao salvar venda: ' + error.message, 'error'); return; }

  e.target.reset();
  document.getElementById('ps-qty').value = 1;
  document.getElementById('ps-discount').value = 0;
  _psSelection = { productId: '', size: '', color: '' };
  togglePsType('catalog');
  renderPhysicalForm();
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
    _psSelection.productId = '';
    const hidden = document.getElementById('ps-catalog-select');
    if (hidden) hidden.value = '';
    closePsPicker();
    updateSalePreview();
  }
  renderPsSizeChips();
  renderPsColorChips();
  updatePsStockInfo();
}

/* ── Seleção da venda física ───────────────────────────────────
   Produto escolhido num seletor com foto e tamanho/cor em botões,
   para o balcão registrar a venda sem digitar nada. */
let _psSelection = { productId: '', size: '', color: '' };

const PS_LETTER_SIZES   = ['PP','P','M','G','GG','U'];
const PS_NUMBER_SIZES   = ['34','36','38','40','42','44','46'];
const PS_GENERIC_COLORS = ['Preto','Branco','Bege','Nude','Rosa','Vermelho','Azul','Verde','Marrom','Estampado'];

const _psIsCatalogMode = () =>
  document.querySelector('input[name="ps-prod-type"]:checked')?.value !== 'new';

// Produto do catálogo da loja (nome, foto, preço)
function _psCatalogProduct(id) {
  return (typeof products !== 'undefined' ? products : [])
    .find(p => String(p.id) === String(id));
}
// Mesmo produto no painel — é aqui que mora o estoque por tamanho
function _psAdminProduct(id) {
  return (DB.get('products') || []).find(p => String(p.id) === String(id));
}

function renderPhysicalForm() {
  renderPsCatalogButton();
  renderPsPickerList();
  renderPsSizeChips();
  renderPsColorChips();
  updatePsStockInfo();
}

function renderPsCatalogButton() {
  const btn = document.getElementById('ps-picker-btn');
  if (!btn) return;
  const p = _psCatalogProduct(_psSelection.productId);
  btn.innerHTML = p
    ? `<img class="ps-picker-btn__img" src="${p.image}" alt="" onerror="this.style.visibility='hidden'">
       <span class="ps-picker-btn__name">${esc(p.name)}</span>
       <span class="ps-picker-btn__price">${fmtBRL(p.price)}</span>
       <i class="bi bi-chevron-down"></i>`
    : `<span class="ps-picker-btn__placeholder">— Selecione um produto —</span>
       <i class="bi bi-chevron-down"></i>`;
}

function togglePsPicker() {
  const box = document.getElementById('ps-picker');
  if (!box) return;
  if (box.hidden) {
    box.hidden = false;
    renderPsPickerList();
    document.getElementById('ps-picker-search')?.focus();
  } else {
    closePsPicker();
  }
}
function closePsPicker() {
  const box = document.getElementById('ps-picker');
  if (box) box.hidden = true;
}

function renderPsPickerList() {
  const list = document.getElementById('ps-picker-list');
  if (!list) return;
  const term = (document.getElementById('ps-picker-search')?.value || '').toLowerCase().trim();
  const all  = (typeof products !== 'undefined' ? products : []);
  const shown = term ? all.filter(p => p.name.toLowerCase().includes(term)) : all;

  list.innerHTML = shown.length ? shown.map(p => `
    <button type="button" class="ps-picker-item${String(p.id) === String(_psSelection.productId) ? ' is-selected' : ''}"
            onclick="selectPsProduct('${p.id}')">
      <img src="${p.image}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="ps-picker-item__info">
        <span class="ps-picker-item__name">${esc(p.name)}</span>
        <span class="ps-picker-item__meta">${fmtBRL(p.price)}${_psStockBadge(p.id)}</span>
      </span>
    </button>`).join('')
    : `<p class="ps-picker__empty">Nenhum produto com esse nome.</p>`;
}

function _psStockBadge(id) {
  const adm = _psAdminProduct(id);
  if (!adm) return '';
  const total = Object.values(adm.stock || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  return total > 0 ? ` · ${total} em estoque` : ' · sem estoque';
}

function selectPsProduct(id) {
  _psSelection.productId = String(id);
  _psSelection.size  = '';
  _psSelection.color = '';
  const hidden = document.getElementById('ps-catalog-select');
  if (hidden) hidden.value = String(id);

  const p = _psCatalogProduct(id);
  const priceInput = document.getElementById('ps-price');
  if (p && priceInput) priceInput.value = p.price;

  closePsPicker();
  const search = document.getElementById('ps-picker-search');
  if (search) search.value = '';
  renderPhysicalForm();
  updateSalePreview();
}

// Tamanhos: do produto escolhido; no produto novo, a tabela padrão da loja
function renderPsSizeChips() {
  const box = document.getElementById('ps-size-chips');
  if (!box) return;
  const p = _psIsCatalogMode() ? _psCatalogProduct(_psSelection.productId) : null;
  const sizes = p?.sizes?.length ? p.sizes
              : (_psIsCatalogMode() && !p ? [] : [...PS_LETTER_SIZES, ...PS_NUMBER_SIZES]);

  if (!sizes.length) {
    box.innerHTML = '<span class="ps-chips__hint">Escolha um produto para ver os tamanhos.</span>';
    return;
  }
  box.innerHTML = ['Único', ...sizes].map(sz => `
    <button type="button" class="ps-chip${_psSelection.size === sz ? ' is-active' : ''}"
            onclick="selectPsSize('${esc(sz)}')">${esc(sz)}</button>`).join('');
}

function selectPsSize(sz) {
  _psSelection.size = (_psSelection.size === sz) ? '' : sz;
  renderPsSizeChips();
  updatePsStockInfo();
}

// Cores: as cadastradas no produto; no produto novo, uma paleta genérica
function renderPsColorChips() {
  const box = document.getElementById('ps-color-chips');
  if (!box) return;
  const p    = _psIsCatalogMode() ? _psCatalogProduct(_psSelection.productId) : null;
  const cols = (p?.colors || []).map(c => (typeof c === 'string' ? c : c.name));
  const list = cols.length ? cols : (_psIsCatalogMode() && !p ? [] : PS_GENERIC_COLORS);

  if (!list.length) {
    box.innerHTML = '<span class="ps-chips__hint">Escolha um produto para ver as cores.</span>';
    return;
  }
  box.innerHTML = list.map(c => `
    <button type="button" class="ps-chip${_psSelection.color === c ? ' is-active' : ''}"
            onclick="selectPsColor('${esc(c).replace(/'/g, '&#39;')}')">${esc(c)}</button>`).join('');
}

function selectPsColor(c) {
  const name = c.replace(/&#39;/g, "'");
  _psSelection.color = (_psSelection.color === name) ? '' : name;
  renderPsColorChips();
}

// Estoque real do produto (por tamanho quando há um selecionado)
function updatePsStockInfo() {
  const el = document.getElementById('ps-stock-info');
  if (!el) return;
  el.classList.remove('is-out', 'is-low');

  if (!_psIsCatalogMode() || !_psSelection.productId) {
    el.textContent = 'Selecione um produto';
    return;
  }
  const adm = _psAdminProduct(_psSelection.productId);
  if (!adm) { el.textContent = 'Estoque não cadastrado'; return; }

  const stock = adm.stock || {};
  const size  = _psSelection.size;
  const hasSize = size && size !== 'Único' && stock[size] !== undefined;
  const qty = hasSize
    ? Number(stock[size]) || 0
    : Object.values(stock).reduce((a, b) => a + (Number(b) || 0), 0);

  el.textContent = hasSize
    ? `${qty} un. no tamanho ${size}`
    : `${qty} un. no total`;
  if (qty === 0)      el.classList.add('is-out');
  else if (qty <= 3)  el.classList.add('is-low');
}

// Fecha o seletor ao clicar fora dele
document.addEventListener('click', e => {
  const box = document.getElementById('ps-picker');
  if (!box || box.hidden) return;
  if (!box.contains(e.target) && !e.target.closest('#ps-picker-btn')) closePsPicker();
});

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
      <td style="font-size:11px;white-space:nowrap">${fmtDateTime(s.createdAt)}</td>
      <td><button class="btn-icon btn-icon--danger" onclick="deletePhysical('${s._id}')" title="Remover"><i class="bi bi-trash"></i></button></td>
    </tr>
  `).join('') : `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--warm-gray)">Nenhuma venda no período selecionado.</td></tr>`;
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
  const catEntries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  destroyChart('category');
  charts.category = new Chart(document.getElementById('chart-category'), {
    type:'doughnut',
    data: {
      labels: catEntries.map(([k])=>CAT_LABELS[k]|| (k === 'outros' ? 'Outros' : k)),
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
  let prods = DB.get('products') || [];
  if (prods.length === 0) { initData(); prods = DB.get('products') || []; }
  const products = prods;
  const filter   = document.getElementById('inv-filter')?.value || 'all';

  let list = products.filter(p => {
    const total = Object.values(p.stock || {}).reduce((a,b)=>a+Number(b),0);
    if (filter === 'low') return total <= 5 && total > 0;
    if (filter === 'out') return total === 0;
    return true;
  });

  document.getElementById('inventory-tbody').innerHTML = list.length ? list.map(p => {
    const stock = p.stock || {};
    const total = Object.values(stock).reduce((a,b)=>a+Number(b),0);
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
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${Object.keys(stock).length ? Object.entries(stock).map(([sz,qty])=>`
              <div style="display:flex;flex-direction:column;align-items:center">
                <span style="font-size:10px;color:var(--warm-gray)">${sz}</span>
                <input type="number" class="stock-input" style="width:52px" value="${qty||0}" min="0" onchange="updateStock('${p.id}','${sz}',this.value)">
              </div>
            `).join('') : `<span style="font-size:12px;color:var(--warm-gray)">—</span>`}
          </div>
        </td>
        <td><strong>${total}</strong></td>
        <td><span class="badge badge--${stockStatus}">${stockLabel}</span></td>
        <td>
          <button class="btn-icon" onclick="openProductModal('${p.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--warm-gray)">Nenhum produto encontrado.</td></tr>`;
}

function updateStock(id, size, val) {
  const products = DB.get('products') || [];
  const idx = products.findIndex(p=>p.id===id);
  if (idx < 0) return;
  products[idx].stock[size] = parseInt(val) || 0;
  DB.set('products', products);
  toast(`Estoque atualizado — ${products[idx].name} (${size})`, 'success');
}


async function lookupCfgCep() {
  const input = document.getElementById('cfg-cep');
  const cep = (input?.value || '').replace(/\D/g, '');
  if (cep.length !== 8) return;
  input.value = cep.replace(/^(\d{5})(\d)/, '$1-$2');
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) { toast('CEP não encontrado.', 'error'); return; }
    if (d.logradouro) document.getElementById('cfg-rua').value = d.logradouro;
    if (d.bairro)     document.getElementById('cfg-bairro').value = d.bairro;
    if (d.localidade) document.getElementById('cfg-cidade').value = d.localidade;
    if (d.uf)         document.getElementById('cfg-estado').value = d.uf;
    document.getElementById('cfg-num')?.focus();
  } catch {
    toast('Erro ao buscar CEP. Preencha manualmente.', 'error');
  }
}

// ── SETTINGS ─────────────────────────────────────────────────
function loadSettings() {
  const cfg = DB.get('settings') || {};
  if (cfg.storeName)   document.getElementById('cfg-store-name').value = cfg.storeName;
  if (cfg.cnpj)        document.getElementById('cfg-cnpj').value = cfg.cnpj;
  if (cfg.phone)       document.getElementById('cfg-phone').value = cfg.phone;
  if (cfg.email)       document.getElementById('cfg-email').value = cfg.email;
  if (cfg.ig)          document.getElementById('cfg-ig').value = cfg.ig;
  if (cfg.cep)         document.getElementById('cfg-cep').value = cfg.cep;
  if (cfg.rua)         document.getElementById('cfg-rua').value = cfg.rua;
  if (cfg.num)         document.getElementById('cfg-num').value = cfg.num;
  if (cfg.comp)        document.getElementById('cfg-comp').value = cfg.comp;
  if (cfg.bairro)      document.getElementById('cfg-bairro').value = cfg.bairro;
  if (cfg.cidade)      document.getElementById('cfg-cidade').value = cfg.cidade;
  if (cfg.estado)      document.getElementById('cfg-estado').value = cfg.estado;
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
    cfg.ig        = document.getElementById('cfg-ig').value;
    cfg.cep       = document.getElementById('cfg-cep').value;
    cfg.rua       = document.getElementById('cfg-rua').value;
    cfg.num       = document.getElementById('cfg-num').value;
    cfg.comp      = document.getElementById('cfg-comp').value;
    cfg.bairro    = document.getElementById('cfg-bairro').value;
    cfg.cidade    = document.getElementById('cfg-cidade').value;
    cfg.estado    = document.getElementById('cfg-estado').value.toUpperCase();
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
/* Ordem importa: primeiro o que está salvo no banco, depois o merge com o
   catálogo estático e só então as gravações são liberadas. */
(async function iniciarPainel() {
  try {
    await carregarPainelDaNuvem();
  } catch (e) {
    toast('Não foi possível carregar os dados do servidor. Usando o que está neste navegador.', 'error');
    CatalogDB.disponivel = false;
    _mem.products = JSON.parse(localStorage.getItem('cf_products') || 'null');
    _mem.settings = JSON.parse(localStorage.getItem('cf_settings')  || 'null') || {};
  }
  initData();
  _nuvemPronta = true;
  /* initData pode ter criado/atualizado produtos do catálogo — grava agora */
  if (CatalogDB.disponivel) salvarProdutosNaNuvem(DB.get('products'));
  else                      _gravarLocal('products', DB.get('products'));
  goTo('dashboard');
})();
