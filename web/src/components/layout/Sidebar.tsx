import React from 'react';
import { Shield, Moon, Sun, HelpCircle } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { NAV_GROUPS } from '../../constants/navigation';

export function Sidebar() {
  const { page, setPage, theme, toggleTheme, startOnboarding } = useApp();

  return (
    <aside className="sidebar">
      <div className="brand">
        <Shield size={24} />
        <div>
          <strong>Mihomo Manager</strong>
          <span>Server WebUI</span>
        </div>
      </div>

      <nav>
        {NAV_GROUPS.map(group => (
          <div className="navGroup" key={group.name}>
            <span className="navGroupTitle">{group.name}</span>
            {group.items.map(item => (
              <button
                key={item.id}
                className={page === item.id ? 'active' : ''}
                onClick={() => setPage(item.id)}
                data-onboarding={item.id}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.shortcut && <span className="shortcutHint">{item.shortcut}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebarFooter">
        <button
          className="sidebarAction"
          onClick={startOnboarding}
          title="新手引导"
        >
          <HelpCircle size={16} />
          <span>帮助</span>
        </button>
        <button
          className="sidebarAction"
          onClick={toggleTheme}
          title={`切换到${theme === 'light' ? '暗色' : '亮色'}模式 (Ctrl+D)`}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'light' ? '暗色' : '亮色'}</span>
        </button>
      </div>
    </aside>
  );
}
