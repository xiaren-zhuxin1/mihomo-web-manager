import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  Cable,
  Check,
  DatabaseBackup,
  FileCode2,
  Gauge,
  Globe2,
  ListTree,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Shield,
  Square,
  Terminal,
  Trash2,
  Zap
} from 'lucide-react';
import './styles.css';

type Page = 'overview' | 'proxies' | 'subscriptions' | 'providers' | 'rules' | 'config' | 'service';

type Health = {
  ok: boolean;
  mihomoController: string;
  mihomoConfigPath: string;
  managerTokenActive: boolean;
  serviceMode?: string;
  os: string;
};

type ProxyGroup = {
  name: string;
  type: string;
  now?: string;
  all?: string[];
  hidden?: boolean;
  udp?: boolean;
  alive?: boolean;
  extra?: Record<string, unknown>;
  history?: Array<{ time: string; delay: number }>;
};

type ProxyNode = ProxyGroup & {
  providerName?: string;
};

type Provider = {
  name: string;
  type?: string;
  vehicleType?: string;
  updatedAt?: string;
  proxies?: Array<{ name: string }>;
};

type RuleProvider = {
  name: string;
  behavior?: string;
  vehicleType?: string;
  ruleCount?: number;
  updatedAt?: string;
};

type Subscription = {
  id: string;
  name: string;
  url: string;
  providerName: string;
  enabled: boolean;
  managed: boolean;
  type?: string;
  path?: string;
  exists: boolean;
  updatedAt?: string;
  upload?: number;
  download?: number;
  total?: number;
  expire?: number;
  error?: string;
};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const text = await res.text();
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
};

