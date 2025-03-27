import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getAvailableHours, isValidTimeForDate } from '../../lib/availability';
import { 
  User, Calendar, Package, CheckCircle, XCircle, 
  Clock, MessageSquare, History, ArrowLeft, AlertTriangle,
  ChevronDown, CalendarDays, Clock3, Search, Plus, Minus, UserPlus,
  CreditCard, DollarSign, AlertCircle, Wrench, Camera, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Nowe interfejsy dla płatności
interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  payment_type: 'deposit' | 'advance' | 'full_payment' | 'additional';
  payment_method: 'cash' | 'transfer' | 'online' | 'blik';
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  notes?: string;
}

// Nowe interfejsy dla usterek
interface Issue {
  id: string;
  reservation_id: string;
  equipment_id: string;
  equipment_name: string;
  description: string;
  category: 'mechanical' | 'electrical' | 'cosmetic' | 'other';
  priority: 'critical' | 'important' | 'minor';
  status: 'reported' | 'in_progress' | 'resolved';
  reported_at: string;
  resolved_at?: string;
  cost?: number;
  is_customer_fault: boolean;
  images?: string[];
}

interface Equipment {
  id: string;
  name: string;
  price: number;
  deposit: number;
  quantity: number;
}

interface AdditionalService {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CustomerDetails {
  id: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company_name?: string;
    company_nip?: string;
    street?: string;
    city?: string;
    postal_code?: string;
  };
  status: string;
  start_date: string;
  end_date: string;
  total_price: number;
  items: Array<{
    id?: string; // Dodane pole id, aby rozwiązać błąd lintera
    equipment_name: string;
    quantity: number;
    price_per_day: number;
    deposit: number;
  }>;
  additional_services?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  history: Array<{
    changed_at: string;
    previous_status: string;
    new_status: string;
    comment: string;
    changed_by: string;
  }>;
  reservation: {
    id: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
  };
}

interface CustomerUpdateData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  company_nip: string;
  street: string;
  city: string;
  postal_code: string;
  notes?: string;
}

// Aktualizacja interfejsu dla editedDetails
interface EditedDetails {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  status?: string;
}

// Dodajmy funkcję pomocniczą do obsługi połączeń z Supabase z retry
const supabaseRequestWithRetry = async <T,>(requestFn: () => Promise<T>, maxRetries = 2, retryDelay = 1000): Promise<T> => {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      console.warn(`Próba ${attempt + 1}/${maxRetries + 1} nie powiodła się:`, error);
      lastError = error;
      
      // Jeśli to nie jest ostatnia próba, poczekaj przed kolejną
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  // Wszystkie próby nie powiodły się
  throw lastError;
};

// Funkcja do sprawdzania połączenia
const checkSupabaseConnection = async () => {
  try {
    // Ustaw timeout 5 sekund dla zapytania
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Proste zapytanie do sprawdzenia połączenia
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
      
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Błąd połączenia z Supabase:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Wyjątek podczas sprawdzania połączenia:', error);
    return false;
  }
};

