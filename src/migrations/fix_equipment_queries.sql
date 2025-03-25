-- Migracja naprawiająca funkcje związane z zapytaniami do sprzętu
-- Ten skrypt należy uruchomić w panelu SQL Supabase

-- Funkcja do pobrania dostępnego sprzętu w danym przedziale czasowym
CREATE OR REPLACE FUNCTION public.get_available_equipment(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS SETOF equipment
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT e.*
  FROM equipment e
  WHERE e.id NOT IN (
    SELECT DISTINCT r.equipment_id
    FROM reservations r
    WHERE r.status NOT IN ('cancelled', 'rejected')
    AND (
      (r.start_date <= end_date AND r.end_date >= start_date)
    )
  )
  AND e.is_active = true
  ORDER BY e.category, e.name;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji get_available_equipment: %', SQLERRM;
    RETURN;
END;
$$;

-- Funkcja do pobrania rezerwacji sprzętu
CREATE OR REPLACE FUNCTION public.get_equipment_reservations(
  equipment_id uuid,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  customer_name text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    c.name as customer_name,
    r.start_date,
    r.end_date,
    r.status
  FROM 
    reservations r
    JOIN customers c ON r.customer_id = c.id
  WHERE 
    r.equipment_id = get_equipment_reservations.equipment_id
    AND (
      get_equipment_reservations.start_date IS NULL 
      OR r.end_date >= get_equipment_reservations.start_date
    )
    AND (
      get_equipment_reservations.end_date IS NULL 
      OR r.start_date <= get_equipment_reservations.end_date
    )
  ORDER BY 
    r.start_date ASC;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji get_equipment_reservations: %', SQLERRM;
    RETURN;
END;
$$;

-- Funkcja do sprawdzania dostępności sprzętu
CREATE OR REPLACE FUNCTION public.check_equipment_availability(
  equipment_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  exclude_reservation_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_available boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1
    FROM reservations r
    WHERE r.equipment_id = check_equipment_availability.equipment_id
    AND r.status NOT IN ('cancelled', 'rejected')
    AND (r.start_date <= end_date AND r.end_date >= start_date)
    AND (exclude_reservation_id IS NULL OR r.id != exclude_reservation_id)
  ) INTO is_available;

  RETURN is_available;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji check_equipment_availability: %', SQLERRM;
    RETURN false;
END;
$$; 