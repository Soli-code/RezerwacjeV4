-- Skrypt inicjalizujący podstawowe tabele autoryzacji i profili
-- Uruchom go bezpośrednio w konsoli SQL Supabase lub z poziomu Supabase Dashboard

-- Upewnij się, że używamy schematu publicznego
SET search_path TO public;

-- Sprawdź czy tabela profiles istnieje, jeśli nie - utwórz ją
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        CREATE TABLE profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            avatar_url TEXT,
            is_admin BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Dodaj domyślnego użytkownika admin@solrent.pl z uprawnieniami administratora
        -- To jest bezpieczne, ponieważ użytkownik zostanie dodany tylko jeśli istnieje w auth.users
        INSERT INTO profiles (id, first_name, last_name, email, is_admin, created_at)
        SELECT id, 'Admin', 'Solrent', email, TRUE, NOW()
        FROM auth.users
        WHERE email = 'biuro@solrent.pl'
        ON CONFLICT (id) DO NOTHING;
    END IF;
END
$$;

-- Sprawdź czy tabela admin_actions istnieje, jeśli nie - utwórz ją
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_actions') THEN
        CREATE TABLE admin_actions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            action_type TEXT NOT NULL,
            action_details JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END
$$;

-- Sprawdź czy indeks na admin_actions istnieje
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'admin_actions' 
        AND indexname = 'admin_actions_user_id_idx'
    ) THEN
        CREATE INDEX admin_actions_user_id_idx ON admin_actions(user_id);
    END IF;
END
$$; 