const CustomerDetailsView: React.FC = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<Array<{ content: string; created_at: string }>>([]);
  const [availableStatuses] = useState([
    { 
      id: 'pending', 
      label: 'Oczekujące', 
      color: 'bg-yellow-100 text-yellow-800',
      icon: Clock
    },
    { 
      id: 'confirmed', 
      label: 'Potwierdzone', 
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle
    },
    { 
      id: 'picked_up', 
      label: 'Odebrane', 
      color: 'bg-blue-100 text-blue-800',
      icon: Package
    },
    { 
      id: 'completed', 
      label: 'Zakończone', 
      color: 'bg-indigo-100 text-indigo-800',
      icon: CheckCircle
    },
    { 
      id: 'cancelled', 
      label: 'Anulowane', 
      color: 'bg-red-100 text-red-800',
      icon: XCircle
    },
    { 
      id: 'archived', 
      label: 'Historyczne', 
      color: 'bg-gray-100 text-gray-800',
      icon: History
    }
  ]);
  const [editMode, setEditMode] = useState(false);
  const [editedDetails, setEditedDetails] = useState<EditedDetails>({
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    status: ''
  });
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    deposit: number;
  }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEquipmentList, setShowEquipmentList] = useState(false);
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
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }>>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<CustomerUpdateData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    company_nip: '',
    street: '',
    city: '',
    postal_code: ''
  });
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // Stany dla niestandardowego okna dialogowego potwierdzającego usunięcie
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<() => void | null>(() => null);

  // Nowe stany dla płatności
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [newPayment, setNewPayment] = useState<{
    amount: number;
    payment_type: Payment['payment_type'];
    payment_method: Payment['payment_method'];
    notes: string;
  }>({
    amount: 0,
    payment_type: 'advance',
    payment_method: 'cash',
    notes: ''
  });
  
  // Nowe stany dla usterek
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [newIssue, setNewIssue] = useState<{
    equipment_id: string;
    description: string;
    category: Issue['category'];
    priority: Issue['priority'];
    is_customer_fault: boolean;
    images: File[];
  }>({
    equipment_id: '',
    description: '',
    category: 'mechanical',
    priority: 'important',
    is_customer_fault: false,
    images: []
  });

  const [isCompanyCustomer, setIsCompanyCustomer] = useState(false);

  // Na początku komponentu dodaję zmienną stanu dla komunikatu sukcesu
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Dodajemy brakujące stany dla edytowanego sprzętu i usług
  const [editedEquipment, setEditedEquipment] = useState<Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    deposit?: number;
  }>>([]);
  
  const [editedServices, setEditedServices] = useState<Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>>([]);

  const [originalCustomerData, setOriginalCustomerData] = useState<CustomerUpdateData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    company_nip: '',
    street: '',
    city: '',
    postal_code: ''
  });

  useEffect(() => {
    loadCustomerDetails();
    loadComments();
    if (details) {
      // Format dates for input fields
      const startDate = new Date(details.start_date);
      const endDate = new Date(details.end_date);
      
      setEditedDetails({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        start_time: startDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        end_time: endDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        status: details.status
      });
      
      // Sprawdzamy, czy klient ma dane firmowe
      setIsCompanyCustomer(!!details.customer.company_name);
      
      // Set customer details
      setEditedCustomer({
        id: details.customer.id,
        first_name: details.customer.first_name,
        last_name: details.customer.last_name,
        email: details.customer.email,
        phone: details.customer.phone,
        company_name: details.customer.company_name || '',
        company_nip: details.customer.company_nip || '',
        street: details.customer.street || '',
        city: details.customer.city || '',
        postal_code: details.customer.postal_code || '',
        notes: editedCustomer.notes
      });
      
      // Set selected equipment
      if (details.items) {
        setSelectedEquipment(details.items.map(item => ({
          id: item.id || `temp-${Math.random().toString(36).substring(2, 9)}`,
          name: item.equipment_name,
          quantity: item.quantity,
          price: item.price_per_day,
          deposit: item.deposit
        })));
      }
    }
  }, [id]);

  useEffect(() => {
    if (details) {
      const customerData = {
        id: details.customer.id,
        first_name: details.customer.first_name,
        last_name: details.customer.last_name,
        email: details.customer.email,
        phone: details.customer.phone,
        company_name: details.customer.company_name || '',
        company_nip: details.customer.company_nip || '',
        street: details.customer.street || '',
        city: details.customer.city || '',
        postal_code: details.customer.postal_code || ''
      };
      
      // Zapisz oryginalne dane
      setOriginalCustomerData(customerData);
      // Ustaw dane do edycji
      setEditedCustomer(customerData);
    }
  }, [details]);

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
  
  // Search customers when typing
  useEffect(() => {
    if (customerSearchTerm.length >= 3) {
      const searchCustomers = async () => {
        try {
          const { data, error } = await supabase
            .from('customers')
            .select('*')
            .or(`first_name.ilike.%${customerSearchTerm}%,last_name.ilike.%${customerSearchTerm}%,email.ilike.%${customerSearchTerm}%,phone.ilike.%${customerSearchTerm}%`)
            .limit(5);
            
          if (error) throw error;
          
          if (data) {
            setCustomerSuggestions(data);
            setShowCustomerSuggestions(true);
          }
        } catch (error) {
          console.error('Error searching customers:', error);
        }
      };
      
      searchCustomers();
    } else {
      setShowCustomerSuggestions(false);
    }
  }, [customerSearchTerm]);
  
  const handleEquipmentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowEquipmentList(true);
  };
  
  const handleAddEquipment = (equipment: Equipment) => {
    const existingIndex = selectedEquipment.findIndex(item => item.id === equipment.id);
    
    if (existingIndex >= 0) {
      // Update quantity if already selected
      const updatedEquipment = [...selectedEquipment];
      updatedEquipment[existingIndex].quantity += 1;
      setSelectedEquipment(updatedEquipment);
    } else {
      // Add new equipment
      setSelectedEquipment([
        ...selectedEquipment,
        {
          id: equipment.id,
          name: equipment.name,
          quantity: 1,
          price: equipment.price,
          deposit: equipment.deposit
        }
      ]);
    }
    
    setSearchTerm('');
    setShowEquipmentList(false);
  };
  
  const handleRemoveEquipment = (id: string) => {
    setConfirmDialogMessage('Czy na pewno chcesz usunąć ten produkt z rezerwacji?');
    setPendingAction(() => () => {
      setSelectedEquipment(selectedEquipment.filter(item => item.id !== id));
      setShowConfirmDialog(false);
    });
    setShowConfirmDialog(true);
  };
  
  const handleQuantityChange = (id: string, change: number) => {
    // Jeśli zmiana jest ujemna i spowoduje usunięcie produktu (quantity = 0), wyświetl potwierdzenie
    const item = selectedEquipment.find(item => item.id === id);
    if (change < 0 && item && item.quantity + change <= 0) {
      setConfirmDialogMessage('Czy na pewno chcesz usunąć ten produkt z rezerwacji?');
      setPendingAction(() => () => {
        const updatedEquipment = selectedEquipment.map(item => {
          if (item.id === id) {
            const newQuantity = Math.max(0, item.quantity + change);
            return { ...item, quantity: newQuantity };
          }
          return item;
        }).filter(item => item.quantity > 0);
        
        setSelectedEquipment(updatedEquipment);
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
      return;
    }
    
    const updatedEquipment = selectedEquipment.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    setSelectedEquipment(updatedEquipment);
  };
  
  const handleServiceQuantityChange = (id: string, change: number) => {
    // Jeśli zmiana jest ujemna i spowoduje usunięcie usługi (quantity = 0), wyświetl potwierdzenie
    const service = additionalServices.find(service => service.id === id);
    if (change < 0 && service && service.quantity === 1) {
      setConfirmDialogMessage('Czy na pewno chcesz usunąć tę usługę dodatkową?');
      setPendingAction(() => () => {
        const updatedServices = additionalServices.map(service => {
          if (service.id === id) {
            const newQuantity = Math.max(0, service.quantity + change);
            return { ...service, quantity: newQuantity };
          }
          return service;
        });
        
        setAdditionalServices(updatedServices);
        
        // Aktualizuj również editedServices po zmianie ilości
        const updatedEditedServices = updatedServices
          .filter(service => service.quantity > 0)
          .map(service => ({
            id: service.id,
            name: service.name,
            quantity: service.quantity,
            price: service.price
          }));
        
        setEditedServices(updatedEditedServices);
        setShowConfirmDialog(false);
      });
      setShowConfirmDialog(true);
      return;
    }
    
    const updatedServices = additionalServices.map(service => {
      if (service.id === id) {
        const newQuantity = Math.max(0, service.quantity + change);
        return { ...service, quantity: newQuantity };
      }
      return service;
    });
    
    setAdditionalServices(updatedServices);
    
    // Aktualizuj również editedServices po zmianie ilości
    const updatedEditedServices = updatedServices
      .filter(service => service.quantity > 0)
      .map(service => ({
        id: service.id,
        name: service.name,
        quantity: service.quantity,
        price: service.price
      }));
    
    setEditedServices(updatedEditedServices);
  };
  
  const handleSelectCustomer = (customer: any) => {
    setEditedCustomer({
      id: customer.id,
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      company_name: customer.company_name || '',
      company_nip: customer.company_nip || '',
      street: customer.street || '',
      city: customer.city || '',
      postal_code: customer.postal_code || '',
      notes: editedCustomer.notes
    });
    setCustomerSearchTerm(`${customer.first_name} ${customer.last_name}`);
    setShowCustomerSuggestions(false);
  };
  
  const handleAddNewCustomer = async () => {
    if (!editedCustomer.first_name || !editedCustomer.last_name) {
      alert('Proszę podać imię i nazwisko klienta');
      return;
    }
    
    try {
      // Pobierz aktualny rok
      const currentYear = new Date().getFullYear();
      
      // Pobierz ostatniego klienta z tego roku
      const { data: lastCustomer, error: countError } = await supabase
        .from('customers')
        .select('id')
        .like('id', `${currentYear}%`)
        .order('id', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      // Generuj nowe ID
      let newId;
      if (lastCustomer && lastCustomer.length > 0) {
        const lastNumber = parseInt(lastCustomer[0].id.substring(4));
        newId = `${currentYear}${lastNumber + 1}`;
      } else {
        newId = `${currentYear}1`;
      }

      // Dodaj nowego klienta z wygenerowanym ID
      const { data, error } = await supabase
        .from('customers')
        .insert({
          id: newId,
          first_name: editedCustomer.first_name,
          last_name: editedCustomer.last_name,
          email: editedCustomer.email,
          phone: editedCustomer.phone,
          company_name: editedCustomer.company_name || null,
          company_nip: editedCustomer.company_nip || null,
          street: editedCustomer.street || null,
          city: editedCustomer.city || null,
          postal_code: editedCustomer.postal_code || null
        })
        .select()
        .single();
        
      if (error) throw error;
      
      if (data) {
        setCustomerSearchTerm(`${data.first_name} ${data.last_name}`);
        setShowAddCustomerModal(false);
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Wystąpił błąd podczas dodawania klienta');
    }
  };
  
  const calculateTotal = () => {
    const equipmentTotal = selectedEquipment.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const servicesTotal = additionalServices.reduce((sum, service) => sum + (service.price * service.quantity), 0);
    return equipmentTotal + servicesTotal;
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('reservation_notes')
        .select('*')
        .eq('reservation_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Error loading comments:', err);
      setError('Nie udało się załadować komentarzy');
    }
  };

  const loadCustomerDetails = async () => {
    try {
      // Próba pobrania danych z widoku admin_reservations_view
      const { data, error } = await supabase
        .from('admin_reservations_view')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setDetails(data);
        // Aktualizuj również stan editedCustomer
        const customerData = {
          id: data.customer.id,
          first_name: data.customer.first_name,
          last_name: data.customer.last_name,
          email: data.customer.email,
          phone: data.customer.phone,
          company_name: data.customer.company_name || '',
          company_nip: data.customer.company_nip || '',
          street: data.customer.street || '',
          city: data.customer.city || '',
          postal_code: data.customer.postal_code || ''
        };
        setEditedCustomer(customerData);
        setOriginalCustomerData(customerData);
        setLoading(false);
        return;
      }

      // Jeśli widok nie istnieje, pobierz dane bezpośrednio z tabeli rezerwacji
      console.error('Error loading from view, trying direct tables:', error);
      
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          id,
          status,
          start_date,
          end_date,
          start_time,
          end_time,
          total_price,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone,
            company_name,
            company_nip,
            street,
            city,
            postal_code
          ),
          reservation_items (
            id,
            equipment_id,
            equipment:equipment (
              id,
              name,
              price_per_day,
              deposit
            ),
            quantity
          )
        `)
        .eq('id', id)
        .single();

      if (reservationError) {
        console.error('Error loading reservation details:', reservationError);
        setError('Nie udało się załadować szczegółów rezerwacji');
        setLoading(false);
        return;
      }

      if (reservationData) {
        // Użycie any do ominięcia problemów typowania z Supabase
        const resData: any = reservationData;
        const customerData = resData.customers || {};
        
        const formattedDetails: CustomerDetails = {
          id: resData.id,
          status: resData.status || 'pending',
          start_date: resData.start_date,
          end_date: resData.end_date,
          total_price: resData.total_price || 0,
          customer: {
            id: customerData.id || '',
            first_name: customerData.first_name || '',
            last_name: customerData.last_name || '',
            email: customerData.email || '',
            phone: customerData.phone || '',
            company_name: customerData.company_name || '',
            company_nip: customerData.company_nip || '',
            street: customerData.street || '',
            city: customerData.city || '',
            postal_code: customerData.postal_code || ''
          },
          items: Array.isArray(resData.reservation_items) 
            ? resData.reservation_items.map((item: any) => ({
                id: item.id,
                equipment_name: item.equipment?.name || 'Nieznany sprzęt',
                quantity: item.quantity || 1,
                price_per_day: item.equipment?.price_per_day || 0,
                deposit: item.equipment?.deposit || 0
              }))
            : [],
          history: [],
          reservation: {
            id: resData.id,
            start_date: resData.start_date,
            end_date: resData.end_date,
            start_time: resData.start_time || '08:00',
            end_time: resData.end_time || '18:00'
          }
        };

        setDetails(formattedDetails);
        
        // Aktualizuj również stan editedCustomer
        const updatedCustomer = {
          id: customerData.id || '',
          first_name: customerData.first_name || '',
          last_name: customerData.last_name || '',
          email: customerData.email || '',
          phone: customerData.phone || '',
          company_name: customerData.company_name || '',
          company_nip: customerData.company_nip || '',
          street: customerData.street || '',
          city: customerData.city || '',
          postal_code: customerData.postal_code || ''
        };
        
        setEditedCustomer(updatedCustomer);
        setOriginalCustomerData(updatedCustomer);
      }
    } catch (err) {
      console.error('Error loading customer details:', err);
      setError('Nie udało się załadować szczegółów klienta');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setSubmitting(true);
      const { error } = await supabase.rpc('update_reservation_status', {
        p_reservation_id: id,
        p_new_status: newStatus,
        p_comment: `Status zmieniony na: ${newStatus}`
      });

      if (error) throw error;
      await loadCustomerDetails();
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Nie udało się zaktualizować statusu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('reservation_notes')
        .insert({
          reservation_id: id,
          content: newComment
        });

      if (error) throw error;
      setNewComment('');
      await loadComments();
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Nie udało się dodać komentarza');
    } finally {
      setSubmitting(false);
    }
  };

  // Funkcja sprawdzająca połączenie z Supabase
  const checkSupabaseConnection = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        console.error('Błąd połączenia z Supabase:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Błąd połączenia z Supabase:', error);
      return false;
    }
  };

  const validateTimes = (startDate: string, endDate: string, startTime: string, endTime: string): boolean => {
    // Sprawdź czy daty i godziny są prawidłowe
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }
    
    const isStartSaturday = new Date(startDate).getDay() === 6;
    const isEndSaturday = new Date(endDate).getDay() === 6;
    
    const startHour = parseInt(startTime.split(':')[0], 10);
    const endHour = parseInt(endTime.split(':')[0], 10);
    
    // Sprawdź godziny dla soboty (8:00-13:00)
    if (isStartSaturday && (startHour < 8 || startHour > 13)) {
      return false;
    }
    
    if (isEndSaturday && (endHour < 8 || endHour > 13)) {
      return false;
    }
    
    // Sprawdź godziny dla dni roboczych (8:00-16:00)
    if (!isStartSaturday && (startHour < 8 || startHour > 16)) {
      return false;
    }
    
    if (!isEndSaturday && (endHour < 8 || endHour > 16)) {
      return false;
    }
    
    // Sprawdź czy data końcowa jest późniejsza od daty początkowej
    return end > start;
  };

  const handleNipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Usuń wszystkie znaki niebędące cyframi
    const numbersOnly = e.target.value.replace(/[^0-9]/g, '');
    
    // Ogranicz do 10 cyfr
    const truncated = numbersOnly.slice(0, 10);
    
    // Dodaj myślniki w odpowiednich miejscach (XXX-XXX-XX-XX)
    let formattedNip = truncated;
    if (truncated.length > 3) {
      formattedNip = truncated.slice(0, 3) + '-' + truncated.slice(3);
    }
    if (truncated.length > 6) {
      formattedNip = formattedNip.slice(0, 7) + '-' + formattedNip.slice(7);
    }
    if (truncated.length > 8) {
      formattedNip = formattedNip.slice(0, 10) + '-' + formattedNip.slice(10);
    }
    
    setEditedCustomer({...editedCustomer, company_nip: formattedNip});
  };

  const handleSaveChanges = async () => {
    if (!editMode) {
      return;
    }

    setSubmitting(true);
    let hasErrors = false;

    try {
      // Aktualizacja danych klienta
      if (editedCustomer.id) {
        console.log('Zapisywanie danych klienta:', editedCustomer);
        
        // Przygotuj dane do aktualizacji
        const updateData = {
            first_name: editedCustomer.first_name,
            last_name: editedCustomer.last_name,
            email: editedCustomer.email,
          phone: editedCustomer.phone,
          company_name: editedCustomer.company_name || '',
          company_nip: editedCustomer.company_nip ? editedCustomer.company_nip.replace(/[^0-9]/g, '') : '',
          street: editedCustomer.street || '',
          city: editedCustomer.city || '',
          postal_code: editedCustomer.postal_code || ''
        };

        // Sprawdź, czy NIP jest podany i czy ma 10 cyfr
        if (updateData.company_nip && updateData.company_nip.length !== 10) {
          alert('Nieprawidłowy format NIP. NIP powinien składać się z 10 cyfr.');
          setSubmitting(false);
          return;
        }

        const { error: customerError } = await supabase
                .from('customers')
          .update({
            ...updateData,
            company_name: isCompanyCustomer ? updateData.company_name : null,
            company_nip: isCompanyCustomer ? updateData.company_nip : null,
            street: isCompanyCustomer ? updateData.street : null,
            city: isCompanyCustomer ? updateData.city : null,
            postal_code: isCompanyCustomer ? updateData.postal_code : null
          })
                .eq('id', editedCustomer.id);
                
        if (customerError) {
          console.error('Błąd aktualizacji klienta:', customerError);
          if (customerError.code === '23514' && customerError.message.includes('valid_nip_format')) {
            alert('Nieprawidłowy format NIP. NIP powinien składać się z 10 cyfr.');
          } else {
            alert('Wystąpił błąd podczas aktualizacji danych klienta');
          }
          hasErrors = true;
          } else {
          console.log('Dane klienta zostały zaktualizowane pomyślnie');
          
          // Aktualizuj stan komponentu bezpośrednio
          const formattedNip = updateData.company_nip ? 
            `${updateData.company_nip.slice(0,3)}-${updateData.company_nip.slice(3,6)}-${updateData.company_nip.slice(6,8)}-${updateData.company_nip.slice(8,10)}` 
            : '';

          const updatedCustomer = {
            ...editedCustomer,
            company_name: isCompanyCustomer ? updateData.company_name : '',
            company_nip: isCompanyCustomer ? formattedNip : '',
            street: isCompanyCustomer ? updateData.street : '',
            city: isCompanyCustomer ? updateData.city : '',
            postal_code: isCompanyCustomer ? updateData.postal_code : ''
          };
          
          setEditedCustomer(updatedCustomer);
          setOriginalCustomerData(updatedCustomer);
          
          // Aktualizuj details
          if (details) {
            setDetails({
              ...details,
              customer: {
                ...details.customer,
                ...updatedCustomer
              }
            });
          }
        }
      }

      // Jeśli nie było błędów
      if (!hasErrors) {
        // Wyłącz tryb edycji
      setEditMode(false);
      
        // Pokaż komunikat o sukcesie
        alert('Dane zostały pomyślnie zapisane');
      }
    } catch (error) {
      console.error('Nieoczekiwany błąd:', error);
      alert('Wystąpił nieoczekiwany błąd podczas zapisywania danych');
      hasErrors = true;
    } finally {
      setSubmitting(false);
    }
  };

  // Ładowanie płatności
  useEffect(() => {
    if (id) {
      loadPayments();
    }
  }, [id]);
  
  // Ładowanie usterek
  useEffect(() => {
    if (id) {
      loadIssues();
    }
  }, [id]);
  
  // Ładowanie usług dodatkowych
  useEffect(() => {
    if (id) {
      loadAdditionalServices();
    }
  }, [id]);
  
  // Funkcja ładująca płatności
  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading payments:', error);
        // Cichy błąd - ustawiamy pustą tablicę zamiast rzucać wyjątek
        setPayments([]);
        return;
      }
      
      if (data) {
        setPayments(data);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      // Cichy błąd - nie ustawiamy komunikatu błędu
      setPayments([]);
    }
  };
  
  // Funkcja ładująca usługi dodatkowe
  const loadAdditionalServices = async () => {
    try {
      // Sprawdź, czy tabela istnieje, wykonując prostą operację
      const { data: testData, error: testError } = await supabase
        .from('reservation_additional_services')
        .select('id')
        .limit(1);
        
      if (testError) {
        console.error('Tabela usług dodatkowych nie istnieje:', testError);
        // Przywróć domyślne wartości dla usług
        setAdditionalServices([
          { id: 'gas', name: 'Butla gazowa', price: 50, quantity: 0 },
          { id: 'vacuum', name: 'Odkurzacz do żyrafy', price: 25, quantity: 0 },
          { id: 'powder', name: 'Proszek piorący Kärcher 100g', price: 10, quantity: 0 },
          { id: 'scaffold', name: 'RUSZTOWANIE', price: 100, quantity: 0 },
          { id: 'disc', name: 'Tarcza do gipsu', price: 15, quantity: 0 },
          { id: 'drill152', name: 'Wiertło do wiertnicy 152 mm', price: 40, quantity: 0 },
          { id: 'drill202', name: 'Wiertło do wiertnicy 202 mm', price: 80, quantity: 0 },
          { id: 'drill82', name: 'Wiertło do wiertnicy 82, 112, 132 mm', price: 30, quantity: 0 }
        ]);
        return;
      }
      
      const { data, error } = await supabase
        .from('reservation_additional_services')
        .select('*')
        .eq('reservation_id', id);
        
      if (error) {
        console.error('Error loading additional services:', error);
        // Cichy błąd - kontynuujemy bez zmian w usługach
        return;
      }
      
      if (data && data.length > 0) {
        // Aktualizacja stanu usług dodatkowych
        const updatedServices = additionalServices.map(service => {
          const foundService = data.find(item => item.service_id === service.id);
          if (foundService) {
            return {
              ...service,
              quantity: foundService.quantity
            };
          }
          return service;
        });
        
        setAdditionalServices(updatedServices);
      }
    } catch (error) {
      console.error('Error loading additional services:', error);
      // Cichy błąd - nie ustawiamy komunikatu błędu
    }
  };
  
  // Funkcja ładująca usterki
  const loadIssues = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('reservation_id', id)
        .order('reported_at', { ascending: false });
        
      if (error) {
        console.error('Error loading issues:', error);
        // Cichy błąd - ustawiamy pustą tablicę zamiast rzucać wyjątek
        setIssues([]);
        return;
      }
      
      if (data) {
        setIssues(data);
      }
    } catch (error) {
      console.error('Error loading issues:', error);
      // Cichy błąd - nie ustawiamy komunikatu błędu
      setIssues([]);
    }
  };
  
  // Funkcja dodająca nową płatność
  const handleAddPayment = async () => {
    if (newPayment.amount <= 0) {
      alert('Kwota płatności musi być większa od zera');
      return;
    }
    
    try {
      setSubmitting(true);
      
      const { data, error } = await supabase
        .from('payments')
        .insert({
          reservation_id: id,
          amount: newPayment.amount,
          payment_type: newPayment.payment_type,
          payment_method: newPayment.payment_method,
          status: 'completed',
          notes: newPayment.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
        
      if (error) throw error;
      
      // Resetowanie formularza i zamknięcie modalu
      setNewPayment({
        amount: 0,
        payment_type: 'advance',
        payment_method: 'cash',
        notes: ''
      });
      setIsPaymentModalOpen(false);
      
      // Odświeżenie listy płatności
      await loadPayments();
      
      // Dodanie wpisu do historii
      await supabase
        .from('reservation_history')
        .insert({
          reservation_id: id,
          changed_at: new Date().toISOString(),
          previous_status: details?.status || '',
          new_status: details?.status || '',
          comment: `Dodano płatność: ${newPayment.amount} zł (${newPayment.payment_type})`,
          changed_by: 'Administrator'
        });
        
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Wystąpił błąd podczas dodawania płatności');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Funkcja dodająca nową usterkę
  const handleAddIssue = async () => {
    if (!newIssue.equipment_id || !newIssue.description) {
      alert('Proszę wypełnić wszystkie wymagane pola');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Najpierw przesyłamy obrazy do storage
      const imageUrls: string[] = [];
      
      if (newIssue.images.length > 0) {
        for (const image of newIssue.images) {
          const fileName = `${id}/${Date.now()}_${image.name}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('issue_images')
            .upload(fileName, image);
            
          if (uploadError) throw uploadError;
          
          // Pobieranie publicznego URL
          const { data: urlData } = await supabase.storage
            .from('issue_images')
            .getPublicUrl(fileName);
            
          if (urlData) {
            imageUrls.push(urlData.publicUrl);
          }
        }
      }
      
      // Znajdź nazwę sprzętu na podstawie ID
      const equipmentItem = selectedEquipment.find(item => item.id === newIssue.equipment_id);
      
      // Dodajemy usterkę do bazy danych
      const { data, error } = await supabase
        .from('issues')
        .insert({
          reservation_id: id,
          equipment_id: newIssue.equipment_id,
          equipment_name: equipmentItem?.name || 'Nieznany sprzęt',
          description: newIssue.description,
          category: newIssue.category,
          priority: newIssue.priority,
          status: 'reported',
          reported_at: new Date().toISOString(),
          is_customer_fault: newIssue.is_customer_fault,
          images: imageUrls
        })
        .select();
        
      if (error) throw error;
      
      // Resetowanie formularza i zamknięcie modalu
      setNewIssue({
        equipment_id: '',
        description: '',
        category: 'mechanical',
        priority: 'important',
        is_customer_fault: false,
        images: []
      });
      setIsIssueModalOpen(false);
      
      // Odświeżenie listy usterek
      await loadIssues();
      
      // Dodanie wpisu do historii
      await supabase
        .from('reservation_history')
        .insert({
          reservation_id: id,
          changed_at: new Date().toISOString(),
          previous_status: details?.status || '',
          new_status: details?.status || '',
          comment: `Zgłoszono usterkę: ${newIssue.description}`,
          changed_by: 'Administrator'
        });
        
    } catch (error) {
      console.error('Error adding issue:', error);
      alert('Wystąpił błąd podczas zgłaszania usterki');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Funkcja obsługująca zmianę statusu usterki
  const handleUpdateIssueStatus = async (issueId: string, newStatus: Issue['status']) => {
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('issues')
        .update({
          status: newStatus,
          ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {})
        })
        .eq('id', issueId);
        
      if (error) throw error;
      
      // Odświeżenie listy usterek
      await loadIssues();
      
    } catch (error) {
      console.error('Error updating issue status:', error);
      alert('Wystąpił błąd podczas aktualizacji statusu usterki');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Funkcja obsługująca dodawanie zdjęć usterek
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files);
      setNewIssue(prev => ({
        ...prev,
        images: [...prev.images, ...newImages]
      }));
    }
  };
  
  // Funkcja usuwająca zdjęcie z formularza
  const handleRemoveImage = (index: number) => {
    setNewIssue(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleDateClick = async (date: Date | null): Promise<void> => {
    // Implementacja funkcji
    console.log(date);
  };

  // Funkcja sprawdzająca, czy są jakieś dodane usługi do zapisania
  const hasAdditionalServicesToSave = () => {
    // Sprawdź czy są jakiekolwiek usługi zapisane w bazie
    const hasAnySavedServices = details?.additional_services && details.additional_services.length > 0;
    
    // Pobierz wszystkie usługi zapisane w bazie
    const savedServicesIds = details?.additional_services?.map(s => s.id) || [];
    
    // 1. Sprawdź, czy są usługi do dodania/zaktualizowania (quantity > 0)
    const hasServicesToAdd = additionalServices.some(service => service.quantity > 0);
    
    // 2. Sprawdź, czy są usługi do usunięcia (ilość = 0, ale istnieją w bazie)
    const hasServicesToRemove = additionalServices.some(service => {
      return service.quantity === 0 && savedServicesIds.includes(service.id);
    });
    
    // 3. Sprawdź, czy są usługi, których ilość się zmieniła
    const hasServicesQuantityChanged = details?.additional_services?.some(savedService => {
      const currentService = additionalServices.find(s => s.id === savedService.id);
      return currentService && currentService.quantity !== savedService.quantity;
    }) || false;
    
    // 4. Specjalny przypadek - wszystkie usługi są na 0, ale w bazie są jakieś zapisane usługi
    const allZeroButHasSavedServices = !hasServicesToAdd && hasAnySavedServices;
    
    console.log({
      hasServicesToAdd,
      hasServicesToRemove,
      hasServicesQuantityChanged,
      hasAnySavedServices,
      allZeroButHasSavedServices
    });
    
    return hasServicesToAdd || hasServicesToRemove || hasServicesQuantityChanged || allZeroButHasSavedServices;
  };

  // W komponencie, przed renderowaniem:
  const getTimeOptions = (date: string, isStart: boolean = true) => {
    const selectedDate = new Date(date);
    return getAvailableHours(selectedDate, isStart).map(time => (
      <option key={time} value={time}>{time}</option>
    ));
  };

  // Funkcja do anulowania edycji
  const handleCancelEdit = () => {
    // Przywróć oryginalne dane
    setEditedCustomer(originalCustomerData);
    setEditMode(false);
  };

  // Dodajemy useEffect do obsługi kliknięcia w dokument
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const productSearch = document.getElementById('product_search');
      const equipmentList = document.querySelector('.equipment-list');
      
      if (productSearch && equipmentList && 
          !productSearch.contains(event.target as Node) && 
          !equipmentList.contains(event.target as Node)) {
        setShowEquipmentList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-solrent-orange"></div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Powrót do listy
        </button>
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>Nie znaleziono szczegółów klienta</span>
        </div>
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
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-gray-400" />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {availableStatuses.map(status => {
            const StatusIcon = status.icon;
            const isActive = details?.status === status.id;
            return (
              <button
                key={status.id}
                onClick={() => handleStatusChange(status.id)}
                disabled={submitting || details?.status === status.id}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? `${status.color} ring-2 ring-offset-2 ring-${status.color.split(' ')[0]}`
                    : `hover:${status.color} bg-white border border-gray-200`
                }`}
              >
                <StatusIcon className={`w-4 h-4 mr-1.5 ${isActive ? '' : 'text-gray-400'}`} />
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
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Imię i nazwisko</p>
              <p className="font-medium">{details.customer.first_name} {details.customer.last_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{details.customer.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Telefon</p>
              <p className="font-medium">{details.customer.phone}</p>
            </div>
              {details.customer.street && (
                <div>
                  <p className="text-sm text-gray-500">Adres</p>
                  <p className="font-medium">{details.customer.street}</p>
                </div>
              )}
              {details.customer.city && details.customer.postal_code && (
                <div>
                  <p className="text-sm text-gray-500">Miasto i kod pocztowy</p>
                  <p className="font-medium">{details.customer.postal_code} {details.customer.city}</p>
                </div>
              )}
            {details.customer.company_name && (
              <>
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500">Nazwa firmy</p>
                  <p className="font-medium">{details.customer.company_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NIP</p>
                  <p className="font-medium">{details.customer.company_nip}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Szczegóły rezerwacji */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Szczegóły rezerwacji</h2>
            <Calendar className="w-6 h-6 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
                <div className="mt-2">
                  {availableStatuses.find(s => s.id === details.status)?.label || details.status}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data rozpoczęcia</p>
              <p className="font-medium">
                {new Date(details.start_date).toLocaleDateString('pl-PL')}
              </p>
                <p className="text-sm text-gray-500 mt-1">Godzina</p>
                <p className="font-medium">
                  {new Date(details.start_date).toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}
                </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data zakończenia</p>
              <p className="font-medium">
                {new Date(details.end_date).toLocaleDateString('pl-PL')}
              </p>
                <p className="text-sm text-gray-500 mt-1">Godzina</p>
                <p className="font-medium">
                  {new Date(details.end_date).toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}
                </p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500">Całkowita wartość</p>
              <p className="text-xl font-bold text-solrent-orange">
                {details.total_price} zł
              </p>
            </div>
          </div>
        </div>

          {/* Zarezerwowany sprzęt */}
          <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Zarezerwowany sprzęt</h2>
            <Package className="w-6 h-6 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {details.items?.map((item, index) => (
              <div key={index} className="flex justify-between items-start pb-4 border-b last:border-0">
                <div>
                  <p className="font-medium">{item.equipment_name}</p>
                  <p className="text-sm text-gray-500">Ilość: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{item.price_per_day} zł/dzień</p>
                  {item.deposit > 0 && (
                    <p className="text-sm text-orange-600">Kaucja: {item.deposit} zł</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

          {/* Usługi dodatkowe */}
          {details.additional_services && details.additional_services.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Usługi dodatkowe</h2>
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              
              <div className="space-y-4">
                {details.additional_services.map((service, index) => (
                  <div key={index} className="flex justify-between items-start pb-4 border-b last:border-0">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-gray-500">Ilość: {service.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{service.price} zł</p>
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
              {comments.length > 0 ? (
                comments.map((comment, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500">
                      {new Date(comment.created_at).toLocaleString('pl-PL')}
                    </p>
                    <p className="mt-1">{comment.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center">Brak komentarzy</p>
              )}
            </div>
          </div>

          {/* Historia płatności */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Historia płatności</h2>
              <CreditCard className="w-6 h-6 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              {payments.length > 0 ? (
                payments.map((payment, index) => (
                  <div key={payment.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {payment.amount} zł
                          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                            payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                            payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {payment.status === 'completed' ? 'Zrealizowana' :
                             payment.status === 'pending' ? 'Oczekująca' : 'Anulowana'}
                          </span>
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(payment.created_at).toLocaleDateString('pl-PL')}
                        </p>
                        <p className="text-sm mt-1">
                          Typ: {
                            payment.payment_type === 'deposit' ? 'Kaucja' :
                            payment.payment_type === 'advance' ? 'Zaliczka' :
                            payment.payment_type === 'full_payment' ? 'Pełna płatność' : 'Dopłata'
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          Metoda: {
                            payment.payment_method === 'cash' ? 'Gotówka' :
                            payment.payment_method === 'transfer' ? 'Przelew' :
                            payment.payment_method === 'online' ? 'Online' : 'BLIK'
                          }
                        </p>
                      </div>
                    </div>
                    {payment.notes && (
                      <p className="mt-2 text-sm text-gray-600 border-t pt-2">
                        {payment.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center">Brak historii płatności</p>
              )}
            </div>
            
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="mt-4 w-full py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700"
            >
              Dodaj płatność
            </button>
          </div>
          
          {/* Usterki i serwis */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Usterki i serwis</h2>
              <Wrench className="w-6 h-6 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              {issues.length > 0 ? (
                issues.map((issue) => (
                  <div key={issue.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{issue.equipment_name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(issue.reported_at).toLocaleDateString('pl-PL')}
                        </p>
                        <p className="mt-1">{issue.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          issue.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          issue.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {issue.status === 'resolved' ? 'Rozwiązane' :
                           issue.status === 'in_progress' ? 'W trakcie' : 'Zgłoszone'}
                        </span>
                        <p className="text-sm mt-1">
                          Kategoria: {
                            issue.category === 'mechanical' ? 'Mechaniczna' :
                            issue.category === 'electrical' ? 'Elektryczna' :
                            issue.category === 'cosmetic' ? 'Kosmetyczna' : 'Inna'
                          }
                        </p>
                        <p className="text-sm">
                          Priorytet: {
                            issue.priority === 'critical' ? 'Krytyczny' :
                            issue.priority === 'important' ? 'Ważny' : 'Niski'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {issue.images && issue.images.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {issue.images.map((image, index) => (
                          <a 
                            key={index} 
                            href={image} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block w-16 h-16 rounded overflow-hidden"
                          >
                            <img 
                              src={image} 
                              alt={`Zdjęcie usterki ${index + 1}`} 
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    
                    {issue.status !== 'resolved' && (
                      <div className="mt-3 flex justify-end space-x-2">
                        {issue.status === 'reported' && (
                          <button
                            onClick={() => handleUpdateIssueStatus(issue.id, 'in_progress')}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200"
                          >
                            Rozpocznij naprawę
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateIssueStatus(issue.id, 'resolved')}
                          className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm hover:bg-green-200"
                        >
                          Oznacz jako naprawione
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center">Brak zgłoszonych usterek</p>
              )}
            </div>
            
            <button
              onClick={() => setIsIssueModalOpen(true)}
              className="mt-4 w-full py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700"
            >
              Zgłoś usterkę
            </button>
          </div>
        </div>

        {/* Prawa kolumna - edytowalne dane */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900">Szczegóły</h2>
                <h2 className="text-xl font-semibold text-gray-900 ml-4 pl-4 border-l">Dane klienta</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => editMode ? handleCancelEdit() : setEditMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    editMode 
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-solrent-orange text-white hover:bg-orange-700'
                  }`}
                >
                  {editMode ? 'Anuluj edycję' : 'Edytuj dane'}
                </button>
                {editMode && (
                  <button
                    onClick={handleSaveChanges}
                    disabled={submitting}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>
                )}
                <Package className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            
            {/* Połączone sekcje terminu rezerwacji i szczegółów */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Dane klienta - lewa strona */}
                    <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                    Dane podstawowe
                </label>
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="text-sm text-solrent-orange hover:text-orange-700 flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Dodaj nowego klienta
                </button>
              </div>
              
              <div className="space-y-4">
                {editMode && (
                  <div className="mb-4">
                  <label htmlFor="customer_search" className="block text-sm font-medium text-gray-700 mb-1">
                      Wyszukaj klienta
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="customer_search"
                      placeholder="Wyszukaj klienta..."
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                    {showCustomerSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {customerSuggestions.map(customer => (
                          <div
                            key={customer.id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <div>
                              <span className="font-medium">{customer.first_name} {customer.last_name}</span>
                              <p className="text-sm text-gray-600">{customer.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Imię
                  </label>
                    {editMode ? (
                  <input
                        type="text"
                        id="first_name"
                        value={editedCustomer.first_name}
                        onChange={(e) => setEditedCustomer({...editedCustomer, first_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                        disabled={submitting}
                  />
                    ) : (
                      <p className="py-2">{editedCustomer.first_name}</p>
                    )}
                </div>
                <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nazwisko
                  </label>
                    {editMode ? (
                  <input
                    type="text"
                        id="last_name"
                        value={editedCustomer.last_name}
                        onChange={(e) => setEditedCustomer({...editedCustomer, last_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                        disabled={submitting}
                  />
                    ) : (
                      <p className="py-2">{editedCustomer.last_name}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="customer_email"
                    value={editedCustomer.email}
                    onChange={(e) => setEditedCustomer({...editedCustomer, email: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    disabled={!editMode}
                  />
                </div>
                
                <div>
                  <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    id="customer_phone"
                    value={editedCustomer.phone}
                    onChange={(e) => setEditedCustomer({...editedCustomer, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    disabled={!editMode}
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isCompanyCustomer}
                      onChange={(e) => setIsCompanyCustomer(e.target.checked)}
                      className="rounded text-solrent-orange focus:ring-solrent-orange"
                      disabled={!editMode}
                    />
                    <span className="text-sm font-medium text-gray-700">Klient firmowy</span>
                  </label>
              </div>
            </div>
            
                {/* Dodatkowe dane klienta */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dodatkowe dane klienta
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {isCompanyCustomer ? (
              <>
                <div>
                          <label htmlFor="customer_company_name" className="block text-xs text-gray-500 mb-1">
                    Nazwa firmy
                  </label>
                  <input
                    type="text"
                    id="customer_company_name"
                            value={editedCustomer.company_name || ''}
                    onChange={(e) => setEditedCustomer({...editedCustomer, company_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    disabled={!editMode}
                  />
                </div>
                
                <div>
                          <label htmlFor="customer_company_nip" className="block text-xs text-gray-500 mb-1">
                    NIP
                  </label>
                  <input
                    type="text"
                    id="customer_company_nip"
                            value={editedCustomer.company_nip || ''}
                    onChange={handleNipChange}
                    placeholder="XXX-XXX-XX-XX"
                    maxLength={13}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    disabled={!editMode}
                  />
                </div>
                
                <div>
                          <label htmlFor="customer_street" className="block text-xs text-gray-500 mb-1">
                    Ulica i numer
                  </label>
                  <input
                    type="text"
                    id="customer_street"
                            value={editedCustomer.street || ''}
                    onChange={(e) => setEditedCustomer({...editedCustomer, street: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    disabled={!editMode}
                  />
                </div>
                
                        <div className="grid grid-cols-2 gap-2">
                <div>
                            <label htmlFor="customer_postal_code" className="block text-xs text-gray-500 mb-1">
                              Kod pocztowy
                  </label>
                  <input
                    type="text"
                              id="customer_postal_code"
                              value={editedCustomer.postal_code || ''}
                              onChange={(e) => setEditedCustomer({...editedCustomer, postal_code: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    disabled={!editMode}
                  />
                </div>
                <div>
                            <label htmlFor="customer_city" className="block text-xs text-gray-500 mb-1">
                              Miasto
                  </label>
                  <input
                    type="text"
                              id="customer_city"
                              value={editedCustomer.city || ''}
                              onChange={(e) => setEditedCustomer({...editedCustomer, city: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    disabled={!editMode}
                  />
                          </div>
                </div>
              </>
                    ) : null}
                  </div>
                </div>
            </div>
            
              {/* Termin rezerwacji - prawa strona */}
            <div>
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Termin rezerwacji
              </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" /> Data rozpoczęcia
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      value={editedDetails.start_date}
                      onChange={(e) => setEditedDetails({...editedDetails, start_date: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      disabled={submitting || !editMode}
              />
            </div>
            
                  <div>
                    <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Clock3 className="w-4 h-4" /> Godzina rozpoczęcia
                </label>
                    <select
                      id="start_time"
                      value={editedDetails.start_time}
                      onChange={(e) => setEditedDetails({...editedDetails, start_time: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      disabled={submitting || !editMode}
                    >
                      {getTimeOptions(editedDetails.start_date, true)}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" /> Data zakończenia
                </label>
                    <input
                      type="date"
                      id="end_date"
                      value={editedDetails.end_date}
                      onChange={(e) => setEditedDetails({...editedDetails, end_date: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      disabled={submitting || !editMode}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Clock3 className="w-4 h-4" /> Godzina zakończenia
                </label>
                    <select
                      id="end_time"
                      value={editedDetails.end_time}
                      onChange={(e) => setEditedDetails({...editedDetails, end_time: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      disabled={submitting || !editMode}
                    >
                      {getTimeOptions(editedDetails.end_date, false)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Wybór produktu */}
            <div className="mb-6">
              <label htmlFor="product_search" className="block text-sm font-medium text-gray-700 mb-1">
                Produkt
                </label>
              <div className="relative">
                <input
                  type="text"
                  id="product_search"
                  placeholder="Wyszukaj produkt..."
                  value={searchTerm}
                  onChange={handleEquipmentSearch}
                  onFocus={() => setShowEquipmentList(true)}
                  className="w-full px-3 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                
                {showEquipmentList && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto equipment-list">
                    {availableEquipment
                      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(item => (
                        <div
                          key={item.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleAddEquipment(item)}
                        >
                          <div className="flex justify-between">
                            <span>{item.name}</span>
                            <span className="text-solrent-orange font-medium">{item.price} zł/dzień</span>
                          </div>
                        </div>
                      ))}
                    {availableEquipment.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                      <div className="px-4 py-2 text-gray-500">Brak wyników</div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Lista wybranych produktów */}
              <div className="mt-4 space-y-3">
                {selectedEquipment.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.price} zł/dzień</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleQuantityChange(item.id, -1)}
                        className="p-1 rounded-full bg-gray-200 hover:bg-gray-300"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(item.id, 1)}
                        className="p-1 rounded-full bg-gray-200 hover:bg-gray-300"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveEquipment(item.id)}
                        className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {selectedEquipment.length === 0 && (
                  <p className="text-gray-500 text-center py-2">Brak wybranych produktów</p>
                )}
              </div>
            </div>
            
            {/* Usługi dodatkowe */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Usługi dodatkowe</h3>
                <span className="text-xs text-gray-500">Możesz dodawać i usuwać usługi bez klikania "Edytuj dane"</span>
              </div>
              
              <div className="space-y-3">
                {additionalServices.map(service => (
                  <div key={service.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-gray-600">{service.price} zł</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleServiceQuantityChange(service.id, -1)}
                        className="p-1 rounded-full bg-gray-200 hover:bg-gray-300"
                        disabled={service.quantity === 0}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center">{service.quantity}</span>
                      <button
                        onClick={() => handleServiceQuantityChange(service.id, 1)}
                        className="p-1 rounded-full bg-gray-200 hover:bg-gray-300"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Podsumowanie płatności */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">Suma brutto:</span>
                <span className="font-bold text-solrent-orange">{calculateTotal()} zł</span>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleSaveChanges}
                  disabled={submitting}
                  className="px-4 py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Modal dodawania nowego klienta */}
          {showAddCustomerModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Dodaj nowego klienta</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="new_first_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Imię*
                    </label>
                    <input
                      type="text"
                      id="new_first_name"
                      value={editedCustomer.first_name}
                      onChange={(e) => setEditedCustomer({...editedCustomer, first_name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_last_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nazwisko*
                    </label>
                    <input
                      type="text"
                      id="new_last_name"
                      value={editedCustomer.last_name}
                      onChange={(e) => setEditedCustomer({...editedCustomer, last_name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="new_email"
                      value={editedCustomer.email}
                      onChange={(e) => setEditedCustomer({...editedCustomer, email: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      id="new_phone"
                      value={editedCustomer.phone}
                      onChange={(e) => setEditedCustomer({...editedCustomer, phone: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_street" className="block text-sm font-medium text-gray-700 mb-1">
                      Ulica i numer
                    </label>
                    <input
                      type="text"
                      id="new_street"
                      value={editedCustomer.street}
                      onChange={(e) => setEditedCustomer({...editedCustomer, street: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_city" className="block text-sm font-medium text-gray-700 mb-1">
                      Miasto
                    </label>
                    <input
                      type="text"
                      id="new_city"
                      value={editedCustomer.city}
                      onChange={(e) => setEditedCustomer({...editedCustomer, city: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_postal_code" className="block text-sm font-medium text-gray-700 mb-1">
                      Kod pocztowy
                    </label>
                    <input
                      type="text"
                      id="new_postal_code"
                      value={editedCustomer.postal_code}
                      onChange={(e) => setEditedCustomer({...editedCustomer, postal_code: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_company_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nazwa firmy
                    </label>
                    <input
                      type="text"
                      id="new_company_name"
                      value={editedCustomer.company_name}
                      onChange={(e) => setEditedCustomer({...editedCustomer, company_name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="new_company_nip" className="block text-sm font-medium text-gray-700 mb-1">
                      NIP
                    </label>
                    <input
                      type="text"
                      id="new_company_nip"
                      value={editedCustomer.company_nip}
                      onChange={(e) => setEditedCustomer({...editedCustomer, company_nip: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end mt-6 space-x-3">
                  <button
                    onClick={() => setShowAddCustomerModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleAddNewCustomer}
                    className="px-4 py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700"
                  >
                    Dodaj klienta
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Formularz dodawania komentarza */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Dodaj komentarz</h2>
              <MessageSquare className="w-6 h-6 text-gray-400" />
            </div>
          
          <form onSubmit={handleCommentSubmit} className="mb-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Dodaj komentarz..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
              rows={3}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="mt-2 w-full py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dodaj komentarz
            </button>
          </form>
          </div>
        </div>
      </div>
      
      {/* Modal dodawania płatności */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Dodaj płatność</h2>

          <div className="space-y-4">
              <div>
                <label htmlFor="payment_amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Kwota*
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="payment_amount"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({...newPayment, amount: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                    min="0"
                    step="0.01"
                    required
                  />
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
          </div>
              
              <div>
                <label htmlFor="payment_type" className="block text-sm font-medium text-gray-700 mb-1">
                  Typ płatności*
                </label>
                <select
                  id="payment_type"
                  value={newPayment.payment_type}
                  onChange={(e) => setNewPayment({...newPayment, payment_type: e.target.value as Payment['payment_type']})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                >
                  <option value="advance">Zaliczka</option>
                  <option value="deposit">Kaucja</option>
                  <option value="full_payment">Pełna płatność</option>
                  <option value="additional">Dopłata</option>
                </select>
        </div>

              <div>
                <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700 mb-1">
                  Metoda płatności*
                </label>
                <select
                  id="payment_method"
                  value={newPayment.payment_method}
                  onChange={(e) => setNewPayment({...newPayment, payment_method: e.target.value as Payment['payment_method']})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                >
                  <option value="cash">Gotówka</option>
                  <option value="transfer">Przelew</option>
                  <option value="online">Płatność online</option>
                  <option value="blik">BLIK</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="payment_notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notatki
                </label>
                <textarea
                  id="payment_notes"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-6 space-x-3">
          <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddPayment}
                disabled={submitting || newPayment.amount <= 0}
                className="px-4 py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Dodawanie...' : 'Dodaj płatność'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal zgłaszania usterki */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Zgłoś usterkę</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="issue_equipment" className="block text-sm font-medium text-gray-700 mb-1">
                  Sprzęt*
                </label>
                <select
                  id="issue_equipment"
                  value={newIssue.equipment_id}
                  onChange={(e) => setNewIssue({...newIssue, equipment_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                >
                  <option value="">Wybierz sprzęt</option>
                  {selectedEquipment.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (x{item.quantity})
                    </option>
                  ))}
                </select>
            </div>
              
              <div>
                <label htmlFor="issue_category" className="block text-sm font-medium text-gray-700 mb-1">
                  Kategoria*
                </label>
                <select
                  id="issue_category"
                  value={newIssue.category}
                  onChange={(e) => setNewIssue({...newIssue, category: e.target.value as Issue['category']})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                >
                  <option value="mechanical">Mechaniczna</option>
                  <option value="electrical">Elektryczna</option>
                  <option value="cosmetic">Kosmetyczna</option>
                  <option value="other">Inna</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="issue_priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Priorytet*
                </label>
                <select
                  id="issue_priority"
                  value={newIssue.priority}
                  onChange={(e) => setNewIssue({...newIssue, priority: e.target.value as Issue['priority']})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  required
                >
                  <option value="critical">Krytyczny</option>
                  <option value="important">Ważny</option>
                  <option value="minor">Niski</option>
                </select>
              </div>
              
                      <div>
                <label htmlFor="issue_description" className="block text-sm font-medium text-gray-700 mb-1">
                  Opis usterki*
                </label>
                <textarea
                  id="issue_description"
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({...newIssue, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-solrent-orange"
                  rows={3}
                  required
                />
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newIssue.is_customer_fault}
                    onChange={(e) => setNewIssue({...newIssue, is_customer_fault: e.target.checked})}
                    className="rounded text-solrent-orange focus:ring-solrent-orange mr-2"
                  />
                  <span className="text-sm text-gray-700">Wina klienta</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zdjęcia usterki
                </label>
                <div className="mt-1 flex items-center">
                  <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none">
                    <span className="flex flex-col items-center space-y-2">
                      <Camera className="w-6 h-6 text-gray-400" />
                      <span className="font-medium text-sm text-gray-600">
                        Kliknij, aby dodać zdjęcia
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
                
                {newIssue.images.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Wybrane zdjęcia ({newIssue.images.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {newIssue.images.map((image, index) => (
                        <div key={index} className="relative w-16 h-16 rounded overflow-hidden">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Zdjęcie ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                        )}
                      </div>
                    </div>
            
            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={() => setIsIssueModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddIssue}
                disabled={submitting || !newIssue.equipment_id || !newIssue.description}
                className="px-4 py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Zgłaszanie...' : 'Zgłoś usterkę'}
              </button>
                </div>
          </div>
        </div>
      )}
      
      {/* Niestandardowe okno dialogowe potwierdzające */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Potwierdzenie</h2>
            <p className="mb-6">{confirmDialogMessage}</p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={() => pendingAction && pendingAction()}
                className="px-4 py-2 bg-solrent-orange text-white rounded-lg hover:bg-orange-700"
              >
                Potwierdź
              </button>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetailsView