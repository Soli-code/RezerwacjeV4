/*
  # Inicjalna migracja - tworzenie wszystkich tabel

  1. Tabele
    - equipment - sprzęt
    - specifications - specyfikacje techniczne sprzętu
    - features - cechy sprzętu
    - variants - warianty sprzętu
    - reservations - rezerwacje
    - reservation_items - przedmioty w rezerwacji
    - reservation_history - historia zmian statusu rezerwacji
    - customers - klienci
    - profiles - profile użytkowników
    - maintenance_logs - logi konserwacji
    - email_logs - logi emaili
    - email_templates - szablony emaili
    - smtp_settings - konfiguracja SMTP
*/

-- Tabela equipment
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  promotional_price numeric CHECK (promotional_price >= 0),
  deposit numeric DEFAULT 0 CHECK (deposit >= 0),
  image text NOT NULL,
  categories text[] NOT NULL DEFAULT ARRAY['budowlany'],
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  purchase_price numeric CHECK (purchase_price >= 0),
  purchase_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_modified_by uuid REFERENCES auth.users(id)
);

-- Tabela specifications
CREATE TABLE IF NOT EXISTS specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabela features
CREATE TABLE IF NOT EXISTS features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabela variants
CREATE TABLE IF NOT EXISTS variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now()
);

-- Tabela customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela reservations
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  total_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rental_days integer,
  free_sunday boolean DEFAULT false,
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Tabela reservation_items
CREATE TABLE IF NOT EXISTS reservation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES equipment(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price_per_day numeric NOT NULL,
  deposit numeric DEFAULT 0
);

-- Tabela reservation_history
CREATE TABLE IF NOT EXISTS reservation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id),
  comment text
);

-- Tabela profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela maintenance_logs
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL,
  description text NOT NULL,
  cost numeric,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz DEFAULT now(),
  next_maintenance_due timestamptz,
  status text NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed')),
  attachments jsonb
);

-- Tabela email_templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  variables jsonb DEFAULT '{}',
  active boolean DEFAULT true,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name)
);

-- Tabela email_logs
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES email_templates(id),
  reservation_id uuid REFERENCES reservations(id),
  recipient text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced')),
  error_message text,
  sent_at timestamptz DEFAULT now(),
  smtp_response text,
  retry_count integer DEFAULT 0,
  next_retry_at timestamptz,
  delivery_attempts integer DEFAULT 0,
  last_error text,
  headers jsonb,
  delivered_at timestamptz,
  template_variables jsonb,
  error_details jsonb,
  metadata jsonb
);

-- Tabela smtp_settings
CREATE TABLE IF NOT EXISTS smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL,
  encryption text NOT NULL DEFAULT 'tls',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_test_result jsonb,
  last_test_date timestamptz
);

-- Włączenie RLS dla wszystkich tabel
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_settings ENABLE ROW LEVEL SECURITY;

-- Polityki dostępu dla equipment
CREATE POLICY "Public can view equipment"
  ON equipment FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage equipment"
  ON equipment FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla specifications
CREATE POLICY "Public can view specifications"
  ON specifications FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage specifications"
  ON specifications FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla features
CREATE POLICY "Public can view features"
  ON features FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage features"
  ON features FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla variants
CREATE POLICY "Public can view variants"
  ON variants FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage variants"
  ON variants FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla customers
CREATE POLICY "Customers can view and update their own data"
  ON customers FOR ALL
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Admins can manage all customers"
  ON customers FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla reservations
CREATE POLICY "Customers can view their own reservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (customer_id IN (
    SELECT id FROM customers
    WHERE auth.uid()::text = id::text
  ));

CREATE POLICY "Admins can manage all reservations"
  ON reservations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla reservation_items
CREATE POLICY "Customers can view their own reservation items"
  ON reservation_items FOR SELECT
  TO authenticated
  USING (reservation_id IN (
    SELECT id FROM reservations
    WHERE customer_id IN (
      SELECT id FROM customers
      WHERE auth.uid()::text = id::text
    )
  ));

CREATE POLICY "Admins can manage all reservation items"
  ON reservation_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla reservation_history
CREATE POLICY "Customers can view their own reservation history"
  ON reservation_history FOR SELECT
  TO authenticated
  USING (reservation_id IN (
    SELECT id FROM reservations
    WHERE customer_id IN (
      SELECT id FROM customers
      WHERE auth.uid()::text = id::text
    )
  ));

CREATE POLICY "Admins can manage all reservation history"
  ON reservation_history FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla profiles
CREATE POLICY "Users can view and update their own profile"
  ON profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla maintenance_logs
CREATE POLICY "Public can view maintenance logs"
  ON maintenance_logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage maintenance logs"
  ON maintenance_logs FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla email_logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (recipient = auth.email());

CREATE POLICY "Admins can manage all email logs"
  ON email_logs FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla email_templates
CREATE POLICY "Public can view email templates"
  ON email_templates FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only admins can manage email templates"
  ON email_templates FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));

-- Polityki dostępu dla smtp_settings
CREATE POLICY "Only admins can manage SMTP settings"
  ON smtp_settings FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  ));
