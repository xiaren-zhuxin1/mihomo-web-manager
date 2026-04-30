import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Page, AppConfig, Health, ToastType } from '../types';

type AppContextType = {
  page: Page;
  setPage: (page: Page) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  health: Health | null;
  setHealth: (health: Health | null) => void;
  error: string;
  setError: (error: string) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  config: AppConfig;
  onboardingStep: number;
  setOnboardingStep: (step: number) => void;
  showOnboarding: boolean;
  startOnboarding: () => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  showToast: (type: ToastType, message: string, duration?: number) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, variant?: 'default' | 'danger' | 'warning', confirmText?: string) => void;
  dialog: DialogState;
  closeDialog: () => void;
};

type DialogState = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  variant?: 'default' | 'danger' | 'warning';
  onConfirm?: () => void;
};

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_CONFIG: AppConfig = {
  theme: 'light',
  onboardingCompleted: false,
  sidebarCollapsed: false
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('overview');
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<AppConfig>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('appConfig');
      if (stored) {
        try {
          return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        } catch {
          return DEFAULT_CONFIG;
        }
      }
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return { ...DEFAULT_CONFIG, theme: prefersDark ? 'dark' : 'light' };
    }
    return DEFAULT_CONFIG;
  });
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('appConfig');
      if (stored) {
        try {
          const cfg = JSON.parse(stored);
          return !cfg.onboardingCompleted;
        } catch {
          return true;
        }
      }
      return true;
    }
    return false;
  });
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    title: '',
    message: ''
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme);
    localStorage.setItem('appConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (config.lastPage) {
      setPage(config.lastPage);
    }
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark') => {
    setConfig(prev => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setConfig(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  }, []);

  const handleSetPage = useCallback((newPage: Page) => {
    setPage(newPage);
    setConfig(prev => ({ ...prev, lastPage: newPage }));
  }, []);

  const startOnboarding = useCallback(() => {
    setOnboardingStep(0);
    setShowOnboarding(true);
  }, []);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setConfig(prev => ({ ...prev, onboardingCompleted: true }));
  }, []);

  const skipOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setConfig(prev => ({ ...prev, onboardingCompleted: true }));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const container = document.querySelector('.toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toastMessage">${message}</span>
      <button class="toastClose" onclick="this.parentElement.remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </button>
    `;
    container.appendChild(toast);
    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    variant: 'default' | 'danger' | 'warning' = 'default',
    confirmText = '确认'
  ) => {
    setDialog({ open: true, title, message, confirmText, variant, onConfirm });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(prev => ({ ...prev, open: false }));
  }, []);

  const value: AppContextType = {
    page,
    setPage: handleSetPage,
    theme: config.theme,
    setTheme,
    toggleTheme,
    health,
    setHealth,
    error,
    setError,
    busy,
    setBusy,
    config,
    onboardingStep,
    setOnboardingStep,
    showOnboarding,
    startOnboarding,
    completeOnboarding,
    skipOnboarding,
    showToast,
    showConfirm,
    dialog,
    closeDialog
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useApp();
  return { theme, setTheme, toggleTheme };
}

export function useNavigation() {
  const { page, setPage } = useApp();
  return { page, setPage };
}

export function useOnboarding() {
  const { showOnboarding, onboardingStep, setOnboardingStep, startOnboarding, completeOnboarding, skipOnboarding } = useApp();
  return { showOnboarding, onboardingStep, setOnboardingStep, startOnboarding, completeOnboarding, skipOnboarding };
}
