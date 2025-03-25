import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isValidTimeForDate } from '../../lib/availability';

interface ReservationFormProps {
  onSubmit: (formData: ReservationFormData) => void;
  initialData?: Partial<ReservationFormData>;
  isLoading?: boolean;
}

interface ReservationFormData {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  customerId: string;
  status: string;
  equipment: Array<{
    id: string;
    quantity: number;
  }>;
  additionalServices?: Array<{
    id: string;
    quantity: number;
  }>;
  notes?: string;
}

const ReservationForm: React.FC<ReservationFormProps> = ({ 
  onSubmit, 
  initialData = {},
  isLoading = false
}) => {
  const [formState, setFormState] = useState<ReservationFormData>({
    startDate: initialData.startDate || '',
    endDate: initialData.endDate || '',
    startTime: initialData.startTime || '08:00',
    endTime: initialData.endTime || '16:00',
    customerId: initialData.customerId || '',
    status: initialData.status || 'pending',
    equipment: initialData.equipment || [],
    additionalServices: initialData.additionalServices || [],
    notes: initialData.notes || ''
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Array<{id: string, name: string}>>([]);
  const [availableEquipment, setAvailableEquipment] = useState<Array<any>>([]);
  const [availableServices, setAvailableServices] = useState<Array<any>>([]);
  
  useEffect(() => {
    // Załaduj dane klientów, sprzętu i usług
    loadCustomers();
    loadEquipment();
    loadServices();
  }, []);
  
  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .order('last_name', { ascending: true });
      
    if (data) {
      setCustomers(data.map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`
      })));
    }
  };
  
  const loadEquipment = async () => {
    const { data } = await supabase
      .from('equipment')
      .select('id, name, price_per_day')
      .eq('is_active', true)
      .order('name');
      
    if (data) {
      setAvailableEquipment(data);
    }
  };
  
  const loadServices = async () => {
    const { data } = await supabase
      .from('additional_services')
      .select('id, name, price')
      .eq('is_active', true)
      .order('name');
      
    if (data) {
      setAvailableServices(data);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
  
    // Walidacja dat
    if (!formState.startDate) {
      errors.startDate = 'Data rozpoczęcia jest wymagana';
    }
  
    if (!formState.endDate) {
      errors.endDate = 'Data zakończenia jest wymagana';
    }
  
    // Walidacja godzin
    if (!formState.startTime) {
      errors.startTime = 'Godzina rozpoczęcia jest wymagana';
    } else {
      const startDate = new Date(formState.startDate);
      if (!isValidTimeForDate(startDate, formState.startTime)) {
        errors.startTime = startDate.getDay() === 6 
          ? 'Godzina rozpoczęcia musi być między 8:00 a 13:00 dla sobót' 
          : 'Godzina rozpoczęcia musi być między 8:00 a 16:00';
      }
    }
  
    if (!formState.endTime) {
      errors.endTime = 'Godzina zakończenia jest wymagana';
    } else {
      const endDate = new Date(formState.endDate);
      if (!isValidTimeForDate(endDate, formState.endTime)) {
        errors.endTime = endDate.getDay() === 6 
          ? 'Godzina zakończenia musi być między 8:00 a 13:00 dla sobót' 
          : 'Godzina zakończenia musi być między 8:00 a 16:00';
      }
    }
  
    // Walidacja zakresu dat i godzin
    if (formState.startDate && formState.endDate && formState.startTime && formState.endTime) {
      const startDateTime = new Date(formState.startDate);
      const endDateTime = new Date(formState.endDate);
      
      const [startHour] = formState.startTime.split(':').map(Number);
      const [endHour] = formState.endTime.split(':').map(Number);
      
      startDateTime.setHours(startHour);
      endDateTime.setHours(endHour);
      
      if (endDateTime <= startDateTime) {
        errors.endDate = 'Data i godzina zakończenia musi być późniejsza niż data i godzina rozpoczęcia';
      }
    }
  
    // Walidacja klienta
    if (!formState.customerId) {
      errors.customerId = 'Wybierz klienta';
    }
  
    // Walidacja sprzętu
    if (formState.equipment.length === 0) {
      errors.equipment = 'Wybierz co najmniej jeden sprzęt';
    }
  
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formState);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Formularz z polami rezerwacji */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Data rozpoczęcia */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data rozpoczęcia
          </label>
          <input
            type="date"
            name="startDate"
            value={formState.startDate}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg ${
              validationErrors.startDate ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {validationErrors.startDate && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.startDate}</p>
          )}
        </div>
        
        {/* Godzina rozpoczęcia */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Godzina rozpoczęcia
          </label>
          <select
            name="startTime"
            value={formState.startTime}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg ${
              validationErrors.startTime ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          >
            <option value="08:00">08:00</option>
            <option value="09:00">09:00</option>
            <option value="10:00">10:00</option>
            <option value="11:00">11:00</option>
            <option value="12:00">12:00</option>
            <option value="13:00">13:00</option>
            <option value="14:00">14:00</option>
            <option value="15:00">15:00</option>
            <option value="16:00">16:00</option>
          </select>
          {validationErrors.startTime && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.startTime}</p>
          )}
        </div>
        
        {/* Data zakończenia */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data zakończenia
          </label>
          <input
            type="date"
            name="endDate"
            value={formState.endDate}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg ${
              validationErrors.endDate ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {validationErrors.endDate && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
          )}
        </div>
        
        {/* Godzina zakończenia */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Godzina zakończenia
          </label>
          <select
            name="endTime"
            value={formState.endTime}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg ${
              validationErrors.endTime ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          >
            <option value="08:00">08:00</option>
            <option value="09:00">09:00</option>
            <option value="10:00">10:00</option>
            <option value="11:00">11:00</option>
            <option value="12:00">12:00</option>
            <option value="13:00">13:00</option>
            <option value="14:00">14:00</option>
            <option value="15:00">15:00</option>
            <option value="16:00">16:00</option>
          </select>
          {validationErrors.endTime && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.endTime}</p>
          )}
        </div>
      </div>
      
      <div className="mt-6">
        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-solrent-orange rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
          disabled={isLoading}
        >
          {isLoading ? 'Zapisywanie...' : 'Zapisz rezerwację'}
        </button>
      </div>
    </form>
  );
};

export default ReservationForm; 