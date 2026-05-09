import React, { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  Cable,
  FileCode2,
  Gauge,
  LayoutGrid,
  List,
  ListTree,
  RefreshCw,
  Settings2,
  Shield,
  Terminal,
  Zap
} from 'lucide-react';
import { initSetPage } from './components/ui';
import { api } from './services/api';
import { readError } from './utils/helpers';
import type { Health, Page } from './types';
import {
  Overview,
  Proxies,
  Traffic,
  Connections,
  Logs,
  Subscriptions,
  Providers,
  Rules,
  Topology,
  RoutingGuide,
  Maintenance,
  ConfigEditor,
  ProxyGroupEditor
} from './components/pages';

const FRONTEND_VERSION = 'v1.0.29';

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  initSetPage(setPage);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshHealth = async () => {
    try {
      setHealth(await api<Health>('/api/health'));
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const nav = [
    ['overview', Gauge, '总览', '运行监控'],
    ['traffic', Activity, '流量监控', '运行监控'],
    ['connections', List, '连接追踪', '运行监控'],
    ['logs', Terminal, '实时日志', '运行监控'],
    ['guide', BookOpen, '路由向导', '代理路由'],
    ['proxies', Zap, '代理策略', '代理路由'],
    ['groups', LayoutGrid, '策略组管理', '代理路由'],
    ['topology', ListTree, '路由拓扑', '代理路由'],
    ['rules', Shield, '规则命中', '代理路由'],
    ['subscriptions', Cable, '订阅管理', '配置维护'],
    ['providers', ListTree, '节点资源', '配置维护'],
    ['maintenance', Settings2, '配置维护', '配置维护'],
    ['config', FileCode2, '系统配置', '系统管理']
  ] as const;

  const activeTitle = nav.find(([id]) => id === page)?.[2] || '';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Shield size={24} />
          <div>
            <strong>Mihomo Manager</strong>
            <span>Server WebUI</span>
          </div>
        </div>
        <nav>
          {['运行监控', '代理路由', '配置维护', '系统管理'].map((group) => (
            <div className="navGroup" key={group}>
              <span className="navGroupTitle">{group}</span>
              {nav.filter(([, , , navGroup]) => navGroup === group).map(([id, Icon, label]) => (
                <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activeTitle}</h1>
            <p>{health ? `${health.mihomoController} · ${health.mihomoConfigPath}` : '正在连接管理服务'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="versionBadge" title={`前端: ${FRONTEND_VERSION} | 后端: ${health?.version || '-'}`}>
              前端: {FRONTEND_VERSION} | 后端: {health?.version || '-'}
            </span>
            <button className="iconButton" title="刷新状态" onClick={refreshHealth}>
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {(health?.managerTokenActive || error) && (
          <div className="toastStack" role="status" aria-live="polite">
            {health?.managerTokenActive && <div className="notice">管理接口已启用鉴权。请通过反向代理或请求头注入 Authorization。</div>}
            {error && <div className="notice error">{error}</div>}
          </div>
        )}

        <section className="content">
          {page === 'overview' && <Overview health={health} onRefresh={refreshHealth} />}
          {page === 'guide' && <RoutingGuide setPage={setPage} />}
          {page === 'topology' && <Topology setBusy={setBusy} />}
          {page === 'maintenance' && <Maintenance setBusy={setBusy} />}
          {page === 'traffic' && <Traffic setBusy={setBusy} />}
          {page === 'proxies' && <Proxies setBusy={setBusy} />}
          {page === 'groups' && <ProxyGroupEditor setBusy={setBusy} />}
          {page === 'connections' && <Connections setBusy={setBusy} />}
          {page === 'logs' && <Logs />}
          {page === 'subscriptions' && <Subscriptions setBusy={setBusy} />}
          {page === 'providers' && <Providers setBusy={setBusy} />}
          {page === 'rules' && <Rules setBusy={setBusy} />}
          {page === 'config' && <ConfigEditor setBusy={setBusy} health={health} />}
        </section>
      </main>

      {busy && (
        <div className="busy">
          <RefreshCw size={18} />
        </div>
      )}
    </div>
  );
}
