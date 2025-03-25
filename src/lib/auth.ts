import { supabase } from './supabase';

export const signIn = async (email: string, password: string) => {
  console.log('Próba logowania dla:', email);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Błąd logowania:', error);
    console.error('Kod błędu:', error.code);
    console.error('Wiadomość błędu:', error.message);
    throw error;
  }
  
  console.log('Logowanie zakończone sukcesem');
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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

export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });

    if (error) {
      console.error('Błąd podczas wysyłania linku do resetowania hasła:', error);
      throw error;
    }

    console.log('Link do resetowania hasła został wysłany pomyślnie');
    return true;
  } catch (err) {
    console.error('Wyjątek podczas resetowania hasła:', err);
    throw err;
  }
};

export const updatePassword = async (newPassword: string) => {
  console.log('Próba aktualizacji hasła...');

  try {
    // Sprawdź, czy użytkownik jest zalogowany
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('Brak aktywnej sesji podczas próby aktualizacji hasła');
      throw new Error('Brak aktywnej sesji. Spróbuj ponownie zresetować hasło.');
    }

    console.log('Sesja użytkownika istnieje, aktualizacja hasła...');
    console.log('ID użytkownika:', session.user.id);
    console.log('Email użytkownika:', session.user.email);

    // Aktualizacja hasła
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Błąd podczas aktualizacji hasła:', error);
      console.error('Kod błędu:', error.code);
      console.error('Wiadomość błędu:', error.message);
      console.error('Status błędu:', error.status);
      throw error;
    }

    console.log('Hasło zostało pomyślnie zaktualizowane');
    return true;
  } catch (err) {
    console.error('Wyjątek podczas aktualizacji hasła:', err);
    throw err;
  }
};

export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Hasło musi mieć co najmniej 8 znaków');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Hasło musi zawierać co najmniej jedną wielką literę');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Hasło musi zawierać co najmniej jedną cyfrę');
  }

  return errors;
};

export const checkUserExists = async (email: string): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false
      }
    });

    if (error) {
      console.log('Błąd podczas sprawdzania użytkownika:', error.message);
      // Jeśli błąd to "User not found", to użytkownik nie istnieje
      if (error.message.includes('User not found') || error.message.includes('Invalid login credentials')) {
        return false;
      }
      // Dla innych błędów zakładamy, że użytkownik może istnieć
      return true;
    }

    // Jeśli nie ma błędu, użytkownik istnieje
    console.log('Użytkownik istnieje');
    return true;
  } catch (err) {
    console.error('Wyjątek podczas sprawdzania użytkownika:', err);
    // W przypadku wyjątku zakładamy, że użytkownik może istnieć
    return true;
  }
};

export const createTestUser = async (email: string, password: string = 'Test123456'): Promise<boolean> => {
  try {
    console.log('Tworzenie testowego użytkownika:', email);
    // Sprawdź, czy użytkownik już istnieje
    const userExists = await checkUserExists(email);
    if (userExists) {
      console.log('Użytkownik już istnieje, pomijam tworzenie');
      return true;
    }

    // Utwórz nowego użytkownika
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/reset-password`
      }
    });

    if (error) {
      console.error('Błąd podczas tworzenia użytkownika:', error);
      return false;
    }

    console.log('Użytkownik testowy utworzony pomyślnie');

    // Dodaj uprawnienia administratora dla nowego użytkownika
    // Uwaga: To wymaga dodatkowej logiki po stronie serwera, aby działało poprawnie
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            is_admin: true,
            updated_at: new Date().toISOString()
          });
      }
    } catch (profileError) {
      console.error('Błąd podczas ustawiania uprawnień administratora:', profileError);
      // Nie przerywamy procesu, jeśli nie udało się ustawić uprawnień
    }

    return true;
  } catch (err) {
    console.error('Wyjątek podczas tworzenia użytkownika:', err);
    return false;
  }
};

// Funkcja do zalogowania użytkownika
export const loginUser = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return { user: data.user, session: data.session };
  } catch (error) {
    console.error('Błąd logowania:', error);
    throw error;
  }
};

// Funkcja do wylogowania użytkownika
export const logoutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Błąd wylogowania:', error);
    throw error;
  }
};

// Funkcja do sprawdzania aktualnej sesji
export const getCurrentSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('Błąd pobierania sesji:', error);
    return null;
  }
};