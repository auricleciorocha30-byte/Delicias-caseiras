
-- Script de Configuração para Delícias Caseiras
-- Este script configura a estrutura necessária no Supabase.

-- 1. Categorias (ID robusto com UUID)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY DEFAULT 'cat_' || replace(gen_random_uuid()::text, '-', ''),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Produtos
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY DEFAULT 'prod_' || replace(gen_random_uuid()::text, '-', ''),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category TEXT REFERENCES categories(name) ON UPDATE CASCADE,
    description TEXT,
    image TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cupons
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY DEFAULT 'coup_' || replace(gen_random_uuid()::text, '-', ''),
    code TEXT UNIQUE NOT NULL,
    percentage INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    scope_type TEXT CHECK (scope_type IN ('all', 'category', 'product')),
    scope_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Configuração de Fidelidade
CREATE TABLE IF NOT EXISTS loyalty_config (
    id INT PRIMARY KEY DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    spending_goal DECIMAL(10,2) DEFAULT 100.00,
    scope_type TEXT DEFAULT 'all',
    scope_value TEXT
);

-- 5. Usuários do Programa de Fidelidade
CREATE TABLE IF NOT EXISTS loyalty_users (
    phone TEXT PRIMARY KEY,
    name TEXT,
    accumulated DECIMAL(10,2) DEFAULT 0.00,
    last_update TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Configuração da Loja
CREATE TABLE IF NOT EXISTS store_config (
    id INT PRIMARY KEY DEFAULT 1,
    tables_enabled BOOLEAN DEFAULT true,
    delivery_enabled BOOLEAN DEFAULT true,
    counter_enabled BOOLEAN DEFAULT true,
    status_panel_enabled BOOLEAN DEFAULT true
);

-- 7. Controle de Mesas e Pedidos
CREATE TABLE IF NOT EXISTS tables (
    id INT PRIMARY KEY,
    status TEXT DEFAULT 'free' CHECK (status IN ('free', 'occupied')),
    current_order JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE store_config;
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- 8. RLS - Segurança
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Políticas Públicas
CREATE POLICY "Public Select Cats" ON categories FOR SELECT USING (true);
CREATE POLICY "Public Select Prods" ON products FOR SELECT USING (true);
CREATE POLICY "Public Select Coups" ON coupons FOR SELECT USING (true);
CREATE POLICY "Public Select Loyalty" ON loyalty_config FOR SELECT USING (true);
CREATE POLICY "Public Select Store" ON store_config FOR SELECT USING (true);
CREATE POLICY "Public Select Tables" ON tables FOR SELECT USING (true);
CREATE POLICY "Public Select LUsers" ON loyalty_users FOR SELECT USING (true);

-- Políticas de Cliente
CREATE POLICY "Client Insert Tables" ON tables FOR INSERT WITH CHECK (true);
CREATE POLICY "Client Update Tables" ON tables FOR UPDATE USING (true);
CREATE POLICY "Client Insert LUsers" ON loyalty_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Client Update LUsers" ON loyalty_users FOR UPDATE USING (true);

-- Políticas de Admin (Apenas Autenticados)
CREATE POLICY "Admin All Cats" ON categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Prods" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Coups" ON coupons FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Loyalty" ON loyalty_config FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All LUsers" ON loyalty_users FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Store" ON store_config FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin All Tables" ON tables FOR ALL TO authenticated USING (true);

-- Dados Iniciais
INSERT INTO store_config (id, tables_enabled, delivery_enabled, counter_enabled, status_panel_enabled) 
VALUES (1, true, true, true, true) ON CONFLICT (id) DO NOTHING;

INSERT INTO loyalty_config (id, is_active, spending_goal, scope_type) 
VALUES (1, false, 100.00, 'all') ON CONFLICT (id) DO NOTHING;

-- Inserção de Categorias com nomes únicos (o ID será gerado automaticamente para cada uma)
INSERT INTO categories (name) VALUES ('Combos') ON CONFLICT (name) DO NOTHING;
INSERT INTO categories (name) VALUES ('Cafeteria') ON CONFLICT (name) DO NOTHING;
INSERT INTO categories (name) VALUES ('Salgados') ON CONFLICT (name) DO NOTHING;
INSERT INTO categories (name) VALUES ('Doces') ON CONFLICT (name) DO NOTHING;
INSERT INTO categories (name) VALUES ('Bebidas') ON CONFLICT (name) DO NOTHING;

-- Inserção das 12 Mesas Físicas
INSERT INTO tables (id, status) SELECT generate_series(1, 12), 'free' ON CONFLICT DO NOTHING;
