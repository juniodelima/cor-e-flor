/* ================================================================
   COR & FLOR — Supabase Client v1
================================================================ */
const _SB_URL = 'https://yynukxtyiiuwjcmqiktr.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bnVreHR5aWl1d2pjbXFpa3RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Njk2OTgsImV4cCI6MjA5NjQ0NTY5OH0.Qq4pKOcJturx1U0LUPWZCtV0pmyW5huBnqA9k6_Sf7I';

const sb = window.supabase.createClient(_SB_URL, _SB_KEY);

/* ---- Auth ---- */
const Auth = {
  async user()              { const { data: { user } } = await sb.auth.getUser(); return user; },
  async login(email, pw)    { return sb.auth.signInWithPassword({ email, password: pw }); },
  async signup(email, pw, name) {
    return sb.auth.signUp({ email, password: pw, options: { data: { name } } });
  },
  async logout()            { return sb.auth.signOut(); },
  async resetPw(email)      { return sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/conta.html' }); },
  onChange(cb)              { return sb.auth.onAuthStateChange(cb); },
  async profile(userId) {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
    return data;
  },
  async updateProfile(userId, data) {
    return sb.from('profiles').update(data).eq('id', userId);
  }
};

/* ---- Newsletter ---- */
const Newsletter = {
  async subscribe(email) {
    return sb.from('newsletter').insert({ email });
  }
};

/* ---- Contato ---- */
const Contact = {
  async send(name, email, subject, message) {
    return sb.from('contacts').insert({ name, email, subject, message });
  }
};

/* ---- Pedidos ---- */
const Orders = {
  async create(order) {
    return sb.from('orders').insert(order).select('id').single();
  },
  async mine(userId) {
    return sb.from('orders')
      .select('*')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });
  }
};

/* ---- Favoritos ---- */
const Favorites = {
  async getAll(userId) {
    const { data } = await sb.from('favorites').select('product_id').eq('customer_id', userId);
    return (data || []).map(r => r.product_id);
  },
  async add(userId, productId) {
    return sb.from('favorites').insert({ customer_id: userId, product_id: productId });
  },
  async remove(userId, productId) {
    return sb.from('favorites').delete().eq('customer_id', userId).eq('product_id', productId);
  }
};

