import React from 'react';
import { RefreshCw, Moon, Sun, HelpCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { NAV_ITEMS } from '../../constants/navigation';

const FRONTEND_VERSION = 'v1.0.1';

export function Topbar() {
  const { page, health, theme, toggleTheme, showToast, startOnboarding } = useApp();

  const activeTitle = NAV_ITEMS.find(item => item.id === page)?.label || '';
  const activeDescription = NAV_ITEMS.find(item => item.id === page)?.description || '';

  const handleRefresh = () => {
    showToast('success', '状态已刷新');
  };

  return (
    <header className="topbar">
      <div>
        <h1>{activeTitle}</h1>
        <p>{health ? `${health.mihomoController} · ${health.mihomoConfigPath}` : '正在连接管理服务'}</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span className="versionBadge" title={`前端: ${FRONTEND_VERSION} | 后端: ${health?.version || '-'}`}>
          前端: {FRONTEND_VERSION} | 后端: {health?.version || '-'}
        </span>
        <button
          className="iconButton tooltip"
          data-tooltip="新手引导"
          title="新手引导"
          onClick={startOnboarding}
        >
          <HelpCircle size={16} />
        </button>
        <button
          className="themeToggle tooltip"
          data-tooltip="Ctrl+D 切换主题"
          title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
          onClick={toggleTheme}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button
          className="iconButton tooltip"
          data-tooltip="Ctrl+R 刷新"
          title="刷新状态"
          onClick={handleRefresh}
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </header>
  );
}
