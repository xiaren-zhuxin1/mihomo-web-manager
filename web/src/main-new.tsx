import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RefreshCw } from 'lucide-react';
import './styles.css';

import { AppProvider, useApp } from './contexts';
import { useKeyboard } from './hooks';
import { Sidebar, Topbar, ConfirmDialog } from './components';
import {
  Overview,
  Proxies,
  Connections,
  Subscriptions,
  Maintenance,
  Traffic,
  Logs,
  Topology,
  Rules,
  Providers,
  ConfigEditor,
  RoutingGuide
} from './components/pages';
import { api } from './services/api';
import { readError } from './utils/helpers';
import type { Health } from './types';

function AppContent() {
  const {
    page,
    health,
    setHealth,
    error,
    setError,
    busy,
    theme
  } = useApp();

  useKeyboard();

  const refreshHealth = async () => {
    try {
      const data = await api.get<Health>('/api/health');
      setHealth(data);
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const renderPage = () => {
    switch (page) {
      case 'overview':
        return <Overview health={health} onRefresh={refreshHealth} />;
      case 'proxies':
        return <Proxies />;
      case 'connections':
        return <Connections />;
      case 'subscriptions':
        return <Subscriptions />;
      case 'maintenance':
        return <Maintenance />;
      case 'traffic':
        return <Traffic />;
      case 'logs':
        return <Logs />;
      case 'topology':
        return <Topology />;
      case 'rules':
        return <Rules />;
      case 'providers':
        return <Providers />;
      case 'config':
        return <ConfigEditor />;
      case 'guide':
        return <RoutingGuide />;
      default:
        return <Overview health={health} onRefresh={refreshHealth} />;
    }
  };

  return (
    <div className={`app ${theme}`}>
      <Sidebar />
      
      <main className="main">
        <Topbar />
        
        {(health?.managerTokenActive || error) && (
          <div className="toastStack" role="status" aria-live="polite">
            {health?.managerTokenActive && (
              <div className="notice">
                管理接口已启用鉴权。请通过反向代理或请求头注入 Authorization。
              </div>
            )}
            {error && <div className="notice error">{error}</div>}
          </div>
        )}

        <section className="content">
          {renderPage()}
        </section>
      </main>

      {busy && (
        <div className="busy">
          <RefreshCw size={18} />
        </div>
      )}

      <ConfirmDialog />
      <div className="toastContainer" />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
