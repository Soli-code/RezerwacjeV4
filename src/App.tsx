import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ReservationWidget from './components/reservation/ReservationWidget';
import ContactButton from './components/ui/ContactButton';
import AdminLoginPage from './components/auth/AdminLoginPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import PasswordResetPage from './components/auth/PasswordResetPage';
import AdminLayout from './components/admin/AdminLayout';
import BusinessDashboard from './components/admin/BusinessDashboard';
import Pipeline from './components/admin/Pipeline';
import AdminCustomers from './components/admin/AdminCustomers';
import CRMDashboard from './components/admin/CRMDashboard';
import AdminProducts from './components/admin/AdminProducts';
import AdminAdvertisements from './components/admin/AdminAdvertisements';
import ReservationCalendar from './components/admin/ReservationCalendar';
import RentalStatistics from './components/admin/RentalStatistics';
import CustomerDetailsView from './components/customer/CustomerDetailsView';
import CustomerProfile from './components/customer/CustomerProfile';
import EquipmentStats from './components/admin/EquipmentStats';
import EquipmentDetails from './components/admin/EquipmentDetails';
import NewCustomerDetailsView from './components/customer/NewCustomerDetailsView';

// Komponent do obsługi przekierowań
const RedirectToHome = () => {
  useEffect(() => {
    window.location.href = '/';
  }, []);
  return null;
};

// Funkcja synchronizacji trybu ciemnego
const syncDarkMode = () => {
  const savedTheme = localStorage.getItem('theme');
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDarkMode);
  
  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  }
  
  // Aktualizuj również kontenery fullcalendar
  document.querySelectorAll('.fullcalendar-container').forEach(container => {
    if (shouldBeDark) {
      container.classList.add('dark');
    } else {
      container.classList.remove('dark');
    }
  });
  
  return shouldBeDark;
};

function App() {
  useEffect(() => {
    // Inicjalizacja trybu ciemnego
    syncDarkMode();
    
    // Obserwuj zmiany w localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme') {
        console.log('Wykryto zmianę w localStorage theme:', e.newValue);
        syncDarkMode();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Obserwuj zmiany klasy 'dark' na elemencie HTML
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const htmlElement = document.documentElement;
          const isDark = htmlElement.classList.contains('dark');
          
          document.querySelectorAll('.fullcalendar-container').forEach(container => {
            if (isDark) {
              container.classList.add('dark');
            } else {
              container.classList.remove('dark');
            }
          });
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Inicjalizacja przy ładowaniu strony z małym opóźnieniem
    setTimeout(() => {
      syncDarkMode();
    }, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      observer.disconnect();
    };
  }, []);

  return (
    <Router>
      <div className="relative min-h-screen">
        <Routes>
          <Route path="/admin" element={<AdminLoginPage onLogin={() => window.location.href = '/admin/panel'} />} />
          <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/admin/reset-password" element={<PasswordResetPage />} />
          <Route path="/admin/panel" element={<AdminLayout onLogout={() => window.location.href = '/admin'} />}>
            <Route index element={<Navigate to="/admin/panel/dashboard" replace />} />
            <Route path="dashboard" element={<BusinessDashboard />} />
            <Route path="reservations" element={<Pipeline />} />
            <Route path="reservations/:id" element={<CustomerDetailsView />} />
            <Route path="reservations/new" element={<NewCustomerDetailsView />} />
            <Route path="crm" element={<CRMDashboard />} />
            <Route path="equipment" element={<AdminProducts />} />
            <Route path="equipment-stats" element={<EquipmentStats />} />
            <Route path="equipment-stats/:id" element={<EquipmentDetails />} />
            <Route path="advertisements" element={<AdminAdvertisements />} />
            <Route path="calendar" element={<ReservationCalendar />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="customers/:id" element={<CustomerProfile />} />
            <Route path="statistics" element={<RentalStatistics />} />
          </Route>
          <Route path="/admin/*" element={<RedirectToHome />} />
          <Route path="/" element={
            <div className="min-h-screen bg-solrent-light relative">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative pt-28">
                <img 
                  src="/assets/solrent-logo.png"
                  alt="SOLRENT Logo"
                  className="absolute top-4 left-4 md:left-8 h-20 object-contain"
                />
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-8 md:mb-12 text-solrent-dark max-w-4xl mx-auto">
                  Rezerwacja sprzętu budowlanego i ogrodniczego
                </h1>
                <div className="max-w-6xl mx-auto">
                  <ReservationWidget />
                </div>
              </div>
              <ContactButton />
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;