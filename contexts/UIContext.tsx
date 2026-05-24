
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { ViewType } from '../types';

interface UIState {
  currentView: ViewType;
  sidebarOpen: boolean;
  activeTab: string;
  isLiveAssistantOpen: boolean;
  modal: { isOpen: boolean; type: string | null; payload: any };
  toastMessage: string | null;
  isOnline: boolean;
  // Per-portal sub-tab navigation. Each portal renders its own row of tabs
  // and switches sub-views off these strings.
  managementSubView: string;
  fleetSubView: string;
  workshopSubView: string;
  financeSubView: string;
  operationsSubView: string;
}

interface UIContextType extends UIState {
  handleViewChange: (view: ViewType) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  setIsLiveAssistantOpen: (open: boolean) => void;
  showModal: (type: string, payload?: any) => void;
  hideModal: () => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
  handleManagementSubViewChange: (view: string) => void;
  handleFleetSubViewChange: (view: string) => void;
  handleWorkshopSubViewChange: (view: string) => void;
  handleFinanceSubViewChange: (view: string) => void;
  handleOperationsSubViewChange: (view: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // `management` is the renderView default in App.tsx; the legacy 'Dashboard'
  // string here was not a valid ViewType and only worked because the switch
  // fell through to default. Setting a proper initial value removes the
  // mismatch while keeping the same observable behavior.
  const [currentView, setCurrentView] = useState<ViewType>('management');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLiveAssistantOpen, setIsLiveAssistantOpen] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; type: string | null; payload: any }>({ isOpen: false, type: null, payload: null });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Each portal's tab list begins with 'dashboard'; that's the default landing
  // sub-view. Portals fall through to their own dashboard in the switch default.
  const [managementSubView, setManagementSubView] = useState<string>('dashboard');
  const [fleetSubView, setFleetSubView] = useState<string>('dashboard');
  const [workshopSubView, setWorkshopSubView] = useState<string>('dashboard');
  const [financeSubView, setFinanceSubView] = useState<string>('dashboard');
  const [operationsSubView, setOperationsSubView] = useState<string>('dashboard');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleViewChange = (view: ViewType) => setCurrentView(view);
  const showModal = (type: string, payload: any = null) => setModal({ isOpen: true, type, payload });
  const hideModal = () => setModal({ isOpen: false, type: null, payload: null });
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  const dismissToast = () => setToastMessage(null);

  const value = useMemo(() => ({
    currentView,
    sidebarOpen,
    activeTab,
    isLiveAssistantOpen,
    modal,
    toastMessage,
    isOnline,
    managementSubView,
    fleetSubView,
    workshopSubView,
    financeSubView,
    operationsSubView,
    handleViewChange,
    setSidebarOpen,
    setActiveTab,
    setIsLiveAssistantOpen,
    showModal,
    hideModal,
    showToast,
    dismissToast,
    handleManagementSubViewChange: setManagementSubView,
    handleFleetSubViewChange: setFleetSubView,
    handleWorkshopSubViewChange: setWorkshopSubView,
    handleFinanceSubViewChange: setFinanceSubView,
    handleOperationsSubViewChange: setOperationsSubView,
  }), [currentView, sidebarOpen, activeTab, isLiveAssistantOpen, modal, toastMessage, isOnline, managementSubView, fleetSubView, workshopSubView, financeSubView, operationsSubView]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUIState = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUIState must be used within a UIProvider');
  return context;
};
