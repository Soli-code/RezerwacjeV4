/**
 * Funkcje pomocnicze do obsługi dat i dostępności sprzętu
 */
import { supabase } from './supabase';

/**
 * Sprawdza, czy data jest dostępna do rezerwacji
 */
export const isDateAvailable = (date: Date, bookedDates: Date[] = []): boolean => {
  // Sprawdź, czy data nie jest w przeszłości
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (date < today) {
    return false;
  }
  
  // Sprawdź, czy data nie jest już zarezerwowana
  return !bookedDates.some(bookedDate => 
    bookedDate.getFullYear() === date.getFullYear() &&
    bookedDate.getMonth() === date.getMonth() &&
    bookedDate.getDate() === date.getDate()
  );
};

/**
 * Sprawdza, czy data jest w weekend
 */
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = niedziela, 6 = sobota
};

/**
 * Sprawdza, czy data jest sobotą po godzinie granicznej
 */
export const isSaturdayAfterCutoff = (date: Date, cutoffHour: number = 12): boolean => {
  const day = date.getDay();
  const hour = date.getHours();
  
  return day === 6 && hour >= cutoffHour;
};

/**
 * Oblicza liczbę dni między dwiema datami
 */
export const calculateRentalDays = (
  startDate: Date | null, 
  endDate: Date | null,
  startTime: string | null = null,
  endTime: string | null = null
): number => {
  if (!startDate || !endDate || !startTime || !endTime) {
    return 0;
  }
  
  // Tworzymy pełne daty z czasem
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Dodajemy godziny
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  start.setHours(startHour, startMinute, 0, 0);
  end.setHours(endHour, endMinute, 0, 0);
  
  // Obliczamy różnicę w godzinach
  const diffHours = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
  
  // Jeśli różnica jest większa niż 24 godziny, zaokrąglamy w górę do pełnych dni
  // Jeśli różnica jest mniejsza lub równa 24 godzinom, to jest to 1 dzień
  if (diffHours <= 24) {
    return 1;
  } else {
    // Dla różnicy większej niż 24h, każde rozpoczęte 24h to nowy dzień
    return Math.ceil((diffHours - 24) / 24) + 1;
  }
};

/**
 * Formatuje datę do wyświetlenia
 */
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Sprawdza dostępność sprzętu w danym terminie
 */
export const checkAvailability = async (
  equipmentId: string, 
  startDate: Date, 
  endDate: Date,
  isRangeCheck: boolean = false
): Promise<boolean> => {
  // W rzeczywistej implementacji, tutaj byłoby zapytanie do bazy danych
  // Na potrzeby przykładu, zawsze zwracamy true
  return true;
};

/**
 * Zwraca następną dostępną datę
 */
export const getNextAvailableDate = async (equipmentId: string, currentDate: Date): Promise<Date> => {
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + 1);
  
  // W rzeczywistej implementacji, tutaj byłoby sprawdzenie dostępności w bazie danych
  // Na potrzeby przykładu, zwracamy datę przesuniętą o 1 dzień
  return nextDate;
};

/**
 * Pobiera rezerwacje w danym zakresie dat
 */
export const getReservationsInRange = async (
  equipmentIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Map<string, any[]>> => {
  try {
    // Pobieranie rezerwacji z bazy danych
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        start_date,
        end_date,
        start_time,
        end_time,
        status,
        reservation_items!inner (
          equipment_id,
          equipment:equipment (
            name,
            description
          )
        )
      `)
      .gte('start_date', startDate.toISOString())
      .lte('end_date', endDate.toISOString())
      .neq('status', 'cancelled');

    if (error) {
      console.error('Błąd podczas pobierania rezerwacji:', error);
      return new Map();
    }

    // Grupowanie rezerwacji według equipment_id
    const reservationsMap = new Map<string, any[]>();
    
    // Inicjalizacja mapy dla każdego sprzętu
    equipmentIds.forEach(id => {
      reservationsMap.set(id, []);
    });

    // Wypełnianie mapy rezerwacjami
    if (data) {
      data.forEach((reservation: any) => {
        reservation.reservation_items.forEach((item: any) => {
          const equipmentId = item.equipment_id;
          if (equipmentIds.includes(equipmentId)) {
            // Dodajemy informację o sprzęcie do obiektu rezerwacji
            const reservationWithEquipment = {
              ...reservation,
              equipment_name: item.equipment?.name || 'Nieznany sprzęt'
            };
            const currentReservations = reservationsMap.get(equipmentId) || [];
            currentReservations.push(reservationWithEquipment);
            reservationsMap.set(equipmentId, currentReservations);
          }
        });
      });
    }

    return reservationsMap;
  } catch (error) {
    console.error('Wystąpił błąd podczas pobierania rezerwacji:', error);
    return new Map();
  }
};

/**
 * Formatuje datę w krótkim formacie
 */
export const formatShortDate = (date: Date): string => {
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'numeric'
  });
};

/**
 * Formatuje czas
 */
export const formatTime = (date: Date | string): string => {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  // Jeśli niedziela, zwróć pusty string
  if (date.getDay() === 0) {
    return '';
  }
  
  // Jeśli sobota, ogranicz do 13:00
  if (date.getDay() === 6 && date.getHours() > 13) {
    return '13:00';
  }
  
  // Dla dni roboczych, ogranicz do 16:00
  if (date.getHours() > 16) {
    return '16:00';
  }
  
  // Ogranicz minimalną godzinę do 8:00
  if (date.getHours() < 8) {
    return '08:00';
  }
  
  return date.toLocaleTimeString('pl-PL', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

/**
 * Formatuje datę i czas
 */
export const formatDateTime = (date: Date): string => {
  return `${formatDate(date)}, ${date.getHours().toString().padStart(2, '0')}:00`;
};

export const getAvailableHours = (date: Date, isStart: boolean = true): string[] => {
  const isSaturday = date.getDay() === 6;
  
  // Podstawowy zakres godzin
  const baseHours = Array.from({ length: 9 }, (_, i) => 
    `${(i + 8).toString().padStart(2, '0')}:00`
  );
  
  // Filtruj godziny dla soboty (8:00-13:00)
  if (isSaturday) {
    return baseHours.filter(time => {
      const hour = parseInt(time.split(':')[0], 10);
      return hour >= 8 && hour <= 13;
    });
  }
  
  // Dla dni roboczych (8:00-16:00)
  return baseHours.filter(time => {
    const hour = parseInt(time.split(':')[0], 10);
    return hour >= 8 && hour <= 16;
  });
};

export const isValidTimeForDate = (date: Date, time: string): boolean => {
  const isSaturday = date.getDay() === 6;
  const hour = parseInt(time.split(':')[0], 10);
  
  // Dla soboty dozwolone tylko 8:00-13:00
  if (isSaturday) {
    return hour >= 8 && hour <= 13;
  }
  
  // Dla dni roboczych dozwolone 8:00-16:00
  return hour >= 8 && hour <= 16;
};