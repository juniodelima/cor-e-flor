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
