// Użyjmy składni CommonJS dla zgodności
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Debugging - sprawdź wersje
console.log("Node.js version:", process.version);
console.log("Supabase.js version:", require('@supabase/supabase-js/package.json').version);
console.log("Node-fetch version:", require('node-fetch/package.json').version);

// Dane konfiguracyjne Supabase
const SUPABASE_URL = 'https://klumxeclllfauamqnrckf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdW14ZWNsbGZhdWFtcW5yY2tmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTY0NzI3NSwiZXhwIjoyMDU3MjIzMjc1fQ.24k0Ssu_Gve-lqgN4HOlcqhvKYY_njvs3oz6Xkl5N_o';

// Utwórz klienta Supabase z Service Role (pełne uprawnienia)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    fetch: fetch
  }
});

// Sprawdźmy połączenie
console.log("Sprawdzam połączenie z Supabase...");
supabase.from('profiles').select('count', { count: 'exact', head: true })
  .then(response => {
    console.log("Odpowiedź z Supabase:", response);
    // Kontynuuj naprawę jeśli połączenie działa
    return fixBiuroSolrentAccount();
  })
  .then(result => {
    if (result) {
      console.log("Operacja zakończona sukcesem.");
    } else {
      console.log("Operacja zakończona niepowodzeniem.");
    }
  })
  .catch(error => {
    console.error("Błąd podczas sprawdzania połączenia:", error);
  });

// Naprawa konta biuro@solrent.pl
async function fixBiuroSolrentAccount() {
  console.log("Rozpoczynam naprawę konta biuro@solrent.pl...");
  
  try {
    // 1. Znajdź użytkownika po adresie email
    console.log("Szukam użytkownika biuro@solrent.pl...");
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error("Błąd podczas listowania użytkowników:", usersError);
      return false;
    }
    
    // Znajdź użytkownika biuro@solrent.pl
    const biuroUser = users.users.find(user => user.email === "biuro@solrent.pl");
    
    if (!biuroUser) {
      console.error("Nie znaleziono użytkownika biuro@solrent.pl");
      return false;
    }
    
    console.log("Znaleziono użytkownika:", biuroUser.id, biuroUser.email);
    
    // 2. Sprawdź, czy istnieje profil dla tego użytkownika
    console.log("Sprawdzam profil użytkownika...");
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', biuroUser.id)
      .single();
    
    if (profileError) {
      // Profil nie istnieje, tworzymy nowy
      console.log("Profil nie istnieje, tworzę nowy...");
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          id: biuroUser.id,
          email: biuroUser.email,
          is_admin: true,
          updated_at: new Date().toISOString()
        });
      
      if (createError) {
        console.error("Błąd podczas tworzenia profilu:", createError);
        return false;
      }
      
      console.log("Profil został utworzony pomyślnie");
    } else {
      // Profil istnieje, aktualizujemy go
      console.log("Profil istnieje, aktualizuję...");
      console.log("Obecny stan profilu:", profile);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_admin: true,
          email: biuroUser.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', biuroUser.id);
      
      if (updateError) {
        console.error("Błąd podczas aktualizacji profilu:", updateError);
        return false;
      }
      
      console.log("Profil został zaktualizowany pomyślnie");
    }
    
    // 3. Sprawdź uprawnienia do tabeli profiles
    console.log("Ustawiam uprawnienia dla tabeli profiles...");
    
    // Dodaj politykę dostępu dla administratorów
    const { error: policyError } = await supabase.rpc(
      'test_query',
      {
        query_str: `
          CREATE POLICY IF NOT EXISTS "Administratorzy maja pelny dostep do profili" 
          ON public.profiles 
          FOR ALL USING (
            auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
          );
        `
      }
    );
    
    if (policyError) {
      console.error("Błąd podczas tworzenia polityki:", policyError);
    } else {
      console.log("Polityka dostępu została utworzona/zaktualizowana");
    }
    
    // 4. Resetowanie hasła użytkownika (opcjonalne)
    console.log("Czy chcesz zresetować hasło dla użytkownika biuro@solrent.pl? (Usuń komentarz z kodu, jeśli tak)");
    /*
    const { error: resetError } = await supabase.auth.admin.updateUserById(
      biuroUser.id,
      { password: 'NoweHaslo123!' }
    );
    
    if (resetError) {
      console.error("Błąd podczas resetowania hasła:", resetError);
      return false;
    }
    
    console.log("Hasło zostało zresetowane pomyślnie");
    */
    
    console.log("Naprawa konta biuro@solrent.pl zakończona pomyślnie.");
    return true;
  } catch (error) {
    console.error("Wystąpił nieoczekiwany błąd:", error);
    return false;
  }
} 