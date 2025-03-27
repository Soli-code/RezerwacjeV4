-- Migracja naprawiająca funkcje i triggery związane z problemami autoryzacji
-- Ten skrypt należy uruchomić w panelu SQL Supabase

-- Najpierw usuń problematyczne polityki, które powodują rekurencję
DROP POLICY IF EXISTS "Administratorzy mają pełny dostęp do profili" ON profiles;
DROP POLICY IF EXISTS "Administratorzy mają pełny dostęp do sprzętu" ON equipment;

-- Funkcja sprawdzająca uprawnienia administratora
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = user_id AND is_admin = true
  );
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji check_is_admin: %', SQLERRM;
    RETURN false;
END;
$$;

-- Funkcja obsługująca autoryzację dla niektórych tabel
CREATE OR REPLACE FUNCTION public.authorize_admin_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  requesting_user_id uuid;
BEGIN
  -- Pobierz ID bieżącego użytkownika
  requesting_user_id := auth.uid();
  
  -- Sprawdź, czy użytkownik jest administratorem
  SELECT public.check_is_admin(requesting_user_id) INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Dostęp zabroniony: wymagane uprawnienia administratora';
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji authorize_admin_action: %', SQLERRM;
    RAISE EXCEPTION 'Błąd autoryzacji: %', SQLERRM;
END;
$$;

-- Funkcja do logowania działań w systemie
CREATE OR REPLACE FUNCTION public.log_auth_event(event_type text, user_id uuid, details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auth_logs (event_type, user_id, details, created_at)
  VALUES (event_type, user_id, details, now());
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji log_auth_event: %', SQLERRM;
END;
$$;

-- Upewnij się, że tabela auth_logs istnieje
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Usuń istniejące triggery, jeśli istnieją, aby uniknąć duplikacji
DROP TRIGGER IF EXISTS authorize_admin_trigger ON profiles;
DROP TRIGGER IF EXISTS authorize_admin_trigger ON equipment;
DROP TRIGGER IF EXISTS authorize_admin_trigger ON reservations;

-- Dodaj triggery autoryzacji do ważnych tabel
CREATE TRIGGER authorize_admin_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.is_admin IS DISTINCT FROM NEW.is_admin)
EXECUTE FUNCTION authorize_admin_action();

CREATE TRIGGER authorize_admin_trigger
BEFORE UPDATE OR DELETE ON equipment
FOR EACH ROW
EXECUTE FUNCTION authorize_admin_action();

-- Dodaj uprawnienia RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Dodaj NOWE polityki dostępu bez rekurencji
CREATE POLICY "Administratorzy mają pełny dostęp do profili"
ON profiles FOR ALL
TO authenticated
USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Administratorzy mają pełny dostęp do sprzętu"
ON equipment FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Funkcja do pobierania danych dla pipeline
CREATE OR REPLACE FUNCTION public.get_admin_pipeline_data(p_date_range text, p_status text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  start_date timestamp;
  end_date timestamp;
BEGIN
  -- Ustaw daty na podstawie parametru p_date_range
  CASE p_date_range
    WHEN '7days' THEN
      start_date := NOW() - INTERVAL '7 days';
      end_date := NOW();
    WHEN '30days' THEN
      start_date := NOW() - INTERVAL '30 days';
      end_date := NOW();
    WHEN '90days' THEN
      start_date := NOW() - INTERVAL '90 days';
      end_date := NOW();
    ELSE
      start_date := NOW() - INTERVAL '30 days';
      end_date := NOW();
  END CASE;

  -- Pobierz dane rezerwacji
  WITH reservation_data AS (
    SELECT 
      r.id,
      r.status,
      r.start_date,
      r.end_date,
      r.total_price,
      jsonb_build_object(
        'id', c.id,
        'first_name', c.first_name,
        'last_name', c.last_name,
        'email', c.email,
        'phone', c.phone,
        'company_name', c.company_name,
        'company_nip', c.company_nip
      ) as customer,
      jsonb_agg(
        jsonb_build_object(
          'id', ri.id,
          'equipment_name', e.name,
          'quantity', ri.quantity
        )
      ) as items
    FROM reservations r
    LEFT JOIN customers c ON r.customer_id = c.id
    LEFT JOIN reservation_items ri ON r.id = ri.reservation_id
    LEFT JOIN equipment e ON ri.equipment_id = e.id
    WHERE r.start_date >= start_date
    AND r.start_date <= end_date
    AND r.status = ANY(p_status)
    GROUP BY r.id, c.id
  )
  SELECT jsonb_build_object(
    'columns', jsonb_agg(
      jsonb_build_object(
        'id', status,
        'title', 
          CASE status
            WHEN 'pending' THEN 'Oczekujące'
            WHEN 'confirmed' THEN 'Potwierdzone'
            WHEN 'picked_up' THEN 'Odebrane'
            WHEN 'completed' THEN 'Zakończone'
            WHEN 'archived' THEN 'Historyczne'
            WHEN 'cancelled' THEN 'Anulowane'
            ELSE status
          END,
        'reservations', jsonb_agg(
          jsonb_build_object(
            'id', id,
            'customer', customer,
            'dates', jsonb_build_object(
              'start', start_date::text,
              'end', end_date::text
            ),
            'total_price', total_price,
            'items', items
          )
        )
      )
    )
  ) INTO result
  FROM reservation_data
  GROUP BY status;

  -- Dodaj logowanie
  RAISE LOG 'Pipeline data query parameters: date_range=%, status=%', p_date_range, p_status;
  RAISE LOG 'Pipeline data result: %', result;

  RETURN result;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in get_admin_pipeline_data: %', SQLERRM;
    RAISE;
END;
$$; 