import React, { useState, useEffect } from 'react';
import { supabase, supabaseRequestWithRetry, checkSupabaseConnection } from '../../lib/supabase';
import { checkIsAdmin } from '../../lib/auth';
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
      // Sprawdźmy najpierw połączenie z bazą danych przed próbą logowania
      const connectionCheck = await checkSupabaseConnection();
      if (!connectionCheck) {
        throw new Error('Problem z połączeniem do bazy danych. Sprawdź połączenie internetowe i spróbuj ponownie za chwilę.');
      }
      
      // Logowanie bezpośrednio przez AuthAPI
      let response;
      try {
        response = await supabaseRequestWithRetry(() => supabase.auth.signInWithPassword({
          email,
          password
        }));
      } catch (loginError: any) {
        console.error('Błąd logowania:', loginError);
        
        // Obsługa specyficznych błędów autoryzacji
        if (loginError.message?.includes('Database error') || 
            loginError.message?.includes('querying schema') || 
            loginError.message?.includes('Internal Server Error')) {
          throw new Error('Problem z połączeniem do bazy danych. Spróbuj ponownie za chwilę.');
        }
        
        throw loginError;
      }
      
      const { data, error: signInError } = response;
      
      if (signInError) {
        // Obsługa specyficznych błędów autoryzacji
        if (signInError.message?.includes('Database error') ||
            signInError.message?.includes('querying schema') ||
            signInError.message?.includes('Internal Server Error')) {
          throw new Error('Problem z połączeniem do bazy danych. Spróbuj ponownie za chwilę.');
        }
        
        // Jeśli to błąd nieznalezienia użytkownika, przedstawiamy bardziej przyjazny komunikat
        if (signInError.message?.includes('Invalid login credentials')) {
          throw new Error('Nieprawidłowy email lub hasło. Sprawdź dane i spróbuj ponownie.');
        }
        
        throw signInError;
      }
      
      const user = data.user;
      if (!user) throw new Error('Nie znaleziono użytkownika');

      // Sprawdź czy użytkownik jest administratorem
      try {
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
          // Wyloguj użytkownika, jeśli nie jest administratorem
          await supabase.auth.signOut();
          throw new Error('Brak uprawnień administratora. Skontaktuj się z administratorem systemu.');
        }
      } catch (adminCheckError: any) {
        console.error('Błąd sprawdzania uprawnień administratora:', adminCheckError);
        
        // Wyloguj użytkownika w przypadku błędu
        await supabase.auth.signOut();
        
        // Obsługa konkretnych błędów związanych z bazą danych
        if (adminCheckError.message?.includes('Database error') || 
            adminCheckError.message?.includes('querying schema') || 
            adminCheckError.message?.includes('Internal Server Error')) {
          throw new Error('Problem z połączeniem do bazy danych. Spróbuj ponownie za chwilę.');
        }
        
        throw new Error('Problem z weryfikacją uprawnień. Spróbuj ponownie później.');
      }
      
      // Resetuj licznik prób
      setLoginAttempts(0);
      
      // Przekieruj do panelu administratora
      onLogin();
    } catch (error: any) {
      console.error('Błąd podczas logowania:', error);
      
      // Dodatkowa obsługa specyficznych błędów
      let errorMessage = error.message || 'Wystąpił błąd podczas logowania. Spróbuj ponownie.';
      
      // Obsługa błędów związanych z bazą danych
      if (errorMessage.includes('Database error') || 
          errorMessage.includes('querying schema') || 
          errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Problem z połączeniem do bazy danych. Spróbuj ponownie za chwilę.';
      }

      // Inkrementuj licznik prób tylko dla błędów uwierzytelniania, nie dla problemów z połączeniem
      if (errorMessage.includes('Nieprawidłowy email lub hasło')) {
        handleLoginFailure();
      }
      
      // Ustaw komunikat błędu
      setError(errorMessage);
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