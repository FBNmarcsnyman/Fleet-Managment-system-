
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
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLiveAssistantOpen, setIsLiveAssistantOpen] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; type: string | null; payload: any }>({ isOpen: false, type: null, payload: null });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

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
    handleViewChange,
    setSidebarOpen,
    setActiveTab,
    setIsLiveAssistantOpen,
    showModal,
    hideModal,
    showToast,
    dismissToast,
  }), [currentView, sidebarOpen, activeTab, isLiveAssistantOpen, modal, toastMessage, isOnline]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUIState = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUIState must be used within a UIProvider');
  return context;
};
