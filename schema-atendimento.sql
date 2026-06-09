-- ============================================================
-- TABELAS DE ATENDIMENTO — Cor & Flor IA Support
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- Contatos (quem envia mensagem)
CREATE TABLE IF NOT EXISTS atd_contacts (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel              TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  channel_id           TEXT NOT NULL,          -- telefone ou instagram user id
  name                 TEXT,
  phone                TEXT,
  instagram_username   TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, channel_id)
);

-- Conversas
CREATE TABLE IF NOT EXISTS atd_conversations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id       UUID REFERENCES atd_contacts(id) ON DELETE CASCADE,
  channel          TEXT NOT NULL,
  status           TEXT DEFAULT 'bot' CHECK (status IN ('bot', 'waiting', 'human', 'resolved')),
  -- 'bot'     = IA respondendo automaticamente
  -- 'waiting' = IA pediu escalação, aguardando atendente
  -- 'human'   = atendente assumiu o controle
  -- 'resolved'= conversa encerrada
  phone_number_id  TEXT,                       -- ID do número WhatsApp (Meta)
  assigned_to      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens
CREATE TABLE IF NOT EXISTS atd_messages (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID REFERENCES atd_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'admin')),
  -- 'user'      = cliente
  -- 'assistant' = IA (Flora)
  -- 'admin'     = atendente humana
  content          TEXT NOT NULL,
  meta_message_id  TEXT,                       -- ID da mensagem no Meta (para deduplication)
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_atd_conversations_contact   ON atd_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_atd_conversations_status    ON atd_conversations(status);
CREATE INDEX IF NOT EXISTS idx_atd_conversations_updated   ON atd_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_atd_messages_conversation   ON atd_messages(conversation_id, created_at);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- As APIs usam a service_role_key (bypassa RLS).
-- O painel admin usa a anon key com JWT → precisa de RLS.

ALTER TABLE atd_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE atd_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE atd_messages     ENABLE ROW LEVEL SECURITY;

-- Apenas admins acessam pelo painel (com JWT de usuário)
CREATE POLICY "admin_only_contacts" ON atd_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_only_conversations" ON atd_conversations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_only_messages" ON atd_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Realtime (para o painel atualizar ao vivo) ──────────────────────────────
-- Habilite Realtime nas tabelas abaixo pelo painel Supabase:
-- Database → Replication → atd_conversations ✓
-- Database → Replication → atd_messages ✓
