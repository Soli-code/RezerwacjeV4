# Instrukcja uruchomienia migracji Supabase

Ten katalog zawiera skrypty migracji do inicjalizacji i naprawy bazy danych Supabase.

## Jak uruchomić migrację

### Opcja 1: Przez panel Supabase

1. Zaloguj się do [Panelu Supabase](https://app.supabase.com)
2. Wybierz swój projekt
3. Przejdź do zakładki "SQL Editor"
4. Utwórz nowe zapytanie (New query)
5. Skopiuj i wklej zawartość pliku `init_auth_tables.sql` 
6. Uruchom zapytanie (Run)

### Opcja 2: Przez API REST

Możesz wykonać migrację programowo przy użyciu Postmana lub fetch:

```javascript
// Przykład użycia fetch do uruchomienia SQL
const runMigration = async () => {
  const SUPABASE_URL = 'YOUR_SUPABASE_URL';
  const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_KEY'; // Uwaga: to musi być SERVICE_KEY, nie ANON_KEY
  
  const sql = `
    -- Tutaj wklej zawartość init_auth_tables.sql
  `;
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({
      query: sql,
    }),
  });
  
  const result = await response.json();
  console.log('Migration result:', result);
};
```

### Opcja 3: Przez Supabase CLI

Jeśli masz zainstalowane Supabase CLI, możesz uruchomić:

```bash
supabase db execute < init_auth_tables.sql
```

## Rozwiązywanie problemów z logowaniem

Jeśli nadal występują problemy z logowaniem do panelu administracyjnego:

1. Sprawdź czy użytkownik `biuro@solrent.pl` istnieje w tabeli `auth.users`
2. Sprawdź czy ten użytkownik ma wpis w tabeli `public.profiles` z `is_admin = true`
3. Zweryfikuj uprawnienia i polityki RLS w panelu Supabase

### Szybka naprawa profilu administratora przez SQL

```sql
-- Upewnij się, że użytkownik ma profil z uprawnieniami administratora
INSERT INTO public.profiles (id, email, is_admin)
SELECT id, email, TRUE
FROM auth.users
WHERE email = 'biuro@solrent.pl'
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
``` 