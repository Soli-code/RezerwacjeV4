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
      const timeoutId = setTimeout(() => controller.abort(), 60000); // Zwiększono z 30s do 60s
      
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
  maxRetries = 5, // Zwiększono z 3 do 5
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
    const userResponse = await supabase.auth.getUser();
    if (userResponse.error) {
      console.error('Błąd pobierania użytkownika:', userResponse.error);
      return false;
    }
    
    const user = userResponse.data.user;
    if (!user) return false;

    // Sprawdź uprawnienia administratora
    const profileResponse = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (profileResponse.error) {
      console.error('Błąd pobierania profilu:', profileResponse.error);
      return false;
    }
    
    return profileResponse.data?.is_admin || false;
  } catch (error) {
    console.error('Błąd podczas sprawdzania uprawnień administratora:', error);
    return false;
  }
};

// Helper do sprawdzania stanu połączenia
export const checkSupabaseConnection = async () => {
  try {
    // Ustaw timeout 10 sekund dla zapytania (zwiększone z 5 sekund)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Próba prostego zapytania - poprawiona wersja z prawidłową obsługą typów
    const response = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (response.error) {
      console.error('Błąd połączenia z Supabase:', response.error);
      
      // Dodatkowe logowanie szczegółów błędu
      console.error('Status błędu:', response.status);
      console.error('Kod błędu:', response.error.code);
      console.error('Szczegóły błędu:', response.error.details);
      
      if (response.error.message.includes('querying schema')) {
        console.error('Problem z dostępem do schematu bazy danych');
      } else if (response.error.message.includes('network error')) {
        console.error('Problem z siecią - brak połączenia internetowego');
      }
      isConnected = false;
      return false;
    }
    
    console.log('Połączenie z Supabase działa prawidłowo');
    isConnected = true;
    return true;
  } catch (error) {
    console.error('Wyjątek podczas sprawdzania połączenia z Supabase:', error);
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Przekroczono limit czasu oczekiwania na odpowiedź serwera');
    }
    
    // Dodatkowe logowanie dla innych typów błędów
    if (error instanceof Error) {
      console.error('Nazwa błędu:', error.name);
      console.error('Wiadomość błędu:', error.message);
      console.error('Stos wywołań:', error.stack);
    }
    
    isConnected = false;
    return false;
  }
};

// Funkcja przydatna do sprawdzania statusu połączenia w komponentach
export const getConnectionStatus = () => {
  return isConnected;
};