/**
 * Narzędzie do sprawdzania stanu bazy danych Supabase
 * Uruchomienie: node -r esm check_db_status.js
 */

// Importy potrzebne do działania skryptu
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
  console.log('===== Narzędzie diagnostyczne Supabase =====');
  
  // Pobieranie danych konfiguracyjnych
  const supabaseUrl = await question('Podaj URL Supabase (np. https://xxxxxxxxxxxx.supabase.co): ');
  const supabaseKey = await question('Podaj klucz serwisowy Supabase (service_role key): ');
  
  // Inicjalizacja klienta Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('\n===== Sprawdzanie połączenia z Supabase =====');
  try {
    // Testowanie połączenia
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error) {
      console.error('❌ Błąd połączenia:', error.message);
      return;
    }
    
    console.log('✅ Połączenie z Supabase działa poprawnie');
    
    // Sprawdzanie tabel
    console.log('\n===== Sprawdzanie tabel =====');
    
    // Sprawdzanie tabeli profiles
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('count').single();
    
    if (profilesError) {
      if (profilesError.code === '42P01') {
        console.error('❌ Tabela "profiles" nie istnieje!');
        await runMigration(supabase);
      } else {
        console.error('❌ Błąd podczas sprawdzania tabeli "profiles":', profilesError.message);
      }
    } else {
      console.log(`✅ Tabela "profiles" istnieje, liczba rekordów: ${profiles.count}`);
    }
    
    // Sprawdzanie tabeli admin_actions
    const { data: adminActions, error: adminActionsError } = await supabase.from('admin_actions').select('count').single();
    
    if (adminActionsError) {
      if (adminActionsError.code === '42P01') {
        console.error('❌ Tabela "admin_actions" nie istnieje!');
        await runMigration(supabase);
      } else {
        console.error('❌ Błąd podczas sprawdzania tabeli "admin_actions":', adminActionsError.message);
      }
    } else {
      console.log(`✅ Tabela "admin_actions" istnieje, liczba rekordów: ${adminActions.count}`);
    }
    
    // Sprawdzanie użytkownika administratora
    console.log('\n===== Sprawdzanie konta administratora =====');
    const adminEmail = await question('Podaj email administratora (domyślnie: biuro@solrent.pl): ') || 'biuro@solrent.pl';
    
    // Sprawdzanie czy użytkownik istnieje w auth.users
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserByEmail(adminEmail);
    
    if (authUserError || !authUser) {
      console.error(`❌ Użytkownik ${adminEmail} nie istnieje w systemie auth!`);
      
      const shouldCreate = await question('Czy chcesz utworzyć tego użytkownika? (t/n): ');
      if (shouldCreate.toLowerCase() === 't') {
        const password = await question('Podaj hasło dla nowego użytkownika: ');
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: adminEmail,
          password,
          email_confirm: true
        });
        
        if (createError) {
          console.error('❌ Błąd podczas tworzenia użytkownika:', createError.message);
        } else {
          console.log('✅ Użytkownik został utworzony');
          
          // Dodanie wpisu do tabeli profiles z uprawnieniami admina
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: newUser.id,
              email: adminEmail,
              is_admin: true
            });
          
          if (profileError) {
            console.error('❌ Błąd podczas tworzenia profilu admina:', profileError.message);
          } else {
            console.log('✅ Profil administratora został utworzony');
          }
        }
      }
    } else {
      console.log(`✅ Użytkownik ${adminEmail} istnieje w systemie auth`);
      
      // Sprawdzanie czy użytkownik ma profil z uprawnieniami admina
      const { data: adminProfile, error: adminProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.user.id)
        .single();
      
      if (adminProfileError || !adminProfile) {
        console.error('❌ Użytkownik nie ma profilu w tabeli profiles!');
        
        const shouldFix = await question('Czy chcesz utworzyć profil administratora? (t/n): ');
        if (shouldFix.toLowerCase() === 't') {
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
        }
      } else if (!adminProfile.is_admin) {
        console.error('❌ Użytkownik ma profil, ale nie ma uprawnień administratora!');
        
        const shouldFix = await question('Czy chcesz nadać uprawnienia administratora? (t/n): ');
        if (shouldFix.toLowerCase() === 't') {
          const { error: fixError } = await supabase
            .from('profiles')
            .update({ is_admin: true })
            .eq('id', authUser.user.id);
          
          if (fixError) {
            console.error('❌ Błąd podczas nadawania uprawnień:', fixError.message);
          } else {
            console.log('✅ Uprawnienia administratora zostały nadane');
          }
        }
      } else {
        console.log('✅ Użytkownik ma profil z uprawnieniami administratora');
      }
    }
    
    console.log('\n===== Podsumowanie =====');
    console.log('Diagnostyka zakończona. Jeśli wszystkie problemy zostały naprawione,');
    console.log('powinieneś móc zalogować się do panelu administracyjnego.');
    console.log('Jeśli nadal występują problemy, wykonaj migrację ręcznie zgodnie z instrukcją w README.md');
    
  } catch (error) {
    console.error('Nieoczekiwany błąd:', error);
  } finally {
    rl.close();
  }
}

// Funkcja do uruchamiania migracji
async function runMigration(supabase) {
  console.log('\n===== Uruchamianie migracji =====');
  
  try {
    // Odczytanie pliku migracji
    const migrationPath = path.join(__dirname, 'init_auth_tables.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Podzielenie na poszczególne zapytania i wykonanie
    const queries = migrationSql.split(';').filter(q => q.trim().length > 0);
    
    for (const query of queries) {
      const { error } = await supabase.rpc('exec_sql', { sql: query + ';' });
      
      if (error) {
        console.error('❌ Błąd podczas wykonywania migracji:', error.message);
        return false;
      }
    }
    
    console.log('✅ Migracja została wykonana pomyślnie');
    return true;
  } catch (error) {
    console.error('❌ Błąd podczas uruchamiania migracji:', error.message);
    return false;
  }
}

// Uruchomienie programu
main().catch(console.error); 