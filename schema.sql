-- ================================================================
--  COR & FLOR — Supabase Schema
--  Execute no: Dashboard → SQL Editor → New Query → Run All
-- ================================================================

-- 1. PERFIS DE CLIENTES (estende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT,
  phone      TEXT,
  is_admin   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Trigger: cria perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. NEWSLETTER
CREATE TABLE IF NOT EXISTS newsletter (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE newsletter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter_insert" ON newsletter FOR INSERT WITH CHECK (true);
CREATE POLICY "newsletter_admin"  ON newsletter FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 3. MENSAGENS DE CONTATO
CREATE TABLE IF NOT EXISTS contacts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT,
  message    TEXT NOT NULL,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_insert" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "contacts_admin"  ON contacts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 4. PEDIDOS
CREATE TABLE IF NOT EXISTS orders (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id    UUID REFERENCES profiles(id),
  customer_name  TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  items          JSONB NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  discount       DECIMAL(10,2) DEFAULT 0,
  freight        DECIMAL(10,2) DEFAULT 0,
  freight_service TEXT DEFAULT 'PAC',
  total          DECIMAL(10,2) NOT NULL,
  coupon_code    TEXT,
  address        JSONB,
  status         TEXT DEFAULT 'novo'
                   CHECK (status IN ('novo','confirmado','em_preparo','enviado','entregue','cancelado')),
  notes          TEXT,
  payment_id     TEXT,
  payment_status TEXT DEFAULT 'pendente',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
-- Bancos criados antes das colunas de frete: rode estas duas linhas
ALTER TABLE orders ADD COLUMN IF NOT EXISTS freight DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS freight_service TEXT DEFAULT 'PAC';

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_own"    ON orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "orders_admin"  ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 5. VENDAS FÍSICAS
CREATE TABLE IF NOT EXISTS physical_sales (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product        TEXT NOT NULL,
  category       TEXT DEFAULT 'outros',
  catalog_product_id TEXT,
  size           TEXT,
  quantity       INTEGER DEFAULT 1,
  unit_price     DECIMAL(10,2) NOT NULL,
  discount       DECIMAL(10,2) DEFAULT 0,
  total          DECIMAL(10,2) NOT NULL,
  payment        TEXT,
  seller         TEXT,
  customer       TEXT,
  details        TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE physical_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_physical" ON physical_sales FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 6. FAVORITOS
CREATE TABLE IF NOT EXISTS favorites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  product_id  INT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_own" ON favorites FOR ALL
  USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

-- 6. AVALIAÇÕES
CREATE TABLE IF NOT EXISTS reviews (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id    INT NOT NULL,
  customer_id   UUID REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  rating        INT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  body          TEXT,
  approved      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read"   ON reviews FOR SELECT USING (approved = true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "reviews_admin"  ON reviews FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 7. LISTA DE ESPERA (Avise-me)
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id INT NOT NULL,
  email      TEXT NOT NULL,
  size       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "waitlist_admin"  ON waitlist FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 8. CUPONS DE DESCONTO
CREATE TABLE IF NOT EXISTS coupons (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,
  discount_type  TEXT CHECK (discount_type IN ('percent','fixed','frete')) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_order      DECIMAL(10,2) DEFAULT 0,
  max_uses       INT,
  uses           INT DEFAULT 0,
  active         BOOLEAN DEFAULT TRUE,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_read"  ON coupons FOR SELECT USING (active = true);
CREATE POLICY "coupons_admin" ON coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ================================================================
--  DADOS INICIAIS — Cupom de boas-vindas para testes
-- ================================================================
INSERT INTO coupons (code, discount_type, discount_value, min_order, active)
VALUES ('BEMVINDA10', 'percent', 10, 150, true)
ON CONFLICT (code) DO NOTHING;

-- ================================================================
--  9. CONVITES ADMIN
-- ================================================================
CREATE TABLE IF NOT EXISTS admin_invites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  used       BOOLEAN DEFAULT FALSE,
  used_by    UUID REFERENCES profiles(id),
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

-- Anyone can SELECT unused invites (needed to validate on registration page)
CREATE POLICY "invites_check" ON admin_invites FOR SELECT USING (used = false);

-- Only admins can create/manage invites
CREATE POLICY "invites_admin" ON admin_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Function: validate invite code + set user as admin (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION use_admin_invite(p_code TEXT, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite_id UUID;
BEGIN
  SELECT id INTO v_invite_id
  FROM admin_invites
  WHERE code = p_code
    AND used = false
    AND (expires_at IS NULL OR expires_at > NOW());

  IF v_invite_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE admin_invites
  SET used = true, used_by = p_user_id, used_at = NOW()
  WHERE id = v_invite_id;

  UPDATE profiles SET is_admin = true WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Cupom PRIMEIRA: frete grátis para primeira compra acima de R$ 150
INSERT INTO coupons (code, discount_type, discount_value, min_order, active)
VALUES ('PRIMEIRA', 'frete', 0, 150, true)
ON CONFLICT (code) DO NOTHING;

-- ================================================================
--  10. VALE PRESENTE
-- ================================================================
CREATE TABLE IF NOT EXISTS gift_cards (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  to_name         TEXT NOT NULL,
  to_email        TEXT NOT NULL,
  from_name       TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  message         TEXT,
  status          TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','active','used','expired')),
  used            BOOLEAN DEFAULT FALSE,
  used_by_order   UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gc_insert" ON gift_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "gc_admin"  ON gift_cards FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ================================================================
--  11. CONFIGURAÇÕES DO SITE (ex: produtos das Promos do Dia)
-- ================================================================
CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_settings_read"  ON site_settings FOR SELECT USING (true);
CREATE POLICY "site_settings_admin" ON site_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ================================================================
--  12. SEGURANÇA (hardening) — rode este bloco inteiro no SQL Editor
-- ================================================================

-- (a) CRÍTICO: impede que um usuário logado se auto-promova a admin.
--     A política "profiles_own" permite UPDATE na própria linha, o que
--     incluía a coluna is_admin. Revogamos o update só dessa coluna.
REVOKE UPDATE (is_admin) ON profiles FROM anon, authenticated;

-- (b) CRÍTICO: a política "invites_check" deixava QUALQUER pessoa listar
--     os códigos de convite admin não usados (e virar admin com eles).
--     Trocamos por uma função que só confirma um código exato.
DROP POLICY IF EXISTS "invites_check" ON admin_invites;
CREATE OR REPLACE FUNCTION check_admin_invite(p_code TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_invites
    WHERE code = p_code
      AND used = false
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- (c) A política "coupons_read" deixava qualquer pessoa listar TODOS os
--     cupons ativos da loja. Trocamos por função que retorna apenas o
--     cupom de um código exato informado.
DROP POLICY IF EXISTS "coupons_read" ON coupons;
CREATE OR REPLACE FUNCTION get_coupon(p_code TEXT)
RETURNS SETOF coupons LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM coupons
  WHERE code = UPPER(TRIM(p_code)) AND active = true
  LIMIT 1;
$$;

-- (d) Vale presente é criado apenas pelo servidor (service role, ignora
--     RLS). A política pública de INSERT permitia forjar cartões ativos.
DROP POLICY IF EXISTS "gc_insert" ON gift_cards;

-- (e) Pedidos agora são criados pelo servidor (api/payment.js) somente
--     após o pagamento ser aceito pelo Mercado Pago. O INSERT público
--     permitia forjar pedidos "pagos" sem pagar nada.
--     ⚠ Rode SOMENTE depois do deploy que cria pedidos no servidor.
DROP POLICY IF EXISTS "orders_insert" ON orders;

-- ================================================================
--  PRIMEIRO ADMIN — execute manualmente após criar a conta
--  Substitua pelo e-mail cadastrado no Supabase Auth
-- ================================================================
-- UPDATE profiles SET is_admin = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'juniodelima7@gmail.com');

