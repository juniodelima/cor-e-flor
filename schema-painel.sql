-- ================================================================
--  COR & FLOR — Painel no banco (produtos + configurações)
--
--  POR QUE ISSO EXISTE
--  Até aqui, os produtos e as configurações da loja ficavam salvos
--  só no navegador de quem editava (localStorage). Resultado: o que
--  uma pessoa editava não aparecia para a outra, sumia ao limpar o
--  navegador ou ao entrar de outro computador/celular, e as mudanças
--  de preço e estoque não chegavam na loja.
--
--  Depois de rodar este bloco, produtos e configurações passam a
--  morar no Supabase: valem para todos os administradores e a loja
--  lê direto daqui.
--
--  COMO RODAR: Supabase → SQL Editor → cole tudo → Run.
--  Pode rodar mais de uma vez sem problema.
-- ================================================================

-- ── 1. PRODUTOS ─────────────────────────────────────────────────
-- id é TEXT porque convive com os ids do catálogo ("1", "2", "38")
-- e com os criados no painel ("P8F3K2QA").
CREATE TABLE IF NOT EXISTS products (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT DEFAULT 'outros',
  price          NUMERIC(10,2) DEFAULT 0,
  original_price NUMERIC(10,2) DEFAULT 0,
  image          TEXT,
  images         JSONB DEFAULT '[]'::jsonb,
  description    TEXT,
  colors         JSONB DEFAULT '[]'::jsonb,
  sizes          JSONB DEFAULT '[]'::jsonb,
  size_type      TEXT DEFAULT 'letter',
  stock          JSONB DEFAULT '{}'::jsonb,
  piece_options  JSONB DEFAULT '[]'::jsonb,
  status         TEXT DEFAULT 'active',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante lê (a loja precisa mostrar preço e estoque);
-- só administrador escreve.
DROP POLICY IF EXISTS "products_read"  ON products;
DROP POLICY IF EXISTS "products_admin" ON products;

CREATE POLICY "products_read" ON products
  FOR SELECT USING (true);

CREATE POLICY "products_admin" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);


-- ── 2. CONFIGURAÇÕES DA LOJA ────────────────────────────────────
-- Vão para a tabela site_settings, que já existe, na chave `store_settings`:
-- nome da loja, CNPJ, endereço, telefone, frete e cupons. São dados que já
-- aparecem no site, então a leitura é pública.
--
-- A chave da OpenAI NÃO vai para o banco — continua só no navegador de quem
-- usa o painel. Mesmo assim, a leitura pública passa a ignorar qualquer chave
-- que comece com "private_", para nenhum segredo vazar por engano no futuro.
DROP POLICY IF EXISTS "site_settings_read" ON site_settings;

CREATE POLICY "site_settings_read" ON site_settings
  FOR SELECT USING (key NOT LIKE 'private_%');

-- (a policy "site_settings_admin" que já existe continua valendo e
--  dá acesso total ao administrador, inclusive às chaves private_)


-- ── 3. CONFERÊNCIA ──────────────────────────────────────────────
-- Depois de rodar, isto deve listar a tabela nova e as duas policies:
--   SELECT * FROM products;
--   SELECT policyname FROM pg_policies WHERE tablename IN ('products','site_settings');
