import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  User, 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  Package, 
  CreditCard, 
  Wrench, 
  MessageSquare, 
  Plus, 
  Minus, 
  CalendarDays, 
  Clock3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  History
} from 'lucide-react';
import { 
  Clock as ClockIcon, 
  CheckCircle as CheckCircleIcon, 
  PlayCircle as PlayIcon, 
  CheckSquare as CheckIcon, 
  XCircle as XCircleIcon 
} from 'lucide-react';

interface Profile {
  full_name: string;
}

interface CommentWithProfile {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: Profile;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_name: string;
}

interface RawProfile {
  full_name: string;
}

interface RawComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: RawProfile[];
}

interface NewCustomerDetailsViewProps {
  isOpen?: boolean;
  onClose?: () => void;
  selectedDate?: Date;
  selectedEquipment?: {
    id: string;
    name: string;
  };
  onSuccess?: () => void;
}

interface CustomerUpdateData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name?: string;
  company_nip?: string;
  company_address?: string;
  company_city?: string;
  company_postal_code?: string;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  payment_type: string;
  notes?: string;
  created_at: string;
}

interface CommentResponse {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: Array<Profile>;
}

interface RawCommentResponse {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: Array<{
    full_name: string;
  }>;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface AdditionalService {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CustomerDetails {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  total_price: number;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company_name?: string;
    company_nip?: string;
    street: string;
    city: string;
    postal_code: string;
  };
  items: Array<{
    id: string;
    equipment_name: string;
    quantity: number;
    price_per_day: number;
    deposit: number;
  }>;
  history: any[];
  reservation: {
    id: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
  };
  additional_services?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

interface Equipment {
  id: string;
  name: string;
  price_per_day: number;
  deposit: number;
  quantity?: number;
}

interface EditedDetails {
  id?: string;
  start_date: string;
  end_date: string;
  total_price: number;
  deposit: number;
  status: string;
  customer_id: string;
  equipment: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    deposit: number;
  }>;
  additional_services: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

const availableStatuses = [
  {
    value: 'pending',
    label: 'Oczekująca',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <Clock className="w-5 h-5" />
  },
  {
    value: 'confirmed',
    label: 'Potwierdzona',
    color: 'bg-green-100 text-green-800',
    icon: <CheckCircle className="w-5 h-5" />
  },
  {
    value: 'picked_up',
    label: 'Odbierana',
    color: 'bg-blue-100 text-blue-800',
    icon: <PlayIcon className="w-5 h-5" />
  },
  {
    value: 'completed',
    label: 'Zakończona',
    color: 'bg-gray-100 text-gray-800',
    icon: <CheckIcon className="w-5 h-5" />
  },
  {
    value: 'cancelled',
    label: 'Anulowana',
    color: 'bg-red-100 text-red-800',
    icon: <XCircleIcon className="w-5 h-5" />
  }
];

const NewCustomerDetailsView: React.FC<NewCustomerDetailsViewProps> = ({
  isOpen,
  onClose,
  selectedDate: propSelectedDate,
  selectedEquipment: propSelectedEquipment,
  onSuccess
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  
  // Pobierz datę i sprzęt z URL jeśli są dostępne
  const urlDate = searchParams.get('date');
  const urlEquipmentId = searchParams.get('equipmentId');
  
  const selectedDate = propSelectedDate || (urlDate ? new Date(urlDate) : undefined);
  const initialSelectedEquipment = propSelectedEquipment || (urlEquipmentId ? { id: urlEquipmentId, name: '' } : undefined);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Stany dla danych klienta
  const [editedCustomer, setEditedCustomer] = useState<CustomerUpdateData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    company_nip: '',
    company_address: '',
    company_city: '',
    company_postal_code: ''
  });

  // Stany dla sprzętu i usług
  const [selectedEquipmentList, setSelectedEquipmentList] = useState<Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    deposit: number;
  }>>([]);