function App() {
  const [page, setPage] = useState<Page>('overview');
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
    ['overview', Gauge, '概览'],
    ['proxies', Zap, '代理'],
    ['subscriptions', Cable, '订阅'],
    ['providers', ListTree, 'Providers'],
    ['rules', Globe2, '规则'],
    ['config', FileCode2, '配置'],
    ['service', Server, '服务']
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
          {nav.map(([id, Icon, label]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activeTitle}</h1>
            <p>{health ? `${health.mihomoController} · ${health.mihomoConfigPath}` : '正在连接管理服务'}</p>
          </div>
          <button className="iconButton" title="刷新状态" onClick={refreshHealth}>
            <RefreshCw size={16} />
          </button>
        </header>

        {health?.managerTokenActive && <div className="notice">管理接口已启用鉴权。请通过反向代理或请求头注入 Authorization。</div>}
        {error && <div className="notice">{error}</div>}

        <section className="content">
          {page === 'overview' && <Overview health={health} onRefresh={refreshHealth} />}
          {page === 'proxies' && <Proxies setBusy={setBusy} />}
          {page === 'subscriptions' && <Subscriptions setBusy={setBusy} />}
          {page === 'providers' && <Providers setBusy={setBusy} />}
          {page === 'rules' && <Rules setBusy={setBusy} />}
          {page === 'config' && <ConfigEditor setBusy={setBusy} />}
          {page === 'service' && <Service setBusy={setBusy} health={health} />}
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

function Overview({ health, onRefresh }: { health: Health | null; onRefresh: () => void }) {
  return (
    <div className="stack">
      <div className="grid">
        <Panel title="控制器" icon={<Activity size={18} />}>
          <Metric label="状态" value={health?.ok ? 'Online' : 'Unknown'} />
          <Metric label="地址" value={health?.mihomoController || '-'} />
        </Panel>
        <Panel title="配置文件" icon={<FileCode2 size={18} />}>
          <Metric label="路径" value={health?.mihomoConfigPath || '-'} />
          <Metric label="系统" value={health?.os || '-'} />
        </Panel>
        <Panel title="服务模式" icon={<Server size={18} />}>
          <Metric label="模式" value={health?.serviceMode || '-'} />
          <Metric label="令牌保护" value={health?.managerTokenActive ? 'Enabled' : 'Disabled'} />
        </Panel>
      </div>
      <Panel title="控制台分区" icon={<ListTree size={18} />}>
        <div className="sectionGrid">
          <SectionNote title="代理" body="策略组、节点选择、运行态切换，参考 MetaCubeXD / Zashboard 的 dashboard 视角。" />
          <SectionNote title="订阅" body="新增订阅、Manager 接管订阅、配置残留诊断，参考 Clash Verge 的 profile 管理视角。" />
          <SectionNote title="Providers / 规则" body="展示 mihomo 当前实际加载的 proxy-provider 与 rule-provider。" />
          <SectionNote title="配置 / 服务" body="服务器本机配置文件、备份、reload、Docker 或 systemd 生命周期控制。" />
        </div>
        <button className="primary" onClick={onRefresh}>
          <RefreshCw size={16} />
          刷新状态
        </button>
      </Panel>
    </div>
  );
}

function Proxies({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [groups, setGroups] = useState<ProxyGroup[]>([]);
  const [proxyMap, setProxyMap] = useState<Record<string, ProxyNode>>({});
  const [selectedGroup, setSelectedGroup] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'delay'>('delay');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies');
      const next = Object.values(data.proxies).filter((proxy) => Array.isArray(proxy.all) && proxy.all.length > 0);
      setProxyMap(data.proxies || {});
      setGroups(next);
      setSelectedGroup((current) => current || next[0]?.name || '');
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const group = groups.find((item) => item.name === selectedGroup);
  const selectableGroup = group ? ['Selector', 'Compatible'].includes(group.type) : false;
  const nodes = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const list = (group?.all || [])
      .map((name) => proxyMap[name] || ({ name, type: 'Unknown' } as ProxyNode))
      .filter((node) => !query || node.name.toLowerCase().includes(query) || (node.type || '').toLowerCase().includes(query));
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      return latestDelay(a) - latestDelay(b);
    });
  }, [filter, group, proxyMap, sort]);

  const selectProxy = async (proxyName: string) => {
    if (!group) return;
    setBusy(true);
    try {
      await api(`/api/mihomo/proxies/${encodeURIComponent(group.name)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: proxyName })
      });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const testProxy = async (proxyName: string) => {
    setBusy(true);
    try {
      const data = await api<{ delay?: number }>(
        `/api/mihomo/proxies/${encodeURIComponent(proxyName)}/delay?timeout=5000&url=${encodeURIComponent('https://www.gstatic.com/generate_204')}`
      );
      const delay = typeof data.delay === 'number' ? data.delay : 0;
      setProxyMap((current) => ({
        ...current,
        [proxyName]: {
          ...(current[proxyName] || ({ name: proxyName, type: 'Unknown' } as ProxyNode)),
          alive: delay > 0,
          history: [
            ...((current[proxyName]?.history || []).slice(-4)),
            { time: new Date().toISOString(), delay }
          ]
        }
      }));
    } catch (err) {
      setError(readError(err));
      setProxyMap((current) => ({
        ...current,
        [proxyName]: {
          ...(current[proxyName] || ({ name: proxyName, type: 'Unknown' } as ProxyNode)),
          alive: false,
          history: [
            ...((current[proxyName]?.history || []).slice(-4)),
            { time: new Date().toISOString(), delay: 0 }
          ]
        }
      }));
    } finally {
      setBusy(false);
    }
  };

  const testGroup = async () => {
    if (!group) return;
    setBusy(true);
    try {
      await api(`/api/mihomo/group/${encodeURIComponent(group.name)}/delay?timeout=5000&url=${encodeURIComponent('https://www.gstatic.com/generate_204')}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split">
      <Panel title={`策略组 (${groups.length})`} icon={<Zap size={18} />}>
        <div className="list">
          {groups.map((item) => (
            <button key={item.name} className={item.name === selectedGroup ? 'row active' : 'row'} onClick={() => setSelectedGroup(item.name)}>
              <span>{item.name}</span>
              <small>{item.now || item.type}</small>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title={group ? `${group.name} · ${group.type} · ${group.all?.length || 0} 节点` : '节点'} icon={<Activity size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        {group && !selectableGroup && <p className="inlineHint">当前策略组类型为 {group.type}，通常由内核自动选择，不支持手动选用节点。</p>}
        <div className="toolbar">
          <input className="searchInput" placeholder="筛选节点或类型" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <button className={sort === 'delay' ? 'activeMode' : ''} onClick={() => setSort('delay')}>延迟</button>
          <button className={sort === 'name' ? 'activeMode' : ''} onClick={() => setSort('name')}>名称</button>
          <button onClick={testGroup}>
            <Gauge size={16} />
            全组测速
          </button>
          <button className="iconButton" title="刷新" onClick={load}>
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="nodeCardGrid">
          {nodes.map((node) => (
            <div key={node.name} className={group?.now === node.name ? 'nodeCard selected' : 'nodeCard'}>
              <button className="nodeMain" onClick={() => selectableGroup && selectProxy(node.name)} disabled={!selectableGroup}>
                <span>{node.name}</span>
                {group?.now === node.name && <Check size={16} />}
              </button>
              <div className="badgeRow">
                <span className="badge">{node.type || 'Unknown'}</span>
                {node.udp && <span className="badge">UDP</span>}
                {node.providerName && <span className="badge">{node.providerName}</span>}
                <span className={`delay ${delayClass(node)}`}>{formatDelay(node)}</span>
              </div>
              <div className="nodeActions">
                <button
                  className="selectButton"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectProxy(node.name);
                  }}
                  disabled={!selectableGroup || group?.now === node.name}
                >
                  {group?.now === node.name ? '当前' : '选用'}
                </button>
                <button
                  className="testButton"
                  onClick={(event) => {
                    event.stopPropagation();
                    testProxy(node.name);
                  }}
                >
                  <Gauge size={15} />
                  测速
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Subscriptions({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newURL, setNewURL] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const managed = useMemo(() => subscriptions.filter((item) => item.managed), [subscriptions]);
  const configProviders = useMemo(() => subscriptions.filter((item) => !item.managed), [subscriptions]);
  const broken = useMemo(() => subscriptions.filter((item) => !item.exists || item.error), [subscriptions]);

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ subscriptions: Subscription[] }>('/api/subscriptions');
      setSubscriptions(data.subscriptions || []);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createSubscription = async () => {
    setBusy(true);
    try {
      await api('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ name: newName, url: newURL })
      });
      setNewName('');
      setNewURL('');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateSubscription = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/subscriptions/${id}/update`, { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteSubscription = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/subscriptions/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {error && <p className="inlineError">{error}</p>}
      <Panel title="新增订阅" icon={<Plus size={18} />}>
        <div className="subscriptionAdd">
          <input placeholder="订阅名称" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <input placeholder="订阅链接" value={newURL} onChange={(event) => setNewURL(event.target.value)} />
          <button className="primary" onClick={createSubscription} disabled={!newURL.trim()}>
            <Plus size={16} />
            新建
          </button>
        </div>
      </Panel>

      <div className="grid">
        <Panel title="Manager 接管订阅" icon={<Cable size={18} />}>
          <SubscriptionGrid items={managed} empty="还没有由 Manager 接管的订阅" onUpdate={updateSubscription} onDelete={deleteSubscription} />
        </Panel>
        <Panel title="配置引用 Provider" icon={<ListTree size={18} />}>
          <SubscriptionGrid items={configProviders} empty="配置里没有额外 proxy-provider" onUpdate={updateSubscription} onDelete={deleteSubscription} />
        </Panel>
      </div>

      {broken.length > 0 && (
        <Panel title="诊断" icon={<AlertTriangle size={18} />}>
          <div className="diagnosticList">
            {broken.map((item) => (
              <div className="diagnostic" key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.error || `provider 文件不存在：${item.path || item.providerName}`}</span>
                {!item.managed && !item.exists && (
                  <button className="danger compactButton" onClick={() => deleteSubscription(item.id)}>
                    <Trash2 size={16} />
                    从配置移除引用
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function SubscriptionGrid({
  items,
  empty,
  onUpdate,
  onDelete
}: {
  items: Subscription[];
  empty: string;
  onUpdate: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="subscriptionGrid">
      {items.map((item) => (
        <div className={item.exists ? 'subscriptionCard' : 'subscriptionCard warning'} key={item.id}>
          <div className="subHead">
            <div>
              <strong>{item.name}</strong>
              <span>{item.managed ? 'Manager' : 'Config'} · {item.type || 'provider'} · {item.providerName}</span>
            </div>
            <div className="subActions">
              <button className="iconButton" title="刷新订阅" onClick={() => onUpdate(item.id)} disabled={!item.exists}>
                <RefreshCw size={16} />
              </button>
              {onDelete && item.managed && (
                <button className="iconButton" title="删除订阅" onClick={() => onDelete(item.id)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
          <p className="subUrl">{item.url || item.path || 'mihomo provider'}</p>
          {!item.exists && <p className="inlineError">配置引用的 provider 文件不存在，无法刷新。</p>}
          <div className="usageBar">
            <span style={{ width: `${usagePercent(item)}%` }} />
          </div>
          <div className="subMeta">
            <span>{formatUsage(item)}</span>
            <span>{validDate(item.updatedAt) ? formatDate(item.updatedAt!) : '未刷新'}</span>
          </div>
          {item.expire ? <div className="subMeta"><span>到期：{formatExpire(item.expire)}</span></div> : null}
          {item.error ? <p className="inlineError">{item.error}</p> : null}
        </div>
      ))}
      {items.length === 0 && <p className="empty">{empty}</p>}
    </div>
  );
}

function Providers({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ providers: Record<string, Provider> }>('/api/mihomo/providers/proxies');
      setProviders(Object.entries(data.providers || {}).map(([name, value]) => ({ ...value, name })));
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateProvider = async (name: string) => {
    setBusy(true);
    try {
      await api(`/api/mihomo/providers/proxies/${encodeURIComponent(name)}`, { method: 'PUT', body: '{}' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={`Proxy Providers (${providers.length})`} icon={<ListTree size={18} />}>
      {error && <p className="inlineError">{error}</p>}
      <ProviderCards items={providers} onUpdate={updateProvider} />
    </Panel>
  );
}

function Rules({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [rules, setRules] = useState<RuleProvider[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ providers: Record<string, RuleProvider> }>('/api/mihomo/providers/rules');
      setRules(Object.entries(data.providers || {}).map(([name, value]) => ({ ...value, name })));
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateRule = async (name: string) => {
    setBusy(true);
    try {
      await api(`/api/mihomo/providers/rules/${encodeURIComponent(name)}`, { method: 'PUT', body: '{}' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={`Rule Providers (${rules.length})`} icon={<Globe2 size={18} />}>
      {error && <p className="inlineError">{error}</p>}
      <div className="table">
        {rules.map((item) => (
          <div className="tableRow" key={item.name}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.behavior || item.vehicleType || 'rule-provider'} · {item.ruleCount || 0} rules</span>
            </div>
            <button className="iconButton" title="更新规则集" onClick={() => updateRule(item.name)}>
              <RefreshCw size={16} />
            </button>
          </div>
        ))}
        {rules.length === 0 && <p className="empty">没有读取到 rule-provider</p>}
      </div>
    </Panel>
  );
}

function ProviderCards({ items, onUpdate }: { items: Provider[]; onUpdate: (name: string) => void }) {
  return (
    <div className="providerGrid">
      {items.map((item) => (
        <div className="providerCard" key={item.name}>
          <div>
            <strong>{item.name}</strong>
            <span>{item.type || item.vehicleType || 'provider'}</span>
          </div>
          <Metric label="节点数" value={String(item.proxies?.length || 0)} />
          <button className="iconButton" title="更新 provider" onClick={() => onUpdate(item.name)}>
            <RefreshCw size={16} />
          </button>
        </div>
      ))}
      {items.length === 0 && <p className="empty">没有读取到 proxy-provider</p>}
    </div>
  );
}

function ConfigEditor({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(true);

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ content: string }>('/api/config');
      setContent(data.content);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/config', { method: 'PUT', body: JSON.stringify({ content, reload }) });
      setMessage('已保存');
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    setBusy(true);
    try {
      const data = await api<{ path: string }>('/api/config/backup', { method: 'POST', body: '{}' });
      setMessage(`备份完成：${data.path}`);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="配置编辑" icon={<FileCode2 size={18} />}>
      <div className="toolbar">
        <label className="check">
          <input type="checkbox" checked={reload} onChange={(event) => setReload(event.target.checked)} />
          保存后 reload
        </label>
        <button className="iconButton" title="备份" onClick={backup}>
          <DatabaseBackup size={16} />
        </button>
        <button className="iconButton" title="刷新" onClick={load}>
          <RefreshCw size={16} />
        </button>
        <button className="primary" onClick={save}>
          <Save size={16} />
          保存
        </button>
      </div>
      {message && <p className="message">{message}</p>}
      {error && <p className="inlineError">{error}</p>}
      <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />
    </Panel>
  );
}

function Service({ setBusy, health }: { setBusy: (busy: boolean) => void; health: Health | null }) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const call = async (action?: string) => {
    setBusy(true);
    try {
      if (action) {
        await api(`/api/service/${action}`, { method: 'POST', body: '{}' });
      }
      const data = await api<{ active: boolean; output: string; error: string }>('/api/service/status');
      setStatus(`${data.active ? 'active' : 'inactive'} ${data.output || ''} ${data.error || ''}`.trim());
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    call();
  }, []);

  return (
    <Panel title={health?.serviceMode === 'docker' ? 'mihomo container' : 'mihomo.service'} icon={<Terminal size={18} />}>
      {error && <p className="inlineError">{error}</p>}
      <Metric label="状态" value={status || '-'} />
      <div className="toolbar">
        <button className="primary" onClick={() => call('start')}>
          <Play size={16} />
          启动
        </button>
        <button className="danger" onClick={() => call('stop')}>
          <Square size={16} />
          停止
        </button>
        <button onClick={() => call('restart')}>
          <RotateCcw size={16} />
          重启
        </button>
        <button onClick={() => call('reload')}>
          <RefreshCw size={16} />
          Reload
        </button>
      </div>
    </Panel>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="panel">
      <div className="panelTitle">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="sectionNote">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function readError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  if (text.includes('unauthorized') || text.includes('401')) {
    return '未授权：当前 WebUI 不再内置 token 输入框，请关闭 MWM_TOKEN，或通过反向代理注入 Authorization。';
  }
  return text;
}

function usagePercent(item: Subscription) {
  if (!item.total) return 0;
  return Math.min(100, Math.round((((item.upload || 0) + (item.download || 0)) / item.total) * 100));
}

function formatUsage(item: Subscription) {
  const used = (item.upload || 0) + (item.download || 0);
  if (!item.total) return '无流量信息';
  return `${formatBytes(used)} / ${formatBytes(item.total)}`;
}

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function validDate(value?: string) {
  if (!value || value.startsWith('0001-')) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatExpire(value: number) {
  return new Date(value * 1000).toLocaleDateString();
}

function latestDelay(node: ProxyNode) {
  const history = node.history || [];
  const latest = history[history.length - 1];
  if (!latest || latest.delay <= 0) return Number.MAX_SAFE_INTEGER;
  return latest.delay;
}

function formatDelay(node: ProxyNode) {
  if (node.alive === false) return 'Error';
  const delay = latestDelay(node);
  if (delay === Number.MAX_SAFE_INTEGER) return '- ms';
  return `${delay} ms`;
}

function delayClass(node: ProxyNode) {
  if (node.alive === false) return 'error';
  const delay = latestDelay(node);
  if (delay === Number.MAX_SAFE_INTEGER) return 'unknown';
  if (delay <= 200) return 'fast';
  if (delay <= 500) return 'good';
  if (delay <= 1000) return 'slow';
  return 'bad';
}

createRoot(document.getElementById('root')!).render(<App />);