/* ---- Avaliações ---- */
const Reviews = {
  async forProduct(productId) {
    return sb.from('reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('approved', true)
      .order('created_at', { ascending: false });
  },
  async submit(productId, name, rating, body, userId) {
    return sb.from('reviews').insert({
      product_id: productId, customer_name: name,
      rating, body: body || null, customer_id: userId || null
    });
  }
};

/* ---- Cupons ---- */
const Coupons = {
  async validate(code, subtotal) {
    // Busca via função segura (não permite listar cupons); se o banco ainda
    // não tiver a função, cai no SELECT direto antigo.
    let data = null;
    const rpc = await sb.rpc('get_coupon', { p_code: code });
    if (!rpc.error && Array.isArray(rpc.data)) data = rpc.data[0] || null;
    if (rpc.error) {
      const sel = await sb.from('coupons')
        .select('*').eq('code', code.trim().toUpperCase()).eq('active', true).single();
      data = sel.data;
    }
    if (!data) return { ok: false, msg: 'Cupom inválido.' };
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { ok: false, msg: 'Cupom expirado.' };
    if (data.max_uses && data.uses >= data.max_uses) return { ok: false, msg: 'Cupom esgotado.' };
    const BRL = n => 'R$ ' + n.toFixed(2).replace('.', ',');
    if (subtotal < data.min_order) return { ok: false, msg: `Mínimo ${BRL(data.min_order)} para este cupom.` };
    if (data.discount_type === 'frete') {
      return { ok: true, coupon: data, discount: 0, free_shipping: true };
    }
    const discount = data.discount_type === 'percent'
      ? subtotal * (data.discount_value / 100) : data.discount_value;
    return { ok: true, coupon: data, discount: Math.min(discount, subtotal) };
  }
};

/* ---- Lista de Espera ---- */
const Waitlist = {
  async join(productId, email, size) {
    return sb.from('waitlist').insert({ product_id: productId, email, size: size || null });
  }
};

/* ---- Configurações do site (chave/valor JSONB) ---- */
const SiteSettings = {
  async get(key) {
    const { data } = await sb.from('site_settings').select('value').eq('key', key).maybeSingle();
    return data ? data.value : null;
  },
  async set(key, value) {
    return sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  }
};

/* ---- Catálogo editado no painel (tabela `products`) ----
   Fonte da verdade de nome, preço, estoque, fotos e status. O que está em
   products-data.js é só o ponto de partida: se existe linha aqui para o
   mesmo id, é ela que vale — para todos os administradores e para a loja.
   Enquanto o SQL de schema-painel.sql não for rodado, `disponivel` fica
   false e o painel volta a funcionar do jeito antigo. */
const CatalogDB = {
  disponivel: true,

  // Linha do banco → objeto no formato usado pelo painel e pela loja
  fromRow(r) {
    return {
      id:            String(r.id),
      name:          r.name || '',
      category:      r.category || 'outros',
      price:         Number(r.price) || 0,
      originalPrice: Number(r.original_price) || 0,
      image:         r.image || (Array.isArray(r.images) ? r.images[0] : '') || '',
      images:        Array.isArray(r.images) ? r.images : [],
      description:   r.description || '',
      colors:        Array.isArray(r.colors) ? r.colors : [],
      sizes:         Array.isArray(r.sizes) ? r.sizes : [],
      sizeType:      r.size_type || 'letter',
      stock:         (r.stock && typeof r.stock === 'object') ? r.stock : {},
      pieceOptions:  Array.isArray(r.piece_options) ? r.piece_options : [],
      status:        r.status || 'active',
      createdAt:     r.created_at,
    };
  },

  toRow(p) {
    return {
      id:             String(p.id),
      name:           p.name || '',
      category:       p.category || 'outros',
      price:          Number(p.price) || 0,
      original_price: Number(p.originalPrice) || 0,
      image:          p.image || '',
      images:         p.images || [],
      description:    p.description || '',
      colors:         p.colors || [],
      sizes:          p.sizes || [],
      size_type:      p.sizeType || 'letter',
      stock:          p.stock || {},
      piece_options:  p.pieceOptions || [],
      status:         p.status || 'active',
      updated_at:     new Date().toISOString(),
    };
  },

  async getAll() {
    const { data, error } = await sb.from('products').select('*');
    if (error) {
      // 42P01 = tabela ainda não criada (SQL do painel não foi rodado)
      CatalogDB.disponivel = false;
      return [];
    }
    CatalogDB.disponivel = true;
    return (data || []).map(CatalogDB.fromRow);
  },

  async upsert(list) {
    if (!list.length) return { error: null };
    return sb.from('products').upsert(list.map(CatalogDB.toRow));
  },

  async remove(ids) {
    if (!ids.length) return { error: null };
    return sb.from('products').delete().in('id', ids.map(String));
  },
};

/* Cores no painel são texto ("Rosa", "Preto"); a loja precisa de uma cor
   real para pintar a bolinha. Este mapa cobre os nomes mais usados. */
const _CORES_HEX = {
  preto:'#1C1414', branco:'#FFFFFF', bege:'#E8DDD0', nude:'#F1DCD5', creme:'#F5EFE6',
  rosa:'#E29AB0', 'rosa claro':'#F4C9D8', pink:'#D4679A', vermelho:'#B3202C',
  vinho:'#6E1B2A', laranja:'#F4A05B', amarelo:'#F2C14E', dourado:'#C9A227',
  verde:'#4F7A57', 'verde militar':'#5A6350', azul:'#3F5F8A', 'azul claro':'#8FA8C0',
  marinho:'#1F2D4A', jeans:'#4A6FA5', marrom:'#6E4B32', caramelo:'#C4956A',
  cinza:'#9A9A9A', prata:'#C9CACE', off:'#F5F2EC', 'off white':'#F5F2EC',
  estampado:'#C98BA5', multicolor:'#C98BA5',
};
function _corParaObjeto(c, i) {
  if (c && typeof c === 'object') return c;
  const nome = String(c || '').trim();
  if (/^#|^rgb/i.test(nome)) return { name: 'Cor ' + (i + 1), hex: nome };
  return { name: nome || 'Cor ' + (i + 1), hex: _CORES_HEX[nome.toLowerCase()] || '#D4679A' };
}

/* ---- Status de produtos (ativo/inativo e estoque) definido no painel admin ----
   Guardado em site_settings sob a chave 'product_status':
   { [productId]: { active: boolean, stock: number } }
   Produtos sem entrada aqui usam o padrão do catálogo (ativo, com estoque). */
const ProductStatus = {
  async getAll() {
    try { return (await SiteSettings.get('product_status')) || {}; }
    catch { return {}; }
  },
  async setOne(id, patch) {
    const all = await ProductStatus.getAll();
    all[String(id)] = { ...all[String(id)], ...patch };
    return SiteSettings.set('product_status', all);
  }
};

/* ---- Preço promocional das Promos do Dia ----
   site_settings.promo_prices = { [productId]: novoPreço }. O preço antigo
   vira o "de" riscado. O servidor (api/payment.js) lê a mesma chave, então
   o valor cobrado no cartão é sempre o daqui. */
const PromoPrices = {
  async getAll() {
    try { return (await SiteSettings.get('promo_prices')) || {}; }
    catch { return {}; }
  },
  async set(map) { return SiteSettings.set('promo_prices', map || {}); }
};

/* ---- Peças vendidas separadamente (conjuntos) ----
   site_settings.product_pieces = { [productId]: [{ name, price, sizes[] }] } */
const ProductPieces = {
  async getAll() {
    try { return (await SiteSettings.get('product_pieces')) || {}; }
    catch { return {}; }
  },
  async setOne(id, pieces) {
    const all = await ProductPieces.getAll();
    if (pieces && pieces.length) all[String(id)] = pieces;
    else delete all[String(id)];
    return SiteSettings.set('product_pieces', all);
  }
};

/* Aplica um preço promocional sobre um produto, guardando o preço cheio
   como "originalPrice" para a loja mostrar o valor riscado. */
function applyPromoPrice(p, promoValue) {
  const promo = Number(promoValue);
  if (!promo || promo <= 0 || promo >= Number(p.price)) return p;
  if (!p.originalPrice || Number(p.originalPrice) < Number(p.price)) p.originalPrice = p.price;
  p.price      = promo;
  p.promoPrice = promo;
  return p;
}

/* Aplica sobre a lista de produtos tudo que foi definido no painel:
   as edições da tabela `products` (nome, preço, fotos, estoque, status),
   os produtos criados só no painel, o preço promocional e as peças
   vendidas separadamente. Produtos desativados ou sem estoque zerado
   saem da lista / ganham `outOfStock`.

   Muta o array recebido (splice/push) para que referências existentes
   (const products = [...]) continuem válidas. */
async function applyProductOverrides(list) {
  const [painel, overrides, promoPrices, piecesMap] = await Promise.all([
    CatalogDB.getAll(),
    ProductStatus.getAll(),
    PromoPrices.getAll(),
    ProductPieces.getAll(),
  ]);
  const painelPorId = Object.fromEntries(painel.map(p => [String(p.id), p]));
  const idsNoCatalogo = new Set(list.map(p => String(p.id)));

  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const id = String(p.id);
    const edit = painelPorId[id];
    const o    = overrides[id];

    /* 1. Edições do painel valem sobre o catálogo estático */
    if (edit) {
      p.name          = edit.name || p.name;
      p.price         = edit.price || p.price;
      p.originalPrice = edit.originalPrice > 0 ? edit.originalPrice : null;
      p.description   = edit.description || p.description;
      if (edit.sizes.length)  p.sizes  = edit.sizes;
      if (edit.colors.length) p.colors = edit.colors.map(_corParaObjeto);
      if (edit.images.length) { p.images = edit.images; p.image = edit.images[0]; }
      else if (edit.image)    { p.image  = edit.image; }
      if (edit.pieceOptions.length) p.pieceOptions = edit.pieceOptions;
    }

    /* 2. Ativo/inativo e estoque: a tabela manda; o antigo product_status
          continua valendo para quem ainda não tem linha na tabela. */
    const ativo = edit ? edit.status === 'active'
                : (o && o.active !== undefined ? o.active : (p.active !== false));
    if (!ativo) { list.splice(i, 1); continue; }

    p.outOfStock = edit
      ? Object.values(edit.stock).reduce((a, b) => a + (Number(b) || 0), 0) <= 0
      : !!(o && o.stock !== undefined && Number(o.stock) <= 0);

    /* 3. Promoção por último: o preço cheio riscado é o preço do painel */
    applyPromoPrice(p, promoPrices[id]);

    const pieces = piecesMap[id];
    if (!edit?.pieceOptions?.length && Array.isArray(pieces) && pieces.length) p.pieceOptions = pieces;
  }

  /* 4. Produtos criados no painel (não existem no catálogo estático) */
  for (const novo of painel) {
    if (idsNoCatalogo.has(String(novo.id))) continue;
    if (novo.status !== 'active' || !novo.name) continue;
    const total = Object.values(novo.stock).reduce((a, b) => a + (Number(b) || 0), 0);
    const p = {
      ...novo,
      colors: novo.colors.map(_corParaObjeto),
      originalPrice: novo.originalPrice > 0 ? novo.originalPrice : null,
      badge: null,
      outOfStock: total <= 0,
    };
    applyPromoPrice(p, promoPrices[String(novo.id)]);
    list.push(p);
  }

  return list;
}
