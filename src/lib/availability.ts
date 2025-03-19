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
  if (!startDate || !endDate) {
    return 0;
  }
  
  // Kopiujemy daty, aby nie modyfikować oryginalnych
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Ustawiamy godziny na 0, aby liczyć pełne dni
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Obliczamy różnicę w milisekundach i konwertujemy na dni
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Dodajemy 1, aby uwzględnić dzień odbioru
  return diffDays + 1;
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
export const formatTime = (time: string): string => {
  return time;
};

/**
 * Formatuje datę i czas
 */
export const formatDateTime = (date: Date): string => {
  return `${formatDate(date)}, ${date.getHours().toString().padStart(2, '0')}:00`;
};