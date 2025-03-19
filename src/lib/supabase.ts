import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Brak wymaganych zmiennych środowiskowych Supabase. Upewnij się, że plik .env zawiera VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-application-name': 'rezerwacje-v4'
    },
    // Zwiększ timeout na operacje
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 sekund timeout zamiast domyślnych 6
      
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    }
  },
  realtime: {
    timeout: 60000, // Zwiększ timeout dla połączeń realtime
    params: {
      eventsPerSecond: 10 // Zwiększ limit zdarzeń na sekundę
    }
  },
  db: {
    schema: 'public'
  }
});

// Dodajmy właściwość do monitorowania statusu połączenia
let isConnected = false;

// Funkcja z retries do wykonywania zapytań Supabase
export const supabaseRequestWithRetry = async <T>(
  requestFunction: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  let lastError: any = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Wykonaj zapytanie
      const result = await Promise.resolve(requestFunction());
      isConnected = true;
      return result;
    } catch (error) {
      lastError = error;
      isConnected = false;
      console.warn(`Próba ${attempt + 1}/${maxRetries + 1} nie powiodła się:`, error);

      // Jeśli to ostatnia próba, zakończ
      if (attempt === maxRetries) {
        break;
      }

      // Czekaj przed kolejną próbą (rosnący czas oczekiwania)
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError;
};

export const checkIsAdmin = async () => {
  try {
    // Pobierz aktualnego użytkownika
    let userResponse;
    try {
      userResponse = await supabaseRequestWithRetry(() => supabase.auth.getUser());
    } catch (error) {
      console.error('Błąd pobierania użytkownika:', error);
      return false;
    }
    
    const user = userResponse.data.user;
    if (!user) return false;

    // Sprawdź uprawnienia administratora
    let profileResponse;
    try {
      profileResponse = await supabaseRequestWithRetry(() => 
        supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()
      );
    } catch (error) {
      console.error('Błąd pobierania profilu:', error);
      return false;
    }
    
    return profileResponse?.data?.is_admin || false;
  } catch (error) {
    console.error('Błąd podczas sprawdzania uprawnień administratora:', error);
    return false;
  }
};

// Helper do sprawdzania stanu połączenia
export const checkSupabaseConnection = async () => {
  try {
    // Próba prostego zapytania
    let response;
    try {
      response = await supabaseRequestWithRetry(() => 
        supabase.from('profiles').select('id').limit(1)
      );
    } catch (error) {
      console.error('Błąd pobierania profili:', error);
      isConnected = false;
      return false;
    }
    
    isConnected = true;
    return true;
  } catch (error) {
    console.error('Błąd połączenia z Supabase:', error);
    isConnected = false;
    return false;
  }
};

// Funkcja przydatna do sprawdzania statusu połączenia w komponentach
export const getConnectionStatus = () => {
  return isConnected;
};