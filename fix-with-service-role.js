import { createClient } from '@supabase/supabase-js';

// Dane konfiguracyjne Supabase
const SUPABASE_URL = 'https://klumxeclllfauamqnrckf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdW14ZWNsbGZhdWFtcW5yY2tmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTY0NzI3NSwiZXhwIjoyMDU3MjIzMjc1fQ.24k0Ssu_Gve-lqgN4HOlcqhvKYY_njvs3oz6Xkl5N_o';

// Utwórz klienta Supabase z Service Role (pełne uprawnienia)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Funkcja naprawiająca strukturę tabeli profiles
async function fixProfilesTable() {
  console.log('Sprawdzam strukturę tabeli profiles...');
  
  try {
    // 1. Pobierz strukturę tabeli profiles
    const { data: columns, error: columnsError } = await supabase.rpc(
      'test_query',
      { query_str: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles';
      `}
    );
    
    if (columnsError) {
      console.error('Błąd podczas pobierania struktury tabeli:', columnsError);
      return;
    }
    
    console.log('Aktualna struktura tabeli profiles:', columns);
    
    // 2. Dodawanie brakujących kolumn
    const missingColumns = [];
    const columnNames = columns.map(col => col.column_name);
    
    if (!columnNames.includes('email')) {
      missingColumns.push("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;");
    }
    
    if (!columnNames.includes('full_name')) {
      missingColumns.push("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;");
    }
    
    if (missingColumns.length > 0) {
      console.log('Dodaję brakujące kolumny...');
      for (const query of missingColumns) {
        const { error } = await supabase.rpc('test_query', { query_str: query });
        if (error) {
          console.error('Błąd podczas dodawania kolumny:', error);
        }
      }
    } else {
      console.log('Wszystkie wymagane kolumny istnieją.');
    }
    
    // 3. Aktualizuj kolumnę email w profilach administratorów
    console.log('Aktualizuję kolumnę email dla administratorów...');
    const { error: updateError } = await supabase.rpc(
      'test_query',
      { query_str: `
        UPDATE public.profiles p
        SET email = u.email
        FROM auth.users u
        WHERE p.id = u.id
        AND p.is_admin = TRUE
        AND (p.email IS NULL OR p.email = '');
      `}
    );
    
    if (updateError) {
      console.error('Błąd podczas aktualizacji email:', updateError);
    }
    
    // 4. Włącz Row Level Security
    console.log('Włączam Row Level Security...');
    const { error: rlsError } = await supabase.rpc(
      'test_query',
      { query_str: "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;" }
    );
    
    if (rlsError) {
      console.error('Błąd podczas włączania RLS:', rlsError);
    }
    
    // 5. Usuń istniejące polityki dostępu
    console.log('Usuwam istniejące polityki dostępu...');
    const { data: policies, error: policiesError } = await supabase.rpc(
      'test_query',
      { query_str: "SELECT policyname FROM pg_policies WHERE tablename = 'profiles';" }
    );
    
    if (policiesError) {
      console.error('Błąd podczas pobierania polityk:', policiesError);
    } else {
      for (const policy of policies) {
        const { error } = await supabase.rpc(
          'test_query',
          { query_str: `DROP POLICY IF EXISTS "${policy.policyname}" ON public.profiles;` }
        );
        
        if (error) {
          console.error(`Błąd podczas usuwania polityki ${policy.policyname}:`, error);
        }
      }
    }
    
    // 6. Tworzenie nowych polityk dostępu
    console.log('Tworzę nowe polityki dostępu...');
    
    // Polityka dla administratorów
    const { error: adminPolicyError } = await supabase.rpc(
      'test_query',
      { query_str: `
        CREATE POLICY "Administratorzy maja pelny dostep do profili" 
        ON public.profiles 
        FOR ALL USING (
          auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
        );
      `}
    );
    
    if (adminPolicyError) {
      console.error('Błąd podczas tworzenia polityki dla administratorów:', adminPolicyError);
    }
    
    // Polityka dla zwykłych użytkowników
    const { error: userPolicyError } = await supabase.rpc(
      'test_query',
      { query_str: `
        CREATE POLICY "Uzytkownicy moga odczytywac swoje profile" 
        ON public.profiles 
        FOR SELECT USING (
          auth.uid() = id
        );
      `}
    );
    
    if (userPolicyError) {
      console.error('Błąd podczas tworzenia polityki dla użytkowników:', userPolicyError);
    }
    
    // 7. Tworzenie tabeli admin_actions jeśli nie istnieje
    console.log('Tworzę tabelę admin_actions (jeśli nie istnieje)...');
    const { error: tableError } = await supabase.rpc(
      'test_query',
      { query_str: `
        CREATE TABLE IF NOT EXISTS public.admin_actions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id),
          action_type TEXT NOT NULL,
          action_details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `}
    );
    
    if (tableError) {
      console.error('Błąd podczas tworzenia tabeli admin_actions:', tableError);
    }
    
    // 8. Włącz RLS na tabeli admin_actions
    const { error: actionsRlsError } = await supabase.rpc(
      'test_query',
      { query_str: "ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;" }
    );
    
    if (actionsRlsError) {
      console.error('Błąd podczas włączania RLS dla admin_actions:', actionsRlsError);
    }
    
    // 9. Dodaj politykę dla admin_actions
    const { error: actionsPolicyError } = await supabase.rpc(
      'test_query',
      { query_str: `
        CREATE POLICY "Administratorzy maja pelny dostep do akcji" 
        ON public.admin_actions 
        FOR ALL USING (
          auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
        );
      `}
    );
    
    if (actionsPolicyError) {
      console.error('Błąd podczas tworzenia polityki dla admin_actions:', actionsPolicyError);
    }
    
    // 10. Nadaj uprawnienia dla użytkowników
    console.log('Nadaję uprawnienia dla użytkowników...');
    const { error: grantError1 } = await supabase.rpc(
      'test_query',
      { query_str: "GRANT USAGE ON SCHEMA public TO authenticated;" }
    );
    
    if (grantError1) {
      console.error('Błąd podczas nadawania uprawnień (1):', grantError1);
    }
    
    const { error: grantError2 } = await supabase.rpc(
      'test_query',
      { query_str: "GRANT SELECT, UPDATE ON public.profiles TO authenticated;" }
    );
    
    if (grantError2) {
      console.error('Błąd podczas nadawania uprawnień (2):', grantError2);
    }
    
    const { error: grantError3 } = await supabase.rpc(
      'test_query',
      { query_str: "GRANT SELECT, INSERT ON public.admin_actions TO authenticated;" }
    );
    
    if (grantError3) {
      console.error('Błąd podczas nadawania uprawnień (3):', grantError3);
    }
    
    // 11. Sprawdź profile administratorów
    console.log('Sprawdzam profile administratorów...');
    const { data: profiles, error: profilesError } = await supabase.rpc(
      'test_query',
      { query_str: `
        SELECT p.id, p.is_admin, p.email, u.email as auth_email
        FROM public.profiles p
        LEFT JOIN auth.users u ON p.id = u.id
        WHERE p.is_admin = TRUE;
      `}
    );
    
    if (profilesError) {
      console.error('Błąd podczas sprawdzania profili administratorów:', profilesError);
    } else {
      console.log('Profile administratorów:', profiles);
    }
    
    console.log('Wszystkie operacje zakończone.');
  } catch (error) {
    console.error('Wystąpił nieoczekiwany błąd:', error);
  }
}

// Uruchom funkcję naprawiającą
fixProfilesTable(); 