# Instrukcja odzyskania dostępu administratora w Supabase

## Problem

Na podstawie zrzutów ekranu zidentyfikowano poważne problemy z uprawnieniami w bazie danych Supabase:

1. Nie można usunąć użytkownika (błąd "Failed to delete user: Database error loading user")
2. Nie można zresetować hasła (błąd "Failed to send password recovery: failed to make recover request")
3. Istniejące konto administratora biuro@solrent.pl ma problemy z logowaniem
4. Regularne operacje SQL nie przynoszą skutku

## Rozwiązanie - radykalne podejście

Gdy zwykłe metody zawodzą, musimy zastosować bardziej drastyczne podejście. Poniżej znajdziesz plan awaryjny dla przywrócenia dostępu do systemu.

### Opcja 1: Utworzenie nowego administratora

#### Krok 1: Dodaj nowego użytkownika

1. Zaloguj się do panelu Supabase
2. Przejdź do Authentication > Users > Add User
3. Dodaj nowego użytkownika z adresem email (np. nowy-admin@solrent.pl) i hasłem
4. Skopiuj UUID nowego użytkownika (kolumna ID)

#### Krok 2: Wykonaj skrypt SQL

Wykonaj poniższy skrypt w SQL Editor z uprawnieniami administratora. Ten skrypt:
- Doda nowego użytkownika do tabeli profiles
- Ustawi mu flagę is_admin=TRUE
- Nada polityki bezwarunkowe, aby ominąć problemy z RLS

```sql
-- 3. Dodaj rekord do tabeli profiles
INSERT INTO public.profiles (id, is_admin, email)
SELECT id, TRUE, email
FROM auth.users
WHERE email = 'nowy-admin@solrent.pl'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.users.id
);

-- 4. Ustaw politykę bezwarunkową, aby nowy admin miał dostęp do wszystkiego
CREATE POLICY "Tymczasowa polityka dla testów" 
ON public.profiles 
FOR ALL USING (true);

-- 5. Ustaw podobną politykę dla tabeli admin_actions
CREATE POLICY "Tymczasowa polityka dla testów admin_actions" 
ON public.admin_actions 
FOR ALL USING (true);

-- 6. Nadaj pełne uprawnienia dla roli authenticated
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
```

#### Krok 3: Logowanie nowym kontem

Zaloguj się do aplikacji używając nowego konta administratora.

### Opcja 2: Naprawa bazy danych z Service Role

Jeśli Opcja 1 nie działa, możemy użyć uprawnień Service Role do naprawy bazy danych.

1. Utwórz nową funkcję w Supabase Edge Functions:
   - Przejdź do Edge Functions > Create New Function
   - Nazwij ją "fix-admin"
   - Wklej poniższy kod:

```javascript
// Funkcja naprawiająca uprawnienia administratora
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

serve(async (req) => {
  // Uzyskaj klucz z nagłówka autoryzacji
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Weryfikuj klucz - dla bezpieczeństwa ustaw własny klucz
  const key = authHeader.split(' ')[1];
  if (key !== 'tajnyKluczDostepowy123') {
    return new Response(JSON.stringify({ error: 'Invalid key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Inicjalizuj klienta Supabase z rolą service_role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // 1. Dodaj politykę bezwarunkową do tabeli profiles
    await supabaseAdmin.rpc('test_query', {
      query_str: `
        CREATE POLICY IF NOT EXISTS "emergency_access_policy" 
        ON public.profiles 
        FOR ALL USING (true);
      `
    });
    
    // 2. Dodaj rekord administratora do tabeli profiles
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const adminEmail = 'biuro@solrent.pl';
    
    const adminUser = users.users.find(user => user.email === adminEmail);
    if (adminUser) {
      await supabaseAdmin.from('profiles').upsert({
        id: adminUser.id,
        is_admin: true,
        email: adminUser.email
      });
    }
    
    // 3. Zwróć informacje o sukcesie
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Administrator access fixed',
      admin: adminUser ? adminUser.email : 'Not found'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

2. Uruchom funkcję z odpowiednim kluczem autoryzacyjnym przy użyciu cURL lub Postman
   - Wykonaj zapytanie POST do URL funkcji
   - Dodaj nagłówek `Authorization: Bearer tajnyKluczDostepowy123`

### Opcja 3: Ostateczność - resetowanie bazy danych

Jeśli nic innego nie działa, możemy zresetować bazę danych:

1. Wykonaj kopię zapasową ważnych danych
2. Przejdź do Project Settings > Database > Reset Database Password
3. Następnie możesz usunąć i utworzyć ponownie tabele
4. Ponownie skonfiguruj uprawnienia od podstaw

## Zawsze zmień hasła po odzyskaniu dostępu

Po odzyskaniu dostępu do systemu, natychmiast:
1. Zmień hasła wszystkich administratorów
2. Upewnij się, że polityki dostępu są prawidłowo skonfigurowane
3. Usuń polityki bezwarunkowe (te z `USING (true)`)
4. Wykonaj kopię zapasową bazy danych

## Kontakt z pomocą techniczną Supabase

Jeśli powyższe kroki nie przyniosą rezultatu, skontaktuj się z pomocą techniczną Supabase:
https://supabase.com/support 