import React, { useState, useEffect } from 'react';
import { supabase, supabaseRequestWithRetry, checkSupabaseConnection } from '../../lib/supabase';
import LoginForm from './LoginForm';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minut

interface AdminLoginPageProps {
  onLogin: () => void;
}

const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLogin }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    // Sprawdź połączenie z Supabase
    checkConnectionStatus();

    // Sprawdź czy użytkownik jest zablokowany
    const storedLockout = localStorage.getItem('adminLoginLockout');
    if (storedLockout) {
      const lockoutTime = parseInt(storedLockout);
      if (lockoutTime > Date.now()) {
        setLockoutUntil(lockoutTime);
      } else {
        localStorage.removeItem('adminLoginLockout');
        setLoginAttempts(0);
      }
    }
  }, []);

  const checkConnectionStatus = async () => {
    setConnectionStatus('checking');
    const isConnected = await checkSupabaseConnection();
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  };

  const handleLoginFailure = () => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);
    
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutTime = Date.now() + LOCKOUT_DURATION;
      setLockoutUntil(lockoutTime);
      localStorage.setItem('adminLoginLockout', lockoutTime.toString());
    }
  };

  const handleSubmit = async (email: string, password: string) => {
    setError('');
    
    // Sprawdź status połączenia
    if (connectionStatus === 'disconnected') {
      await checkConnectionStatus();
      if (connectionStatus === 'disconnected') {
        setError('Brak połączenia z serwerem. Sprawdź połączenie internetowe i spróbuj ponownie.');
        return;
      }
    }
    
    // Sprawdź czy użytkownik nie jest zablokowany
    if (lockoutUntil && lockoutUntil > Date.now()) {
      const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
      setError(`Zbyt wiele nieudanych prób. Spróbuj ponownie za ${minutesLeft} minut.`);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Logowanie bezpośrednio przez AuthAPI
      let response;
      try {
        response = await supabase.auth.signInWithPassword({
          email,
          password
        });
      } catch (loginError: any) {
        console.error('Błąd logowania:', loginError);
        
        // Obsługa specyficznych błędów autoryzacji
        if (loginError.message?.includes('Database error: querying schema')) {
          throw new Error('Błąd bazy danych. Problem z uprawnieniami lub połączeniem do bazy.');
        }
        
        throw loginError;
      }
      
      const { data, error: signInError } = response;
      
      if (signInError) {
        // Obsługa specyficznych błędów autoryzacji
        if (signInError.message?.includes('Database error: querying schema')) {
          throw new Error('Błąd bazy danych. Problem z uprawnieniami lub połączeniem do bazy.');
        }
        
        throw signInError;
      }
      
      const user = data.user;
      if (!user) throw new Error('Nie znaleziono użytkownika');

      // Sprawdź czy użytkownik jest administratorem
      let profileResponse;
      try {
        profileResponse = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
      } catch (profileError: any) {
        console.error('Błąd pobierania profilu:', profileError);
        
        // Obsługa specyficznych błędów profilu
        if (profileError.message?.includes('Database error: querying schema')) {
          throw new Error('Błąd bazy danych. Problem z uprawnieniami lub połączeniem do bazy.');
        }
        
        throw new Error('Błąd podczas weryfikacji uprawnień administratora');
      }
      
      const { data: profile, error: profileError } = profileResponse;
      
      if (profileError) {
        // Obsługa specyficznych błędów profilu
        if (profileError.message?.includes('Database error: querying schema')) {
          throw new Error('Błąd bazy danych. Problem z uprawnieniami lub połączeniem do bazy.');
        }
        
        throw profileError;
      }
      
      if (!profile?.is_admin) {
        throw new Error('Brak uprawnień administratora');
      }

      // Jeśli logowanie udane, wyczyść licznik prób
      setLoginAttempts(0);
      localStorage.removeItem('adminLoginLockout');

      try {
        // Zapisz timestamp ostatniego udanego logowania
        await supabase
          .from('admin_actions')
          .insert({
            action_type: 'login',
            action_details: {
              email: email,
              timestamp: new Date().toISOString()
            }
          });
      } catch (historyError) {
        // Ignoruj błędy zapisu historii - to nie powinno przerywać logowania
        console.warn('Nie udało się zapisać historii logowania:', historyError);
      }

      onLogin();
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        setError(
          error.message === 'Invalid login credentials' 
            ? 'Nieprawidłowe dane logowania'
            : error.message === 'Brak uprawnień administratora'
            ? 'Brak uprawnień administratora'
            : error.message.includes('Failed to fetch') || error.message.includes('fetch failed')
            ? 'Problem z połączeniem z serwerem. Sprawdź połączenie internetowe.'
            : error.message.includes('Database error')
            ? 'Błąd bazy danych. Skontaktuj się z administratorem systemu.'
            : 'Wystąpił nieoczekiwany błąd: ' + error.message
        );
      } else {
        setError('Wystąpił nieoczekiwany błąd');
      }
      handleLoginFailure();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Panel Administracyjny
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Zaloguj się aby zarządzać systemem
          </p>
          {connectionStatus === 'disconnected' && (
            <div className="mt-2 bg-yellow-50 p-2 rounded text-sm text-yellow-700 text-center">
              Problem z połączeniem z serwerem. 
              <button 
                className="ml-2 underline" 
                onClick={checkConnectionStatus}
              >
                Sprawdź ponownie
              </button>
            </div>
          )}
        </div>

        <LoginForm 
          onSubmit={handleSubmit}
          error={error}
          isLoading={isLoading || connectionStatus === 'checking'}
          isLocked={!!lockoutUntil && lockoutUntil > Date.now()}
          connectionStatus={connectionStatus}
        />
      </div>
    </div>
  );
};

export default AdminLoginPage; 