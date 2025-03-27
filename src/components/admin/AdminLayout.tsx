import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Package, Users, Calendar, FileText, PenTool as Tool, 
  AlertTriangle, DollarSign, Settings, UserPlus, Phone, 
  Mail, FileCheck, ChevronLeft, BarChart2, TrendingUp,
  Moon, Sun
} from 'lucide-react';

interface AdminLayoutProps {
  onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [pendingCount, setPendingCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Sprawdź zapisane ustawienie w localStorage lub użyj preferencji systemowych
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || 
           (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Zastosuj ciemny motyw do całej strony
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Zapisz preferencję w localStorage
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadPendingCount();
    
    // Subskrybuj zmiany w tabeli reservations
    const channel = supabase
      .channel('reservation_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'reservations',
          filter: 'status=eq.pending'
        },
        () => loadPendingCount()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadPendingCount = async () => {
    try {
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      setPendingCount(count || 0);
    } catch (err) {
      console.error('Error loading pending count:', err);
    }
  };
  const menuItems = [
    { path: 'dashboard', icon: Package, title: 'Dashboard' },
    { 
      path: 'reservations', 
      icon: Calendar, 
      title: 'Rezerwacje',
      badge: pendingCount > 0 ? pendingCount : undefined
    },
    { path: 'crm', icon: UserPlus, title: 'CRM' },
    { path: 'customers', icon: Users, title: 'Klienci' },
    { path: 'equipment', icon: Package, title: 'Produkty' },
    { path: 'equipment-stats', icon: TrendingUp, title: 'Statystyki sprzętu' },
    { path: 'calendar', icon: Calendar, title: 'Kalendarz' },
    { path: 'statistics', icon: BarChart2, title: 'Statystyki wypożyczeń' },
    { path: 'advertisements', icon: FileText, title: 'Reklamy' }
  ];

  // Funkcja przełączania trybu ciemnego
  const toggleDarkMode = () => {
    console.log('Kliknięto przycisk przełączania trybu - obecny stan:', darkMode);
    
    // Najpierw ustawiamy nowy stan
    const newDarkMode = !darkMode;
    console.log('Nowy stan trybu:', newDarkMode ? 'ciemny' : 'jasny');
    
    // Aktualizujemy stan w komponencie
    setDarkMode(newDarkMode);
    
    try {
      // Zapisujemy w localStorage (to wywołuje zdarzenie storage dla innych komponentów)
      localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
      console.log('Zapisano w localStorage:', newDarkMode ? 'dark' : 'light');
      
      // Wprowadzamy zmiany w DOM
      if (newDarkMode) {
        console.log('Dodaję klasę dark do html');
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        console.log('Usuwam klasę dark z html');
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
      
      // Wymuś synchronizację z localStorage emitując zdarzenie 
      window.dispatchEvent(new Event('storage'));
      
      // Wymuś bezpośrednią aktualizację kontenerów kalendarza
      console.log('Aktualizuję kontenery fullcalendar');
      const containers = document.querySelectorAll('.fullcalendar-container');
      console.log(`Znaleziono ${containers.length} kontenerów kalendarza`);
      
      containers.forEach(container => {
        if (newDarkMode) {
          container.classList.add('dark');
        } else {
          container.classList.remove('dark');
        }
      });
      
      console.log('Przełączanie trybu zakończone powodzeniem');
    } catch (error) {
      console.error('Błąd podczas przełączania trybu:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Nagłówek */}
      <header className={`bg-white dark:bg-gray-800 shadow fixed top-0 right-0 left-0 z-30 transition-all duration-300 ${!isMobile ? (isCollapsed ? 'ml-16' : 'ml-64') : 'ml-0'}`}>
        <div className="flex justify-between items-center h-[73px] px-4">
          {isMobile && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          )}
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white ml-2">Panel Administracyjny</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={darkMode ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw'}
              aria-label={darkMode ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-red-600 text-white text-sm md:text-base rounded hover:bg-red-700"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-[73px] bg-gray-100 dark:bg-gray-900">
        {/* Menu boczne */}
        <nav className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ease-in-out z-40
          ${isMobile 
            ? `w-64 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `${isCollapsed ? 'w-16' : 'w-64'}`
          }`}>
          <div className="h-[73px] flex items-center justify-center border-b dark:border-gray-700">
            <img 
              src="/assets/solrent-logo.png"
              alt="SOLRENT Logo"
              className={`h-12 object-contain transition-all duration-300 ${!isMobile && isCollapsed ? 'scale-75' : ''}`}
            />
          </div>
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="absolute -right-3 top-20 bg-white dark:bg-gray-800 rounded-full p-1.5 shadow-lg border dark:border-gray-700"
              aria-label={isCollapsed ? 'Rozwiń menu' : 'Zwiń menu'}
            >
              <ChevronLeft className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="space-y-1 p-4">
            {menuItems.map(item => {
              let isActive = false;
              
              if (item.path === 'equipment') {
                isActive = location.pathname.includes(`/admin/panel/${item.path}`) && 
                          !location.pathname.includes('/admin/panel/equipment-stats');
              } else {
                isActive = location.pathname.includes(`/admin/panel/${item.path}`);
              }
              
              return (
                <MenuItem
                  key={item.path}
                  icon={item.icon}
                  title={item.title}
                  active={isActive}
                  onClick={() => {
                    navigate(`/admin/panel/${item.path}`);
                    if (isMobile) setIsMobileMenuOpen(false);
                  }}
                  collapsed={!isMobile && isCollapsed}
                  badge={item.badge}
                />
              );
            })}
          </div>
        </nav>

        {/* Overlay dla menu mobilnego */}
        {isMobile && isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Główna zawartość */}
        <main className={`flex-1 bg-white dark:bg-gray-800 dark:text-gray-200 rounded-lg shadow-lg p-4 md:p-6 lg:p-8 transition-all duration-300 overflow-auto mt-4
          ${isMobile ? 'ml-0' : (isCollapsed ? 'ml-16' : 'ml-64')}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

interface MenuItemProps {
  icon: React.ElementType;
  title: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
  badge?: number;
}

const MenuItem: React.FC<MenuItemProps> = ({ 
  icon: Icon, 
  title, 
  active, 
  onClick, 
  collapsed = false, 
  badge 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-start px-3'} py-3 md:py-2 rounded-lg transition-all duration-300 ${
      active 
        ? 'bg-solrent-orange text-white' 
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
    title={collapsed ? title : undefined}
  >
    <div className="relative flex-shrink-0">
      <Icon className="w-5 h-5" />
      {badge !== undefined && (
        <span className={`absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
          collapsed ? 'scale-90' : ''
        }`}>
          {badge}
        </span>
      )}
    </div>
    {!collapsed && (
      <span className="ml-3 whitespace-nowrap text-sm md:text-base">
        {title}
      </span>
    )}
  </button>
);

export default AdminLayout;