  const [additionalServices, setAdditionalServices] = useState<Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>>([
    { id: 'gas', name: 'Butla gazowa', price: 50, quantity: 0 },
    { id: 'vacuum', name: 'Odkurzacz do żyrafy', price: 25, quantity: 0 },
    { id: 'powder', name: 'Proszek piorący Kärcher 100g', price: 10, quantity: 0 },
    { id: 'scaffold', name: 'RUSZTOWANIE', price: 100, quantity: 0 },
    { id: 'disc', name: 'Tarcza do gipsu', price: 15, quantity: 0 },
    { id: 'drill152', name: 'Wiertło do wiertnicy 152 mm', price: 40, quantity: 0 },
    { id: 'drill202', name: 'Wiertło do wiertnicy 202 mm', price: 80, quantity: 0 },
    { id: 'drill82', name: 'Wiertło do wiertnicy 82, 112, 132 mm', price: 30, quantity: 0 }
  ]);

  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEquipmentList, setShowEquipmentList] = useState(false);
  const [isCompanyCustomer, setIsCompanyCustomer] = useState(false);

  // Load available equipment
  useEffect(() => {
    const loadEquipment = async () => {
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('*')
          .order('name');
          
        if (error) throw error;
        
        if (data) {
          setAvailableEquipment(data);
        }
      } catch (error) {
        console.error('Error loading equipment:', error);
      }
    };
    
    loadEquipment();
  }, []);

  // Jeśli mamy początkowy sprzęt, dodaj go do listy
  useEffect(() => {
    if (initialSelectedEquipment) {
      const equipment = availableEquipment.find(e => e.id === initialSelectedEquipment.id);
      if (equipment) {
        setSelectedEquipmentList([{
          id: equipment.id,
          name: equipment.name,
          quantity: 1,
          price: equipment.price_per_day,
          deposit: equipment.deposit
        }]);
      }
    }
  }, [initialSelectedEquipment, availableEquipment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Sprawdź czy klient już istnieje
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', editedCustomer.email)
        .single();

      let customerId;
      if (existingCustomer) {
        // Aktualizuj istniejącego klienta
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            first_name: editedCustomer.first_name,
            last_name: editedCustomer.last_name,
            phone: editedCustomer.phone,
            is_company: editedCustomer.company_name ? true : null,
            company_name: editedCustomer.company_name,
            nip: editedCustomer.company_nip,
            street: editedCustomer.company_address,
            city: editedCustomer.company_city,
            postal_code: editedCustomer.company_postal_code
          })
          .eq('id', existingCustomer.id);

        if (updateError) throw updateError;
        customerId = existingCustomer.id;
      } else {
        // Utwórz nowego klienta
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert({
            first_name: editedCustomer.first_name,
            last_name: editedCustomer.last_name,
            email: editedCustomer.email,
            phone: editedCustomer.phone,
            is_company: editedCustomer.company_name ? true : null,
            company_name: editedCustomer.company_name,
            nip: editedCustomer.company_nip,
            street: editedCustomer.company_address,
            city: editedCustomer.company_city,
            postal_code: editedCustomer.company_postal_code
          })
          .select()
          .single();

        if (insertError) throw insertError;
        customerId = newCustomer.id;
      }

      let reservationId: string | undefined;
      // Utwórz rezerwację
      if (selectedDate && selectedEquipmentList.length > 0) {
        const { data: reservation, error: reservationError } = await supabase
          .from('reservations')
          .insert({
            customer_id: customerId,
            start_date: selectedDate.toISOString(),
            end_date: selectedDate.toISOString(),
            start_time: '08:00',
            end_time: '16:00',
            status: 'pending',
            reservation_items: selectedEquipmentList.map(item => ({
              equipment_id: item.id,
              quantity: item.quantity
            }))
          })
          .select()
          .single();

        if (reservationError) throw reservationError;
        reservationId = reservation.id;

        // Dodaj usługi dodatkowe
        const servicesToAdd = additionalServices
          .filter(service => service.quantity > 0)
          .map(service => ({
            reservation_id: reservation.id,
            service_id: service.id,
            quantity: service.quantity,
            price: service.price
          }));

        if (servicesToAdd.length > 0) {
          const { error: servicesError } = await supabase
            .from('reservation_services')
            .insert(servicesToAdd);

          if (servicesError) throw servicesError;
        }

        // Wyślij powiadomienie o nowej rezerwacji
        await supabase.functions.invoke('notify-new-reservation', {
          body: {
            reservation_id: reservation.id,
            customer_id: customerId
          }
        });
      }

      setSuccessMessage('Rezerwacja została utworzona');
      
      // Przekieruj do widoku szczegółów rezerwacji
      if (reservationId) {
        navigate(`/reservations/${reservationId}`);
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      setError('Wystąpił błąd podczas zapisywania rezerwacji');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditedCustomer(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleServiceQuantityChange = (serviceId: string, change: number) => {
    setAdditionalServices(prev => {
      const service = prev.find(s => s.id === serviceId);
      if (!service) return prev;

      const newQuantity = Math.max(0, service.quantity + change);
      if (newQuantity === 0) {
        if (window.confirm('Czy na pewno chcesz usunąć tę usługę?')) {
          return prev.filter(s => s.id !== serviceId);
        }
        return prev;
      }

      return prev.map(s => 
        s.id === serviceId 
          ? { ...s, quantity: newQuantity }
          : s
      );
    });
  };

  const handleEquipmentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowEquipmentList(true);
  };

  const handleSelectEquipment = (equipment: Equipment) => {
    setSelectedEquipmentList(prev => {
      const existing = prev.find(item => item.id === equipment.id);
      if (existing) {
        return prev.map(item => 
          item.id === equipment.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: equipment.id,
        name: equipment.name,
        quantity: 1,
        price: equipment.price_per_day,
        deposit: equipment.deposit
      }];
    });
    setSearchTerm('');
    setShowEquipmentList(false);
  };

  const calculateTotalPrice = () => {
    let total = 0;

    // Add equipment prices
    selectedEquipmentList.forEach(equipment => {
      total += equipment.price * equipment.quantity;
    });

    // Add additional services prices
    additionalServices.forEach(service => {
      total += service.price * service.quantity;
    });

    return total;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-solrent-orange"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Przycisk powrotu */}
      <button
        onClick={() => {
          if (location.state?.from) {
            navigate(location.state.from);
          } else {
            navigate(-1);
          }
        }}
        className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Powrót do listy
      </button>

      {/* Status rezerwacji */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Status rezerwacji</h2>
          <Clock className="w-6 h-6 text-gray-400" />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {availableStatuses.map(status => {
            const isActive = status.value === 'pending';
            return (
              <button
                key={status.value}
                disabled={submitting || status.value !== 'pending'}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? `${status.color} ring-2 ring-offset-2 ring-${status.color.split(' ')[0]}`
                    : `hover:${status.color} bg-white border border-gray-200`
                }`}
              >
                {status.icon}
                {status.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lewa kolumna - stałe dane */}
        <div className="lg:col-span-4 space-y-6">
          {/* Dane klienta */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Dane klienta</h2>
              <User className="w-6 h-6 text-gray-400" />
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imię*
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={editedCustomer.first_name}
                  onChange={handleCustomerChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwisko*
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={editedCustomer.last_name}
                  onChange={handleCustomerChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email*
                </label>
                <input
                  type="email"
                  name="email"
                  value={editedCustomer.email}
                  onChange={handleCustomerChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon*
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={editedCustomer.phone}
                  onChange={handleCustomerChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isCompanyCustomer"
                  checked={isCompanyCustomer}
                  onChange={(e) => setIsCompanyCustomer(e.target.checked)}
                  className="h-4 w-4 text-solrent-orange focus:ring-solrent-orange border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Klient firmowy
                </label>
              </div>

              {isCompanyCustomer && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nazwa firmy*
                    </label>
                    <input
                      type="text"
                      name="company_name"
                      value={editedCustomer.company_name}
                      onChange={handleCustomerChange}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NIP*
                    </label>
                    <input
                      type="text"
                      name="company_nip"
                      value={editedCustomer.company_nip}
                      onChange={handleCustomerChange}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adres*
                    </label>
                    <input
                      type="text"
                      name="company_address"
                      value={editedCustomer.company_address}
                      onChange={handleCustomerChange}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Miasto*
                      </label>
                      <input
                        type="text"
                        name="company_city"
                        value={editedCustomer.company_city}
                        onChange={handleCustomerChange}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kod pocztowy*
                      </label>
                      <input
                        type="text"
                        name="company_postal_code"
                        value={editedCustomer.company_postal_code}
                        onChange={handleCustomerChange}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                        required
                      />
                    </div>
                  </div>
                </>
              )}
            </form>
          </div>

          {/* Szczegóły rezerwacji */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Szczegóły rezerwacji</h2>
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Data rozpoczęcia</p>
                <p className="font-medium">
                  {selectedDate ? selectedDate.toLocaleDateString('pl-PL') : 'Nie wybrano daty'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Godzina</p>
                <p className="font-medium">08:00</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data zakończenia</p>
                <p className="font-medium">
                  {selectedDate ? selectedDate.toLocaleDateString('pl-PL') : 'Nie wybrano daty'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Godzina</p>
                <p className="font-medium">16:00</p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">Całkowita wartość</p>
                <p className="text-xl font-bold text-solrent-orange">
                  {calculateTotalPrice()} zł
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Prawa kolumna - dynamiczne dane */}
        <div className="lg:col-span-8 space-y-6">
          {/* Zarezerwowany sprzęt */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Zarezerwowany sprzęt</h2>
              <Package className="w-6 h-6 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              {selectedEquipmentList.map((item, index) => (
                <div key={index} className="flex justify-between items-start pb-4 border-b last:border-0">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">Ilość: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{item.price} zł/dzień</p>
                    {item.deposit > 0 && (
                      <p className="text-sm text-orange-600">Kaucja: {item.deposit} zł</p>
                    )}
                  </div>
                </div>
              ))}
              {selectedEquipmentList.length === 0 && (
                <p className="text-gray-500 text-center">Brak zarezerwowanego sprzętu</p>
              )}
            </div>

            <div className="mt-4">
              <input
                type="text"
                value={searchTerm}
                onChange={handleEquipmentSearch}
                placeholder="Wyszukaj sprzęt..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
              />
            </div>

            {showEquipmentList && (
              <div className="mt-2 max-h-60 overflow-y-auto">
                {availableEquipment
                  .filter(equipment => 
                    equipment.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(equipment => (
                    <button
                      key={equipment.id}
                      onClick={() => handleSelectEquipment(equipment)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg"
                    >
                      <p className="font-medium">{equipment.name}</p>
                      <p className="text-sm text-gray-500">
                        {equipment.price_per_day} zł/dzień
                        {equipment.deposit > 0 && ` • Kaucja: ${equipment.deposit} zł`}
                      </p>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Usługi dodatkowe */}
          {additionalServices.some(service => service.quantity > 0) && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Usługi dodatkowe</h2>
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              
              <div className="space-y-4">
                {additionalServices
                  .filter(service => service.quantity > 0)
                  .map((service, index) => (
                    <div key={index} className="flex justify-between items-center pb-4 border-b last:border-0">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-gray-500">Cena: {service.price} zł</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleServiceQuantityChange(service.id, -1)}
                          className="p-1 rounded-full hover:bg-gray-100"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="w-8 text-center">{service.quantity}</span>
                        <button
                          onClick={() => handleServiceQuantityChange(service.id, 1)}
                          className="p-1 rounded-full hover:bg-gray-100"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Komentarze */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Komentarze</h2>
              <MessageSquare className="w-6 h-6 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-500 text-center">Brak komentarzy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Przycisk zapisz */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Zapisywanie...' : 'Zapisz rezerwację'}
        </button>
      </div>
    </div>
  );
};

export default NewCustomerDetailsView; 