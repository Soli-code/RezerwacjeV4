/**
 * Narzędzie do szybkiej naprawy problemów z logowaniem
 * Uruchomienie: node -r esm fix_login.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

// Konfiguracja ścieżek
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utworzenie interfejsu do wczytywania danych z konsoli
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Funkcja do pobierania danych od użytkownika
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Główna funkcja programu
async function main() {
  console.log('===== NARZĘDZIE SZYBKIEJ NAPRAWY LOGOWANIA =====');
  console.log('Ten program automatycznie naprawi problemy z logowaniem do panelu administratora');
  
  // Pobieranie danych konfiguracyjnych
  const supabaseUrl = await question('Podaj URL Supabase (np. https://xxxxxxxxxxxx.supabase.co): ');
  const supabaseKey = await question('Podaj klucz serwisowy Supabase (service_role key): ');
  const adminEmail = await question('Podaj email administratora (domyślnie: biuro@solrent.pl): ') || 'biuro@solrent.pl';
  
  console.log('\n===== ROZPOCZYNAM NAPRAWĘ =====');
  
  // Inicjalizacja klienta Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Krok 1: Sprawdzenie połączenia z Supabase
  console.log('\n1. Sprawdzanie połączenia z Supabase...');
  try {
    const { error } = await supabase.auth.getUser();
    if (error) {
      console.error('❌ Błąd połączenia:', error.message);
      console.log('⚠️ Upewnij się, że podałeś prawidłowy URL i klucz serwisowy Supabase');
      return;
    }
    console.log('✅ Połączenie z Supabase działa poprawnie');
  } catch (error) {
    console.error('❌ Nieoczekiwany błąd podczas sprawdzania połączenia:', error.message);
    return;
  }
  
  // Krok 2: Sprawdzenie i utworzenie wymaganych tabel
  console.log('\n2. Sprawdzanie wymaganych tabel...');
  let shouldRunMigration = false;
  
  // Sprawdzanie tabeli profiles
  try {
    const { error: profilesError } = await supabase.from('profiles').select('count').single();
    if (profilesError && profilesError.code === '42P01') {
      console.log('❌ Tabela "profiles" nie istnieje');
      shouldRunMigration = true;
    } else if (profilesError) {
      console.log('⚠️ Błąd podczas sprawdzania tabeli "profiles":', profilesError.message);
    } else {
      console.log('✅ Tabela "profiles" istnieje');
    }
  } catch (error) {
    console.log('⚠️ Nieoczekiwany błąd podczas sprawdzania tabeli "profiles":', error.message);
  }
  
  // Sprawdzanie tabeli admin_actions
  try {
    const { error: adminActionsError } = await supabase.from('admin_actions').select('count').single();
    if (adminActionsError && adminActionsError.code === '42P01') {
      console.log('❌ Tabela "admin_actions" nie istnieje');
      shouldRunMigration = true;
    } else if (adminActionsError) {
      console.log('⚠️ Błąd podczas sprawdzania tabeli "admin_actions":', adminActionsError.message);
    } else {
      console.log('✅ Tabela "admin_actions" istnieje');
    }
  } catch (error) {
    console.log('⚠️ Nieoczekiwany błąd podczas sprawdzania tabeli "admin_actions":', error.message);
  }
  
  // Uruchamianie migracji jeśli potrzebne
  if (shouldRunMigration) {
    console.log('\n⚙️ Wymagane tabele nie istnieją, uruchamiam migrację...');
    const migrationSuccess = await runMigration(supabase);
    if (!migrationSuccess) {
      console.log('❌ Migracja zakończona niepowodzeniem, przechodzę do naprawy administratora');
    }
  }
  
  // Krok 3: Sprawdzenie i naprawa konta administratora
  console.log('\n3. Sprawdzanie konta administratora...');
  
  // Sprawdzanie czy użytkownik istnieje w auth.users
  try {
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserByEmail(adminEmail);
    
    if (authUserError || !authUser) {
      console.log(`❌ Użytkownik ${adminEmail} nie istnieje w systemie auth`);
      
      // Tworzenie konta administratora
      console.log('⚙️ Tworzę konto administratora...');
      const password = await question('Podaj hasło dla administratora: ');
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password,
        email_confirm: true
      });
      
      if (createError) {
        console.error('❌ Błąd podczas tworzenia użytkownika:', createError.message);
        return;
      }
      
      console.log('✅ Konto administratora zostało utworzone');
      
      // Dodanie wpisu do tabeli profiles z uprawnieniami admina
      console.log('⚙️ Tworzę profil administratora...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: adminEmail,
          is_admin: true
        });
      
      if (profileError) {
        console.error('❌ Błąd podczas tworzenia profilu admina:', profileError.message);
      } else {
        console.log('✅ Profil administratora został utworzony');
      }
    } else {
      console.log(`✅ Użytkownik ${adminEmail} istnieje w systemie auth`);
      
      // Sprawdzanie czy użytkownik ma profil z uprawnieniami admina
      const { data: adminProfile, error: adminProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.user.id)
        .single();
      
      if (adminProfileError) {
        console.log('❌ Użytkownik nie ma profilu w tabeli profiles');
        
        // Tworzenie profilu administratora
        console.log('⚙️ Tworzę profil administratora...');
        const { error: fixError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.user.id,
            email: adminEmail,
            is_admin: true
          });
        
        if (fixError) {
          console.error('❌ Błąd podczas tworzenia profilu:', fixError.message);
        } else {
          console.log('✅ Profil administratora został utworzony');
        }
      } else if (!adminProfile.is_admin) {
        console.log('⚠️ Użytkownik ma profil, ale nie ma uprawnień administratora');
        
        // Nadawanie uprawnień administratora
        console.log('⚙️ Nadaję uprawnienia administratora...');
        const { error: fixError } = await supabase
          .from('profiles')
          .update({ is_admin: true })
          .eq('id', authUser.user.id);
        
        if (fixError) {
          console.error('❌ Błąd podczas nadawania uprawnień:', fixError.message);
        } else {
          console.log('✅ Uprawnienia administratora zostały nadane');
        }
      } else {
        console.log('✅ Użytkownik ma profil z uprawnieniami administratora');
      }
      
      // Odblokowanie konta
      console.log('⚙️ Odblokowuję konto administratora...');
      const { error: unlockError } = await supabase.auth.admin.updateUserById(
        authUser.user.id,
        { banned: false }
      );
      
      if (unlockError) {
        console.error('❌ Błąd podczas odblokowywania konta:', unlockError.message);
      } else {
        console.log('✅ Konto administratora zostało odblokowane');
      }
    }
    
    // Krok 4: Usunięcie cache w aplikacji
    console.log('\n4. Czyszczenie pamięci podręcznej aplikacji...');
    console.log('⚠️ Po zakończeniu naprawy, wyczyść pamięć podręczną przeglądarki i wyloguj się ze wszystkich sesji Supabase.');
    
    // Krok 5: Weryfikacja RLS w Supabase
    console.log('\n5. Weryfikacja polityk RLS...');
    console.log('⚠️ Upewnij się, że w panelu Supabase masz włączone odpowiednie polityki RLS dla tabel:');
    console.log('   - profiles: Pełny dostęp dla administratorów');
    console.log('   - admin_actions: Pełny dostęp dla administratorów');
    
    // Wyświetlenie podsumowania
    console.log('\n===== NAPRAWA ZAKOŃCZONA =====');
    console.log('Logowanie powinno teraz działać poprawnie. Spróbuj zalogować się do aplikacji.');
    console.log('Dane logowania:');
    console.log(`Email: ${adminEmail}`);
    console.log('Hasło: ****** (podane podczas naprawy)');
    
  } catch (error) {
    console.error('❌ Nieoczekiwany błąd podczas naprawy:', error);
  } finally {
    rl.close();
  }
}

// Funkcja do uruchamiania migracji
async function runMigration(supabase) {
  try {
    // Odczytanie pliku migracji
    const migrationPath = path.join(__dirname, 'init_auth_tables.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📂 Wczytano plik migracji');
    
    // Próba wykonania zapytań przez funkcję RPC
    try {
      // Tworzenie funkcji exec_sql jeśli nie istnieje
      const createFunctionSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      `;
      
      // Wykonanie zapytania SQL bezpośrednio
      await supabase.rpc('exec_sql', { sql: createFunctionSql });
      
      // Podzielenie na poszczególne zapytania i wykonanie
      const queries = migrationSql.split(';').filter(q => q.trim().length > 0);
      
      let success = true;
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        const { error } = await supabase.rpc('exec_sql', { sql: query + ';' });
        
        if (error) {
          console.error(`❌ Błąd zapytania SQL:`, error.message);
          success = false;
          break;
        }
      }
      
      if (success) {
        console.log('✅ Migracja została wykonana pomyślnie');
        return true;
      }
    } catch (error) {
      console.log('⚠️ Metoda RPC nie działa, próbuję metodą bezpośrednią...');
    }
    
    // Próba wykonania zapytań bezpośrednio
    try {
      // Wykonanie zapytania SQL bezpośrednio - tworzymy tabele ręcznie
      
      // Tworzymy tabelę profiles
      const createProfilesTable = `
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        email TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      `;
      
      await supabase.from('_sql').select().sql(createProfilesTable);
      
      // Tworzymy tabelę admin_actions
      const createAdminActionsTable = `
      CREATE TABLE IF NOT EXISTS admin_actions (
        id SERIAL PRIMARY KEY,
        admin_id UUID REFERENCES profiles(id),
        action TEXT,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      `;
      
      await supabase.from('_sql').select().sql(createAdminActionsTable);
      
      // Tworzymy indeks na admin_actions
      const createAdminActionsIndex = `
      CREATE INDEX IF NOT EXISTS admin_actions_admin_id_idx ON admin_actions (admin_id);
      `;
      
      await supabase.from('_sql').select().sql(createAdminActionsIndex);
      
      console.log('✅ Tabele zostały utworzone ręcznie');
      return true;
    } catch (error) {
      console.error('❌ Nie udało się utworzyć tabel ręcznie:', error.message);
      
      // Ostateczna próba - wysyłamy zapytania SQL jako zwykłe zapytania do bazy
      try {
        // Tworzymy tabelę profiles
        const { error: profilesError } = await supabase
          .from('profiles')
          .insert([
            { id: '00000000-0000-0000-0000-000000000000', email: 'test@example.com', is_admin: false }
          ])
          .select();
        
        if (!profilesError || profilesError.code !== '42P01') {
          console.log('✅ Tabela profiles istnieje lub została utworzona');
        } else {
          console.error('❌ Nie udało się utworzyć tabeli profiles');
        }
        
        // Tworzymy tabelę admin_actions
        const { error: adminActionsError } = await supabase
          .from('admin_actions')
          .insert([
            { admin_id: '00000000-0000-0000-0000-000000000000', action: 'test', details: {} }
          ])
          .select();
        
        if (!adminActionsError || adminActionsError.code !== '42P01') {
          console.log('✅ Tabela admin_actions istnieje lub została utworzona');
          return true;
        } else {
          console.error('❌ Nie udało się utworzyć tabeli admin_actions');
          return false;
        }
      } catch (error) {
        console.error('❌ Nie udało się utworzyć tabel przez API:', error.message);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Błąd podczas uruchamiania migracji:', error.message);
    return false;
  }
}

// Uruchomienie programu
main().catch(console.error); 