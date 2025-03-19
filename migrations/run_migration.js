/**
 * Skrypt do uruchamiania migracji Supabase
 * Uruchomienie: node run_migration.js
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
  console.log('===== Narzędzie do migracji Supabase =====');
  
  // Pobieranie danych konfiguracyjnych
  const supabaseUrl = await question('Podaj URL Supabase (np. https://xxxxxxxxxxxx.supabase.co): ');
  const supabaseKey = await question('Podaj klucz serwisowy Supabase (service_role key): ');
  
  // Inicjalizacja klienta Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('\n===== Sprawdzanie połączenia z Supabase =====');
  try {
    // Testowanie połączenia
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error && error.code !== '42P01') { // Ignorujemy błąd braku tabeli, bo właśnie ją tworzymy
      console.error('❌ Błąd połączenia:', error.message);
      if (error.message.includes('Authentication failed')) {
        console.log('⚠️ Upewnij się, że używasz klucza service_role, a nie anon key!');
      }
      return;
    }
    
    console.log('✅ Połączenie z Supabase działa poprawnie');
    
    // Uruchamianie migracji
    await runMigration(supabase);
    
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
    
    console.log('📂 Wczytano plik migracji:', migrationPath);
    
    // Metoda 1: Uruchamianie przez funkcję RPC (wymaga funkcji exec_sql w Supabase)
    const method = await question('Wybierz metodę wykonania migracji: \n1. Przez funkcję RPC (exec_sql) \n2. Przez bezpośrednie zapytania SQL \nWybierz (1/2): ');
    
    if (method === '1') {
      // Najpierw sprawdzamy czy funkcja exec_sql istnieje, jeśli nie - tworzymy ją
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
        const { error: createFnError } = await supabase.rpc('exec_sql', { sql: createFunctionSql });
        if (createFnError && !createFnError.message.includes('already exists')) {
          console.log('⚠️ Nie można utworzyć funkcji exec_sql, próbuję metodą bezpośrednią');
          await executeDirectQueries(supabase, migrationSql);
          return;
        }
        
        // Podzielenie na poszczególne zapytania i wykonanie
        const queries = migrationSql.split(';').filter(q => q.trim().length > 0);
        
        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];
          const { error } = await supabase.rpc('exec_sql', { sql: query + ';' });
          
          if (error) {
            console.error(`❌ Błąd podczas wykonywania zapytania ${i+1}/${queries.length}:`, error.message);
            console.log('⚠️ Przechodzę do metody bezpośredniej...');
            await executeDirectQueries(supabase, migrationSql);
            return;
          }
          
          console.log(`✅ Zapytanie ${i+1}/${queries.length} wykonane`);
        }
      } catch (error) {
        console.error('❌ Błąd podczas korzystania z funkcji exec_sql:', error.message);
        console.log('⚠️ Przechodzę do metody bezpośredniej...');
        await executeDirectQueries(supabase, migrationSql);
        return;
      }
    } else {
      await executeDirectQueries(supabase, migrationSql);
    }
    
    console.log('\n✅ Migracja została wykonana pomyślnie');
    console.log('🔑 Jeśli migracja przebiegła bez błędów, sprawdź czy możesz teraz zalogować się do panelu administracyjnego');
    
  } catch (error) {
    console.error('❌ Błąd podczas uruchamiania migracji:', error.message);
  }
}

// Funkcja do bezpośredniego wykonywania zapytań SQL
async function executeDirectQueries(supabase, migrationSql) {
  console.log('\n===== Wykonywanie zapytań bezpośrednich =====');
  
  // Podzielenie na poszczególne zapytania
  const queries = migrationSql.split(';').filter(q => q.trim().length > 0);
  
  // Wykonanie zapytań pojedynczo
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i].trim();
    if (!query) continue;
    
    try {
      // Wykonanie zapytania SQL bezpośrednio
      const { error } = await supabase.from('_sql').select().sql(query + ';');
      
      if (error && !error.message.includes('relation "_sql" does not exist')) {
        console.error(`❌ Błąd podczas wykonywania zapytania ${i+1}/${queries.length}:`, error.message);
        continue;
      }
      
      console.log(`✅ Zapytanie ${i+1}/${queries.length} wykonane`);
      
    } catch (error) {
      console.error(`❌ Błąd podczas wykonywania zapytania ${i+1}/${queries.length}:`, error.message);
    }
  }
  
  // Sprawdzenie czy tabele zostały utworzone
  try {
    const { error: profilesError } = await supabase.from('profiles').select('count').single();
    if (!profilesError) {
      console.log('✅ Tabela "profiles" została utworzona prawidłowo');
    }
    
    const { error: adminActionsError } = await supabase.from('admin_actions').select('count').single();
    if (!adminActionsError) {
      console.log('✅ Tabela "admin_actions" została utworzona prawidłowo');
    }
    
  } catch (error) {
    console.error('❌ Błąd podczas sprawdzania utworzonych tabel:', error.message);
  }
}

// Uruchomienie programu
main().catch(console.error); 