import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

<<<<<<< HEAD
type Page = 'overview' | 'guide' | 'topology' | 'maintenance' | 'traffic' | 'proxies' | 'connections' | 'logs' | 'subscriptions' | 'providers' | 'rules' | 'config';

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
  region?: string;
};

type ProxyNode = ProxyGroup & {
  providerName?: string;
  'provider-name'?: string;
};

type Provider = {
  name: string;
  type?: string;
  vehicleType?: string;
  testUrl?: string;
  expectedStatus?: string;
  updatedAt?: string;
  proxies?: ProxyNode[];
};

type RuleProvider = {
  name: string;
  behavior?: string;
  vehicleType?: string;
  ruleCount?: number;
  updatedAt?: string;
};

type RuntimeConfig = {
  mode?: string;
  'log-level'?: string;
  'allow-lan'?: boolean;
  ipv6?: boolean;
  tun?: {
    enable?: boolean;
    stack?: string;
    device?: string;
  };
  'mixed-port'?: number;
  'socks-port'?: number;
  port?: number;
};

type TunDiagnostics = {
  config: {
    enable?: boolean;
    stack?: string;
    device?: string;
    dnsHijack?: string[];
    autoRoute?: boolean;
    autoDetectInterface?: boolean;
  };
  runtime: {
    enable?: boolean;
    stack?: string;
    device?: string;
  };
  runtimeAvailable?: boolean;
  serviceMode: string;
  hostTunExists: boolean;
  dockerDeviceMapped: boolean;
  dockerNetAdmin: boolean;
  dockerPrivileged: boolean;
  ready: boolean;
  notes: string[];
};

type TunForm = {
  stack: string;
  device: string;
  dnsHijack: string;
  autoRoute: boolean;
  autoDetectInterface: boolean;
};

type MihomoVersion = {
  version?: string;
  meta?: boolean;
};

type RuntimeRule = {
  index: number;
  type: string;
  payload: string;
  proxy: string;
  size?: number;
  extra?: {
    disabled?: boolean;
    hitCount?: number;
    hitAt?: string;
    missCount?: number;
    missAt?: string;
  };
};

type Connection = {
  id: string;
  upload?: number;
  download?: number;
  start?: string;
  chains?: string[];
  rule?: string;
  rulePayload?: string;
  metadata?: {
    host?: string;
    destinationIP?: string;
    destinationPort?: string | number;
    network?: string;
    type?: string;
    process?: string;
  };
};

type ConnectionsResponse = {
  connections: Connection[];
  uploadTotal?: number;
  downloadTotal?: number;
};

type TrafficPoint = {
  time: string;
  up: number;
  down: number;
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
  nodeCount?: number;
  lastStatus?: string;
};

type ConfigBackup = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
};

type ConfigProxyGroup = {
  name: string;
  type: string;
  proxies: string[];
  use: string[];
  url?: string;
  interval?: string;
  filter?: string;
};

type ConfigRuleProvider = {
  name: string;
  type: string;
  behavior: string;
  url?: string;
  path?: string;
  interval?: string;
};

type ConfigModel = {
  proxyGroups: ConfigProxyGroup[];
  proxyProviders: string[];
  rules: string[];
  ruleProviders: ConfigRuleProvider[];
};

type ConfigValidationIssue = {
  level: 'error' | 'warning';
  scope: string;
  name: string;
  message: string;
};

type ConfigValidation = {
  ok: boolean;
  issues: ConfigValidationIssue[];
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
    throw new Error(parseErrorText(text) || res.statusText);
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

function parseErrorText(text: string) {
  if (!text.trim()) return '';
  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error || data.message || text;
  } catch {
    return text;
  }
}

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
    ['overview', Gauge, '总览', '运行监控'],
    ['traffic', Activity, '流量监控', '运行监控'],
    ['connections', List, '连接追踪', '运行监控'],
    ['logs', Terminal, '实时日志', '运行监控'],
    ['guide', BookOpen, '路由向导', '代理路由'],
    ['proxies', Zap, '代理策略', '代理路由'],
    ['topology', ListTree, '路由拓扑', '代理路由'],
    ['rules', Globe2, '规则命中', '代理路由'],
    ['subscriptions', Cable, '订阅管理', '配置维护'],
    ['providers', ListTree, '节点 Provider', '配置维护'],
    ['maintenance', Settings2, '配置维护', '配置维护'],
    ['config', FileCode2, '系统配置', '系统管理']
  ] as const;

  const activeTitle = nav.find(([id]) => id === page)?.[2] || '';
  const activeGroup = nav.find(([id]) => id === page)?.[3] || '';

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
          <button className="iconButton" title="刷新状态" onClick={refreshHealth}>
            <RefreshCw size={16} />
          </button>
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

function RoutingGuide({ setPage }: { setPage: (page: Page) => void }) {
  return (
    <div className="stack">
      <section className="guideHero">
        <div>
          <span>新手路线</span>
          <h2>先理解一条连接怎么被 mihomo 处理</h2>
          <p>不用先背 YAML。你只要记住：规则决定去哪里，策略组决定怎么选节点，Provider 负责提供节点或规则集。</p>
        </div>
        <button className="primary" onClick={() => setPage('maintenance')}>
          <Settings2 size={16} />
          打开配置维护
        </button>
      </section>

      <div className="routeFlow">
        <div>
          <strong>1. 连接进来</strong>
          <span>浏览器、系统或 TUN 把请求交给 mihomo。</span>
        </div>
        <div>
          <strong>2. 从上到下匹配规则</strong>
          <span>例如 DOMAIN-SUFFIX,google.com,PROXY 命中后就去 PROXY。</span>
        </div>
        <div>
          <strong>3. 进入策略组</strong>
          <span>PROXY 可以手选节点，也可以引用订阅 Provider 自动拿节点。</span>
        </div>
        <div>
          <strong>4. 最终落到节点</strong>
          <span>连接真正从某个 Trojan、Vmess、Hysteria 等节点出去。</span>
        </div>
      </div>

      <div className="guideGrid">
        <Panel title="我应该先配什么？" icon={<BookOpen size={18} />}>
          <div className="guideSteps">
            <div>
              <strong>第一步：订阅管理</strong>
              <p>把订阅接进来，它会生成 proxy-provider。Provider 是“节点仓库”，不是实际分流规则。</p>
              <button onClick={() => setPage('subscriptions')}>去订阅管理</button>
            </div>
            <div>
              <strong>第二步：策略组</strong>
              <p>创建或编辑 PROXY / AUTO / AI 这类策略组，把 provider 或固定节点放进去。规则只需要指向策略组。</p>
              <button onClick={() => setPage('maintenance')}>编辑策略组</button>
            </div>
            <div>
              <strong>第三步：规则</strong>
              <p>规则的目标写 PROXY、DIRECT、REJECT 或你建的策略组。越具体的规则放越前，MATCH 放最后兜底。</p>
              <button onClick={() => setPage('maintenance')}>编辑规则</button>
            </div>
          </div>
        </Panel>

        <Panel title="常见配置怎么理解？" icon={<ListTree size={18} />}>
          <div className="conceptList">
            <div>
              <strong>proxy-provider</strong>
              <span>远程订阅或本地节点文件。它只提供节点，不决定流量走向。</span>
            </div>
            <div>
              <strong>proxy-groups</strong>
              <span>策略组。规则命中后会进入这里，再由手选、测速、fallback 等方式决定具体节点。</span>
            </div>
            <div>
              <strong>rules</strong>
              <span>分流规则。从上到下匹配，命中第一条就停止。目标通常是策略组。</span>
            </div>
            <div>
              <strong>rule-provider</strong>
              <span>规则集仓库。配合 RULE-SET 使用，适合大量域名/IP 规则。</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="直接照着做的例子" icon={<Globe2 size={18} />}>
        <div className="recipeGrid">
          <div>
            <strong>让 Google 走代理</strong>
            <code>DOMAIN-SUFFIX,google.com,PROXY</code>
            <span>目标 PROXY 是策略组，不一定是单个节点。</span>
          </div>
          <div>
            <strong>让国内 IP 直连</strong>
            <code>GEOIP,CN,DIRECT</code>
            <span>DIRECT 是内置目标，表示不经过代理。</span>
          </div>
          <div>
            <strong>兜底走代理</strong>
            <code>MATCH,PROXY</code>
            <span>放在最后，没命中的连接全部交给 PROXY。</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Overview({ health, onRefresh }: { health: Health | null; onRefresh: () => void }) {
  const [currentProxy, setCurrentProxy] = useState<{
    group: string;
    node: string;
    type: string;
    provider: string;
    delay: string;
    delayClass: string;
    healthy: string;
  } | null>(null);
  const [error, setError] = useState('');

  const loadCurrentProxy = async () => {
    try {
      const data = await api<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies');
      const groups = Object.values(data.proxies || {}).filter((proxy) => Array.isArray(proxy.all) && proxy.all.length > 0);
      const group =
        groups.find((item) => item.name === 'PROXY') ||
        groups.find((item) => item.name === 'GLOBAL') ||
        groups.find((item) => ['Selector', 'Compatible'].includes(item.type)) ||
        groups[0];
      if (!group) {
        setCurrentProxy(null);
        return;
      }
      const node = resolveConcreteNode(data.proxies || {}, group.now || group.name);
      const nodeInfo = data.proxies[node];
      setCurrentProxy({
        group: group.name,
        node,
        type: nodeInfo?.type || group.type || '-',
        provider: nodeInfo?.providerName || nodeInfo?.['provider-name'] || '-',
        delay: nodeInfo ? formatDelay(nodeInfo) : '- ms',
        delayClass: nodeInfo ? delayClass(nodeInfo) : 'unknown',
        healthy: nodeInfo?.alive === false ? '异常' : nodeInfo?.alive === true ? '正常' : '未知'
      });
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    loadCurrentProxy();
  }, []);

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
      <Panel title="当前节点" icon={<Zap size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        <div className="currentProxyBox">
          <div>
            <span>策略组</span>
            <strong>{currentProxy?.group || '-'}</strong>
          </div>
          <div>
            <span>节点</span>
            <strong>{currentProxy?.node || '-'}</strong>
          </div>
          <div>
            <span>类型</span>
            <strong>{currentProxy?.type || '-'}</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>{currentProxy?.provider || '-'}</strong>
          </div>
          <div>
            <span>健康</span>
            <strong>{currentProxy?.healthy || '-'}</strong>
          </div>
          <div>
            <span>延迟</span>
            <strong className={`delay inlineDelay ${currentProxy?.delayClass || 'unknown'}`}>{currentProxy?.delay || '- ms'}</strong>
          </div>
          <button onClick={loadCurrentProxy}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
      </Panel>
      <RuntimeControls />
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

function RuntimeControls() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [version, setVersion] = useState<MihomoVersion | null>(null);
  const [tunDiagnostics, setTunDiagnostics] = useState<TunDiagnostics | null>(null);
  const [tunForm, setTunForm] = useState<TunForm>(defaultTunForm());
  const tunFormDirtyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [nextConfig, nextVersion, nextTunDiagnostics] = await Promise.all([
        api<RuntimeConfig>('/api/mihomo/configs'),
        api<MihomoVersion>('/api/mihomo/version'),
        api<TunDiagnostics>('/api/config/tun')
      ]);
      setConfig(nextConfig);
      setVersion(nextVersion);
      setTunDiagnostics(nextTunDiagnostics);
      if (!tunFormDirtyRef.current) {
        setTunForm(tunFormFromDiagnostics(nextTunDiagnostics, nextConfig));
      }
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const patchConfig = async (patch: Partial<RuntimeConfig>) => {
    try {
      await api('/api/mihomo/configs', {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setMessage('运行配置已更新');
      await load();
    } catch (err) {
      setError(readError(err));
    }
  };

  const saveTunConfig = async (enable = Boolean(tunDiagnostics?.config?.enable ?? config?.tun?.enable)) => {
    try {
      const response = await api<{ reloadStatus?: number; reloadBody?: string; reloadError?: string; diagnostics?: TunDiagnostics }>('/api/config/tun', {
        method: 'PATCH',
        body: JSON.stringify({
          enable,
          stack: tunForm.stack || 'system',
          device: tunForm.device.trim(),
          dnsHijack: parseTunDnsHijack(tunForm.dnsHijack),
          autoRoute: tunForm.autoRoute,
          autoDetectInterface: tunForm.autoDetectInterface
        })
      });
      if (response.diagnostics) {
        setTunDiagnostics(response.diagnostics);
        tunFormDirtyRef.current = false;
        setTunForm(tunFormFromDiagnostics(response.diagnostics, config));
      }
      if (response.reloadError || (response.reloadStatus && response.reloadStatus >= 300)) {
        setError(readTunReloadError(response.reloadBody || response.reloadError || 'TUN 配置已写入，但 mihomo reload 失败'));
      } else {
        setMessage(enable ? 'TUN 配置已写入并尝试启动' : 'TUN 已关闭');
        setError('');
      }
      await load();
    } catch (err) {
      setError(readError(err));
    }
  };

  const patchTun = async (enable: boolean) => {
    await saveTunConfig(enable);
  };

  const tunConfigEnabled = Boolean(tunDiagnostics?.config?.enable ?? config?.tun?.enable);
  const tunRuntimeEnabled = Boolean(tunDiagnostics?.runtimeAvailable && tunDiagnostics.runtime?.enable);
  const tunSavedForm = tunFormFromDiagnostics(tunDiagnostics, config);
  const tunFormDirty = !sameTunForm(tunForm, tunSavedForm);
  const updateTunForm = (patch: Partial<TunForm>) => {
    setTunForm((current) => {
      const next = { ...current, ...patch };
      tunFormDirtyRef.current = !sameTunForm(next, tunSavedForm);
      return next;
    });
  };

  return (
    <Panel title="运行配置" icon={<Settings2 size={18} />}>
      {error && <p className="inlineError">{error}</p>}
      {message && <p className="message">{message}</p>}
      <div className="runtimeGrid">
        <div className="runtimeBlock">
          <span>代理开关</span>
          <div className="toggleRow">
            <button className={config?.mode !== 'direct' ? 'activeMode powerButton on' : 'powerButton'} onClick={() => patchConfig({ mode: config?.mode === 'direct' ? 'rule' : 'direct' })}>
              <Zap size={15} />
              {config?.mode === 'direct' ? '代理关闭' : '代理开启'}
            </button>
            <label className={tunRuntimeEnabled ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
              <input type="checkbox" checked={tunRuntimeEnabled} onChange={(event) => patchTun(event.target.checked)} />
              <span className="switchTrack" aria-hidden="true" />
              <span>TUN</span>
            </label>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>模式</span>
          <div className="segmented">
            {['rule', 'global', 'direct'].map((mode) => (
              <button key={mode} title={describeMode(mode)} className={config?.mode === mode ? 'currentChoice' : ''} disabled={config?.mode === mode} onClick={() => patchConfig({ mode })}>
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="runtimeBlock">
          <span>日志级别</span>
          <div className="segmented">
            {['debug', 'info', 'warning', 'error', 'silent'].map((level) => (
              <button key={level} title={describeLogLevel(level)} className={config?.['log-level'] === level ? 'currentChoice' : ''} disabled={config?.['log-level'] === level} onClick={() => patchConfig({ 'log-level': level })}>
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="runtimeBlock">
          <span>开关</span>
          <div className="toggleRow">
            <label className={Boolean(config?.['allow-lan']) ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
              <input type="checkbox" checked={Boolean(config?.['allow-lan'])} onChange={(event) => patchConfig({ 'allow-lan': event.target.checked })} />
              <span className="switchTrack" aria-hidden="true" />
              <span>Allow LAN</span>
            </label>
            <label className={Boolean(config?.ipv6) ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
              <input type="checkbox" checked={Boolean(config?.ipv6)} onChange={(event) => patchConfig({ ipv6: event.target.checked })} />
              <span className="switchTrack" aria-hidden="true" />
              <span>IPv6</span>
            </label>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>内核</span>
          <div className="runtimeFacts">
            <strong>{version?.version || '-'}</strong>
            <small>{version?.meta ? 'Mihomo Meta' : 'Clash compatible'}</small>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>端口</span>
          <div className="runtimeFacts">
            <strong>mixed {config?.['mixed-port'] || '-'}</strong>
            <small>socks {config?.['socks-port'] || '-'} / http {config?.port || '-'}</small>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>TUN</span>
          <div className="runtimeFacts">
            <strong>{tunRuntimeEnabled ? 'runtime enabled' : 'runtime disabled'}</strong>
            <small>config {tunConfigEnabled ? 'enabled' : 'disabled'} · {tunDiagnostics?.config?.stack || config?.tun?.stack || '-'}</small>
          </div>
        </div>
      </div>
      <div className="tunSettings">
        <div className="tunSettingsHeader">
          <div>
            <strong>TUN 参数</strong>
            <span>开启时如果 config.yaml 没有 tun 节点，会自动写入这些参数并重载 mihomo。</span>
          </div>
          <button className={tunFormDirty ? 'primary' : ''} disabled={!tunFormDirty} onClick={() => saveTunConfig(tunConfigEnabled)}>保存 TUN 配置</button>
        </div>
        <div className="tunSettingsGrid">
          <section className="tunFieldset">
            <div className="tunFieldsetTitle">
              <strong>设备与协议栈</strong>
              <span>决定 TUN 设备如何创建，以及使用哪种网络栈接管流量。</span>
            </div>
            <div className="tunFormGrid twoColumns">
              <label>
                <span>Stack</span>
                <select value={tunForm.stack} onChange={(event) => updateTunForm({ stack: event.target.value })}>
                  <option value="system">system</option>
                  <option value="gvisor">gvisor</option>
                  <option value="mixed">mixed</option>
                </select>
                <small>Linux 通常选 system；容器兼容性异常时再尝试 gvisor 或 mixed。</small>
              </label>
              <label>
                <span>Device</span>
                <input value={tunForm.device} placeholder="留空使用 mihomo 默认" onChange={(event) => updateTunForm({ device: event.target.value })} />
                <small>TUN 设备名。留空时不写入 device 字段，由 mihomo 自行决定。</small>
              </label>
            </div>
          </section>
          <section className="tunFieldset">
            <div className="tunFieldsetTitle">
              <strong>路由与 DNS</strong>
              <span>这组参数控制系统流量和 DNS 请求是否自动进入 mihomo。</span>
            </div>
            <div className="tunFormGrid dnsRouteGrid">
              <label className="wideTunField">
                <span>DNS Hijack</span>
                <input value={tunForm.dnsHijack} placeholder="0.0.0.0:53" onChange={(event) => updateTunForm({ dnsHijack: event.target.value })} />
                <small>多个地址用逗号分隔，例如 0.0.0.0:53, ::1:53。</small>
              </label>
              <div className="tunOptionGroup">
                <label className={tunForm.autoRoute ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
                  <input type="checkbox" checked={tunForm.autoRoute} onChange={(event) => updateTunForm({ autoRoute: event.target.checked })} />
                  <span className="switchTrack" aria-hidden="true" />
                  <span>Auto Route</span>
                </label>
                <small>自动添加路由，让系统流量进入 TUN。</small>
              </div>
              <div className="tunOptionGroup">
                <label className={tunForm.autoDetectInterface ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
                  <input type="checkbox" checked={tunForm.autoDetectInterface} onChange={(event) => updateTunForm({ autoDetectInterface: event.target.checked })} />
                  <span className="switchTrack" aria-hidden="true" />
                  <span>Auto Interface</span>
                </label>
                <small>自动检测出口网卡，避免手动指定 interface-name。</small>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className={tunDiagnostics?.ready ? 'tunDiagnostic ready' : 'tunDiagnostic'}>
        <div className="tunDiagnosticHead">
          <div>
            <strong>{tunDiagnostics?.ready ? 'TUN 环境就绪' : 'TUN 环境需要处理'}</strong>
            <small>{tunDiagnostics?.ready ? '设备映射、权限和运行配置都已通过检查。' : '下面列出启动 TUN 前需要确认的项目。'}</small>
          </div>
          <span className={tunDiagnostics?.ready ? 'statusPill good' : 'statusPill warning'}>{tunDiagnostics?.ready ? 'Ready' : 'Attention'}</span>
        </div>
        <div className="tunCheckGrid">
          <div>
            <span>/dev/net/tun</span>
            <strong>{tunDiagnostics?.serviceMode === 'docker'
              ? tunDiagnostics?.dockerDeviceMapped || tunDiagnostics?.dockerPrivileged ? 'OK' : '缺失'
              : tunDiagnostics?.hostTunExists ? 'OK' : '缺失'}</strong>
          </div>
          <div>
            <span>NET_ADMIN</span>
            <strong>{tunDiagnostics?.serviceMode === 'docker'
              ? tunDiagnostics?.dockerNetAdmin || tunDiagnostics?.dockerPrivileged ? 'OK' : '缺失'
              : '主机模式'}</strong>
          </div>
          <div>
            <span>Runtime</span>
            <strong>{tunRuntimeEnabled ? 'enabled' : 'disabled'}</strong>
          </div>
        </div>
        {tunDiagnostics?.notes?.length ? (
          <ul>
            {tunDiagnostics.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

function Topology({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [proxyMap, setProxyMap] = useState<Record<string, ProxyNode>>({});
  const [rules, setRules] = useState<RuntimeRule[]>([]);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const [proxyData, ruleData] = await Promise.all([
        api<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies'),
        api<{ rules: RuntimeRule[] }>('/api/mihomo/rules')
      ]);
      setProxyMap(proxyData.proxies || {});
      setRules(ruleData.rules || []);
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

  const groups = useMemo(() => Object.values(proxyMap).filter((proxy) => Array.isArray(proxy.all) && proxy.all.length > 0), [proxyMap]);
  const ruleTargets = useMemo(() => {
    const counts = new Map<string, number>();
    rules.forEach((rule) => counts.set(rule.proxy || '-', (counts.get(rule.proxy || '-') || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rules]);
  const visibleRules = selectedTarget ? rules.filter((rule) => rule.proxy === selectedTarget) : rules.slice(0, 120);
  const directRuleCount = rules.filter((rule) => rule.proxy === 'DIRECT').length;
  const rejectRuleCount = rules.filter((rule) => ['REJECT', 'REJECT-DROP'].includes(rule.proxy)).length;

  return (
    <div className="stack">
      {error && <p className="inlineError">{error}</p>}
      <div className="grid">
        <Panel title="关系总览" icon={<ListTree size={18} />}>
          <Metric label="策略组" value={String(groups.length)} />
          <Metric label="规则数" value={String(rules.length)} />
        </Panel>
        <Panel title="直连/拦截" icon={<Shield size={18} />}>
          <Metric label="DIRECT 规则" value={String(directRuleCount)} />
          <Metric label="REJECT 规则" value={String(rejectRuleCount)} />
        </Panel>
        <Panel title="维护入口" icon={<Settings2 size={18} />}>
          <Metric label="策略组维护" value="代理页选择、测速、切换" />
          <Metric label="规则维护" value="规则页按策略目标筛选" />
        </Panel>
      </div>
      <div className="topologyLayout">
        <Panel title="策略组 ER" icon={<Zap size={18} />}>
          <div className="topologyList">
            {groups.map((group) => {
              const concrete = resolveConcreteNode(proxyMap, group.now || group.name);
              const groupRuleCount = rules.filter((rule) => rule.proxy === group.name).length;
              const concreteRuleCount = rules.filter((rule) => rule.proxy === concrete).length;
              return (
                <div className="topologyCard" key={group.name}>
                  <div className="topologyHead">
                    <strong>{group.name}</strong>
                    <span>{group.type}</span>
                  </div>
                  <div className="flowLine">
                    <span>规则 {groupRuleCount}</span>
                    <b>→</b>
                    <span>{group.now || '-'}</span>
                    <b>→</b>
                    <span>{concrete}</span>
                  </div>
                  <div className="ruleMeta">
                    <span>可选节点：{group.all?.length || 0}</span>
                    <span>命中具体节点的规则：{concreteRuleCount}</span>
                    <span>当前延迟：{proxyMap[concrete] ? formatDelay(proxyMap[concrete]) : '- ms'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="规则目标分布" icon={<Globe2 size={18} />}>
          <div className="targetList">
            <button className={!selectedTarget ? 'targetRow active' : 'targetRow'} onClick={() => setSelectedTarget('')}>
              <span>全部规则</span>
              <strong>{rules.length}</strong>
            </button>
            {ruleTargets.map(([target, count]) => (
              <button key={target} className={selectedTarget === target ? 'targetRow active' : 'targetRow'} onClick={() => setSelectedTarget(target)}>
                <span>{target}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title={selectedTarget ? `规则明细：${selectedTarget}` : '规则明细：前 120 条'} icon={<List size={18} />}>
        <div className="ruleList compact">
          {visibleRules.map((rule) => (
            <div className="ruleCard" key={`${rule.index}-${rule.type}-${rule.payload}`}>
              <div className="ruleIndex">#{rule.index}</div>
              <div className="ruleBody">
                <div className="ruleMain">
                  <span className="badge">{rule.type}</span>
                  <strong>{rule.payload || '-'}</strong>
                </div>
                <div className="ruleMeta">
                  <span>目标：{rule.proxy || '-'}</span>
                  <span>命中：{rule.extra?.hitCount || 0}</span>
                  <span>{routeLabel(rule.proxy)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Maintenance({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [model, setModel] = useState<ConfigModel>({ proxyGroups: [], proxyProviders: [], rules: [], ruleProviders: [] });
  const [validation, setValidation] = useState<ConfigValidation>({ ok: true, issues: [] });
  const [groupDraft, setGroupDraft] = useState<ConfigProxyGroup>({ name: '', type: 'select', proxies: [], use: [] });
  const [ruleDraft, setRuleDraft] = useState('');
  const [ruleBuilder, setRuleBuilder] = useState({ type: 'DOMAIN-SUFFIX', payload: '', target: 'PROXY' });
  const [providerDraft, setProviderDraft] = useState<ConfigRuleProvider>({ name: '', type: 'http', behavior: 'domain', url: '', path: '', interval: '86400' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const [data, validationData] = await Promise.all([
        api<ConfigModel>('/api/config/model'),
        api<ConfigValidation>('/api/config/validate')
      ]);
      setModel({
        proxyGroups: data.proxyGroups || [],
        proxyProviders: data.proxyProviders || [],
        rules: data.rules || [],
        ruleProviders: data.ruleProviders || []
      });
      setValidation({ ok: validationData.ok, issues: validationData.issues || [] });
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

  const saveGroup = async () => {
    setBusy(true);
    try {
      await api(`/api/config/proxy-groups/${encodeURIComponent(groupDraft.name)}`, { method: 'PUT', body: JSON.stringify(groupDraft) });
      setMessage(`策略组已保存：${groupDraft.name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async (name: string) => {
    if (!window.confirm(`删除策略组 ${name}？会修改 config.yaml，并在保存前自动备份。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/proxy-groups/${encodeURIComponent(name)}`, { method: 'DELETE' });
      setMessage(`策略组已删除：${name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const moveGroup = async (name: string, direction: 'up' | 'down') => {
    setBusy(true);
    try {
      await api(`/api/config/proxy-groups/${encodeURIComponent(name)}/move`, { method: 'POST', body: JSON.stringify({ direction }) });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const addRule = async () => {
    setBusy(true);
    try {
      await api('/api/config/rules', { method: 'POST', body: JSON.stringify({ rule: ruleDraft }) });
      setRuleDraft('');
      setMessage('规则已新增');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateRule = async (index: number, rule: string) => {
    setBusy(true);
    try {
      await api(`/api/config/rules/${index}`, { method: 'PUT', body: JSON.stringify({ rule }) });
      setMessage(`规则已更新：#${index}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteRule = async (index: number) => {
    if (!window.confirm(`删除规则 #${index}？会修改 config.yaml，并在保存前自动备份。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/rules/${index}`, { method: 'DELETE' });
      setMessage(`规则已删除：#${index}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const moveRule = async (index: number, direction: 'up' | 'down') => {
    setBusy(true);
    try {
      await api(`/api/config/rules/${index}/move`, { method: 'POST', body: JSON.stringify({ direction }) });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const saveRuleProvider = async () => {
    setBusy(true);
    try {
      await api(`/api/config/rule-providers/${encodeURIComponent(providerDraft.name)}`, { method: 'PUT', body: JSON.stringify(providerDraft) });
      setMessage(`规则组 Provider 已保存：${providerDraft.name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteRuleProvider = async (name: string) => {
    if (!window.confirm(`删除 rule-provider ${name}？引用它的 RULE-SET 规则可能失效。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/rule-providers/${encodeURIComponent(name)}`, { method: 'DELETE' });
      setMessage(`规则组 Provider 已删除：${name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const buildRule = () => {
    const next = [ruleBuilder.type, ruleBuilder.payload, ruleBuilder.target].map((item) => item.trim()).filter(Boolean).join(',');
    setRuleDraft(next);
  };

  const groupNames = model.proxyGroups.map((item) => item.name);
  const proxyProviders = model.proxyProviders || [];
  const providerNames = model.ruleProviders.map((item) => item.name);
  const groupNameValid = validName(groupDraft.name);
  const providerNameValid = validName(providerDraft.name);
  const providerUrlValid = providerDraft.type !== 'http' || validURL(providerDraft.url || '');
  const providerPathValid = providerDraft.type !== 'file' || Boolean((providerDraft.path || '').trim());
  const intervalValid = !providerDraft.interval || /^\d+$/.test(providerDraft.interval);
  const ruleDraftValid = validRule(ruleDraft);
  const errorCount = validation.issues.filter((item) => item.level === 'error').length;
  const warningCount = validation.issues.filter((item) => item.level === 'warning').length;
  const ruleTargetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    model.rules.forEach((rule) => {
      const target = configRuleTarget(rule);
      if (target) counts.set(target, (counts.get(target) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [model.rules]);

  return (
    <div className="stack">
      {message && <p className="message">{message}</p>}
      {error && <p className="inlineError">{error}</p>}
      <div className="grid">
        <Panel title="配置体检" icon={<Shield size={18} />}>
          <Metric label="状态" value={validation.ok ? 'OK' : '需要处理'} />
          <Metric label="错误 / 警告" value={`${errorCount} / ${warningCount}`} />
        </Panel>
        <Panel title="规则目标分布" icon={<Globe2 size={18} />}>
          <div className="miniTargetList">
            {ruleTargetCounts.slice(0, 6).map(([target, count]) => (
              <span key={target}>{target} · {count}</span>
            ))}
            {ruleTargetCounts.length === 0 && <span>-</span>}
          </div>
        </Panel>
        <Panel title="引用关系" icon={<ListTree size={18} />}>
          <Metric label="策略组" value={String(model.proxyGroups.length)} />
          <Metric label="rule-provider" value={String(model.ruleProviders.length)} />
        </Panel>
      </div>
      {validation.issues.length > 0 && (
        <Panel title={`风险提示 (${validation.issues.length})`} icon={<AlertTriangle size={18} />}>
          <div className="issueList">
            {validation.issues.map((issue, index) => (
              <div className={`issueCard ${issue.level}`} key={`${issue.scope}-${issue.name}-${index}`}>
                <span>{issue.level}</span>
                <strong>{issue.scope} · {issue.name}</strong>
                <p>{issue.message}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <div className="maintainGrid">
        <Panel title={`策略组维护 (${model.proxyGroups.length})`} icon={<Zap size={18} />}>
          <div className="formTip">策略组名称建议只使用字母、数字、中文、空格、下划线、中横线。节点和 Provider 尽量点选，不需要手写 YAML 数组。</div>
          <div className="maintainForm">
            <input className={groupDraft.name && !groupNameValid ? 'invalidInput' : ''} placeholder="策略组名称，例如 PROXY / AI / 香港节点" value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} />
            {groupDraft.name && !groupNameValid && <div className="fieldError">名称不能包含逗号、冒号、方括号等 YAML 特殊字符。</div>}
            <select title={describeGroupType(groupDraft.type)} value={groupDraft.type} onChange={(event) => setGroupDraft({ ...groupDraft, type: event.target.value })}>
              {['select', 'url-test', 'fallback', 'load-balance', 'relay'].map((item) => <option key={item} title={describeGroupType(item)}>{item}</option>)}
            </select>
            <div className="selectTip">{describeGroupType(groupDraft.type)}</div>
            <ChipEditor
              label="固定节点 / 策略组"
              tip="适合 DIRECT、REJECT、其他策略组，或少量固定节点。大量订阅节点建议用下面的 use。"
              values={groupDraft.proxies || []}
              options={[...new Set(['DIRECT', 'REJECT', ...groupNames.filter((name) => name !== groupDraft.name)])]}
              placeholder="输入或选择节点/策略组"
              onChange={(values) => setGroupDraft({ ...groupDraft, proxies: values })}
            />
            <ChipEditor
              label="引用 proxy-provider"
              tip="这里选择订阅 Provider，mihomo 会把 provider 内节点加入该策略组。"
              values={groupDraft.use || []}
              options={proxyProviders}
              placeholder="选择 proxy-provider"
              onChange={(values) => setGroupDraft({ ...groupDraft, use: values })}
            />
            <div className="toolbar">
              <button className="primary" onClick={saveGroup} disabled={!groupDraft.name.trim() || !groupNameValid}>
                <Save size={16} />
                保存策略组
              </button>
              <button onClick={() => setGroupDraft({ name: '', type: 'select', proxies: [], use: [] })}>
                <Plus size={16} />
                新建
              </button>
            </div>
          </div>
          <div className="maintainList">
            {model.proxyGroups.map((item) => (
              <div className="maintainRow" key={item.name}>
                <button onClick={() => setGroupDraft(item)}>
                  <span>{item.name}</span>
                  <small>{item.type} · proxies {item.proxies?.length || 0} · use {item.use?.length || 0}</small>
                </button>
                <button className="iconButton" title="上移策略组" onClick={() => moveGroup(item.name, 'up')}>
                  <ArrowUp size={16} />
                </button>
                <button className="iconButton" title="下移策略组" onClick={() => moveGroup(item.name, 'down')}>
                  <ArrowDown size={16} />
                </button>
                <button className="iconButton danger" title="删除策略组" onClick={() => deleteGroup(item.name)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={`规则维护 (${model.rules.length})`} icon={<Globe2 size={18} />}>
          <div className="formTip">普通规则用构建器生成；`RULE-SET` 会从 rule-provider 下拉选择。只有特殊高级规则才需要手写完整字符串。</div>
          <div className="ruleBuilder">
            <select title={describeRuleType(ruleBuilder.type)} value={ruleBuilder.type} onChange={(event) => setRuleBuilder({ ...ruleBuilder, type: event.target.value })}>
              {['DOMAIN-SUFFIX', 'DOMAIN', 'DOMAIN-KEYWORD', 'GEOSITE', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'RULE-SET', 'PROCESS-NAME', 'MATCH'].map((item) => <option key={item} title={describeRuleType(item)}>{item}</option>)}
            </select>
            {ruleBuilder.type === 'RULE-SET' ? (
              <select value={ruleBuilder.payload} onChange={(event) => setRuleBuilder({ ...ruleBuilder, payload: event.target.value })}>
                <option value="">选择 rule-provider</option>
                {providerNames.map((item) => <option key={item}>{item}</option>)}
              </select>
            ) : (
              <input className={ruleBuilder.payload && !validRulePayload(ruleBuilder.type, ruleBuilder.payload) ? 'invalidInput' : ''} placeholder={rulePayloadPlaceholder(ruleBuilder.type)} value={ruleBuilder.payload} onChange={(event) => setRuleBuilder({ ...ruleBuilder, payload: event.target.value })} />
            )}
            <select title={describeTarget(ruleBuilder.target)} value={ruleBuilder.target} onChange={(event) => setRuleBuilder({ ...ruleBuilder, target: event.target.value })}>
              {[...new Set(['PROXY', 'DIRECT', 'REJECT', ...groupNames])].map((item) => <option key={item} title={describeTarget(item)}>{item}</option>)}
            </select>
            <button onClick={buildRule}>生成</button>
          </div>
          <div className="selectTip">{describeRuleType(ruleBuilder.type)} 目标：{describeTarget(ruleBuilder.target)}</div>
          <div className="toolbar">
            <input className={ruleDraft && !ruleDraftValid ? 'wideInput invalidInput' : 'wideInput'} placeholder="DOMAIN-SUFFIX,example.com,PROXY" value={ruleDraft} onChange={(event) => setRuleDraft(event.target.value)} />
            <button className="primary" onClick={addRule} disabled={!ruleDraft.trim() || !ruleDraftValid}>
              <Plus size={16} />
              新增规则
            </button>
          </div>
          {ruleDraft && !ruleDraftValid && <div className="fieldError">规则至少需要“类型,内容,目标”，MATCH 至少需要“MATCH,目标”。</div>}
          <div className="maintainList tall">
            {model.rules.map((rule, index) => (
              <RuleEditorRow
                key={`${index}-${rule}`}
                index={index}
                rule={rule}
                targets={[...new Set(['PROXY', 'DIRECT', 'REJECT', ...groupNames])]}
                ruleProviders={providerNames}
                onSave={updateRule}
                onDelete={deleteRule}
                onMove={moveRule}
              />
            ))}
          </div>
        </Panel>

        <Panel title={`规则组 Provider (${model.ruleProviders.length})`} icon={<ListTree size={18} />}>
          <div className="formTip">http 类型必须填写 URL，file 类型必须填写 path。interval 只填秒数，例如 86400。</div>
          <div className="maintainForm">
            <input className={providerDraft.name && !providerNameValid ? 'invalidInput' : ''} placeholder="Provider 名称，例如 private-direct" value={providerDraft.name} onChange={(event) => setProviderDraft({ ...providerDraft, name: event.target.value })} />
            {providerDraft.name && !providerNameValid && <div className="fieldError">名称不能包含逗号、冒号、方括号等 YAML 特殊字符。</div>}
            {providerNames.length > 0 && <div className="relationHint">规则里用 `RULE-SET,名称,策略组` 引用这些 Provider。</div>}
            <div className="formGrid2">
              <select title={describeProviderType(providerDraft.type)} value={providerDraft.type} onChange={(event) => setProviderDraft({ ...providerDraft, type: event.target.value })}>
                {['http', 'file', 'inline'].map((item) => <option key={item} title={describeProviderType(item)}>{item}</option>)}
              </select>
              <select title={describeProviderBehavior(providerDraft.behavior)} value={providerDraft.behavior} onChange={(event) => setProviderDraft({ ...providerDraft, behavior: event.target.value })}>
                {['domain', 'ipcidr', 'classical'].map((item) => <option key={item} title={describeProviderBehavior(item)}>{item}</option>)}
              </select>
            </div>
            <div className="selectTip">{describeProviderType(providerDraft.type)} {describeProviderBehavior(providerDraft.behavior)}</div>
            <input className={!providerUrlValid ? 'invalidInput' : ''} placeholder="https://example.com/rules.yaml" value={providerDraft.url || ''} onChange={(event) => setProviderDraft({ ...providerDraft, url: event.target.value })} />
            {!providerUrlValid && <div className="fieldError">http provider 需要 http/https URL。</div>}
            <input className={!providerPathValid ? 'invalidInput' : ''} placeholder="./rules/private.yaml" value={providerDraft.path || ''} onChange={(event) => setProviderDraft({ ...providerDraft, path: event.target.value })} />
            {!providerPathValid && <div className="fieldError">file provider 需要 path。</div>}
            <input className={!intervalValid ? 'invalidInput' : ''} placeholder="86400" value={providerDraft.interval || ''} onChange={(event) => setProviderDraft({ ...providerDraft, interval: event.target.value })} />
            {!intervalValid && <div className="fieldError">interval 只能填写秒数。</div>}
            <button className="primary" onClick={saveRuleProvider} disabled={!providerDraft.name.trim() || !providerNameValid || !providerUrlValid || !providerPathValid || !intervalValid}>
              <Save size={16} />
              保存 Provider
            </button>
          </div>
          <div className="maintainList">
            {model.ruleProviders.map((item) => (
              <div className="maintainRow" key={item.name}>
                <button onClick={() => setProviderDraft(item)}>
                  <span>{item.name}</span>
                  <small>{item.type} · {item.behavior} · {item.url || item.path || '-'}</small>
                </button>
                <button className="iconButton danger" title="删除规则组" onClick={() => deleteRuleProvider(item.name)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RuleEditorRow({
  index,
  rule,
  targets,
  ruleProviders,
  onSave,
  onDelete,
  onMove
}: {
  index: number;
  rule: string;
  targets: string[];
  ruleProviders: string[];
  onSave: (index: number, rule: string) => void;
  onDelete: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}) {
  const [parsed, setParsed] = useState(parseConfigRule(rule));
  useEffect(() => setParsed(parseConfigRule(rule)), [rule]);
  const isMatch = parsed.type === 'MATCH';
  const isRuleSet = parsed.type === 'RULE-SET';
  const value = serializeConfigRule(parsed);
  const isValid = validRule(value);
  return (
    <div className={isValid ? 'ruleEditRow' : 'ruleEditRow invalid'}>
      <span>#{index}</span>
      <div className="ruleEditMain">
        <div className="ruleFields">
          <select title={describeRuleType(parsed.type)} value={parsed.type} onChange={(event) => setParsed({ ...parsed, type: event.target.value, payload: event.target.value === 'MATCH' ? '' : parsed.payload })}>
            {['DOMAIN-SUFFIX', 'DOMAIN', 'DOMAIN-KEYWORD', 'GEOSITE', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'RULE-SET', 'PROCESS-NAME', 'MATCH'].map((item) => <option key={item} title={describeRuleType(item)}>{item}</option>)}
          </select>
          {isMatch ? (
            <input value="MATCH" disabled />
          ) : isRuleSet ? (
            <select value={parsed.payload} onChange={(event) => setParsed({ ...parsed, payload: event.target.value })}>
              <option value="">选择 rule-provider</option>
              {ruleProviders.map((item) => <option key={item}>{item}</option>)}
            </select>
          ) : (
            <input className={parsed.payload && !validRulePayload(parsed.type, parsed.payload) ? 'invalidInput' : ''} value={parsed.payload} placeholder={rulePayloadPlaceholder(parsed.type)} onChange={(event) => setParsed({ ...parsed, payload: event.target.value })} />
          )}
          <select title={describeTarget(parsed.target)} value={parsed.target} onChange={(event) => setParsed({ ...parsed, target: event.target.value })}>
            <option value="">选择目标</option>
            {targets.map((item) => <option key={item} title={describeTarget(item)}>{item}</option>)}
          </select>
        </div>
        <div className="rulePreview">
          <span>{parsed.type || '-'}</span>
          {!isMatch && <span>{parsed.payload || '-'}</span>}
          <strong>{parsed.target || '-'}</strong>
        </div>
      </div>
      <div className="ruleEditActions">
        <button className="iconButton" title="保存规则" onClick={() => onSave(index, value)} disabled={!isValid}>
          <Save size={15} />
        </button>
        <button className="iconButton" title="上移规则" onClick={() => onMove(index, 'up')}>
          <ArrowUp size={15} />
        </button>
        <button className="iconButton" title="下移规则" onClick={() => onMove(index, 'down')}>
          <ArrowDown size={15} />
        </button>
        <button className="iconButton danger" title="删除规则" onClick={() => onDelete(index)}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function Proxies({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [groups, setGroups] = useState<ProxyGroup[]>([]);
  const [proxyMap, setProxyMap] = useState<Record<string, ProxyNode>>({});
  const [regionMap, setRegionMap] = useState<Record<string, string>>({});
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

  const loadRegions = async () => {
    try {
      const data = await api<{ regions: Record<string, string>; cached: boolean }>('/api/proxy-regions');
      if (data.regions) {
        setRegionMap(data.regions);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    loadRegions();
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
    const node = proxyMap[proxyName];
    if (!isDelayTestable(node)) {
      setError(`${proxyName} 是 ${node?.type || 'Unknown'} 类型，不能直接测速。请选择具体出站节点，或对策略组执行全组测速。`);
      return;
    }
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
                {(regionMap[node.name] || nodeRegion(node.name)) && <span className="badge region">{regionMap[node.name] || nodeRegion(node.name)}</span>}
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
                  disabled={!isDelayTestable(node)}
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

function Traffic({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [points, setPoints] = useState<TrafficPoint[]>([]);
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [error, setError] = useState('');

  const loadConnections = async () => {
    try {
      const next = await api<ConnectionsResponse>('/api/mihomo/connections');
      setConnections({ ...next, connections: next.connections || [] });
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    let closed = false;
    loadConnections();
    const timer = window.setInterval(loadConnections, 3000);
    const stream = new EventSource('/api/mihomo/traffic');
    stream.onmessage = (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data) as { up?: number; down?: number };
        setPoints((current) => [...current.slice(-59), { time: new Date().toLocaleTimeString(), up: data.up || 0, down: data.down || 0 }]);
      } catch {
        // Ignore malformed stream chunks from upstream.
      }
    };
    stream.onerror = () => setError('实时流量连接断开，正在等待浏览器自动重连。');
    return () => {
      closed = true;
      window.clearInterval(timer);
      stream.close();
    };
  }, []);

  const latest = points[points.length - 1];
  const max = Math.max(1, ...points.map((point) => Math.max(point.up, point.down)));

  return (
    <div className="stack">
      {error && <p className="inlineError">{error}</p>}
      <div className="grid">
        <Panel title="实时速度" icon={<Activity size={18} />}>
          <Metric label="上传" value={formatRate(latest?.up || 0)} />
          <Metric label="下载" value={formatRate(latest?.down || 0)} />
        </Panel>
        <Panel title="累计流量" icon={<Gauge size={18} />}>
          <Metric label="上传总量" value={formatBytes(connections?.uploadTotal || 0)} />
          <Metric label="下载总量" value={formatBytes(connections?.downloadTotal || 0)} />
        </Panel>
        <Panel title="连接" icon={<List size={18} />}>
          <Metric label="当前连接数" value={String(connections?.connections?.length || 0)} />
          <button onClick={() => { setBusy(true); loadConnections().finally(() => setBusy(false)); }}>
            <RefreshCw size={16} />
            刷新
          </button>
        </Panel>
      </div>
      <Panel title="最近 60 秒" icon={<Activity size={18} />}>
        <div className="trafficChart">
          {points.map((point, index) => (
            <div className="trafficBar" key={`${point.time}-${index}`} title={`${point.time} ↑${formatRate(point.up)} ↓${formatRate(point.down)}`}>
              <span className="up" style={{ height: `${Math.max(2, (point.up / max) * 100)}%` }} />
              <span className="down" style={{ height: `${Math.max(2, (point.down / max) * 100)}%` }} />
            </div>
          ))}
          {points.length === 0 && <p className="empty">等待实时流量数据</p>}
        </div>
      </Panel>
    </div>
  );
}

function Connections({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [data, setData] = useState<ConnectionsResponse>({ connections: [] });
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const next = await api<ConnectionsResponse>('/api/mihomo/connections');
      setData({ ...next, connections: next.connections || [] });
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const closeConnection = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/mihomo/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const closeAll = async () => {
    setBusy(true);
    try {
      await api('/api/mihomo/connections', { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const query = filter.trim().toLowerCase();
  const connections = (data.connections || []).filter((conn) => {
    const text = [
      conn.metadata?.host,
      conn.metadata?.destinationIP,
      conn.metadata?.destinationPort,
      conn.metadata?.process,
      conn.rule,
      conn.rulePayload,
      conn.chains?.join(' ')
    ].join(' ').toLowerCase();
    return !query || text.includes(query);
  });

  return (
    <Panel title={`连接 (${connections.length}/${data.connections?.length || 0})`} icon={<List size={18} />}>
      {error && <p className="inlineError">{error}</p>}
      <div className="toolbar">
        <input className="searchInput" placeholder="筛选域名、IP、规则、进程" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <button onClick={load}>
          <RefreshCw size={16} />
          刷新
        </button>
        <button className="danger" onClick={closeAll}>
          <CircleX size={16} />
          关闭全部
        </button>
      </div>
      <div className="connectionList">
        {connections.map((conn) => (
          <div className="connectionCard" key={conn.id}>
            <div>
              <strong>{conn.metadata?.host || conn.metadata?.destinationIP || 'unknown'}</strong>
              <span>{conn.metadata?.network || '-'} · {conn.metadata?.type || '-'} · {conn.metadata?.destinationIP || '-'}:{conn.metadata?.destinationPort || '-'}</span>
              <small>{conn.metadata?.process || 'unknown process'} · {conn.start ? formatDate(conn.start) : '-'}</small>
            </div>
            <div>
              <span className={routeClass(conn)}>{routeLabel(connectionRouteTarget(conn))}</span>
              <small>规则：{conn.rule || '-'} {conn.rulePayload ? `· ${conn.rulePayload}` : ''}</small>
            </div>
            <div className="chainList">
              {(conn.chains || []).map((chain) => (
                <span key={chain}>{chain}</span>
              ))}
              {(conn.chains || []).length === 0 && <span>-</span>}
            </div>
            <div className="connectionTraffic">
              <span>↑ {formatBytes(conn.upload || 0)}</span>
              <span>↓ {formatBytes(conn.download || 0)}</span>
            </div>
            <button className="iconButton" title="关闭连接" onClick={() => closeConnection(conn.id)}>
              <CircleX size={16} />
            </button>
          </div>
        ))}
        {connections.length === 0 && <p className="empty">没有连接</p>}
      </div>
    </Panel>
  );
}

function Logs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [level, setLevel] = useState('info');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setLogs([]);
    setConnected(false);
    const stream = new EventSource(`/api/mihomo/logs?level=${encodeURIComponent(level)}`);
    stream.addEventListener('status', () => {
      setConnected(true);
      setError('');
    });
    stream.addEventListener('error', (event) => {
      const data = (event as MessageEvent).data;
      if (data) setError(data);
    });
    stream.onmessage = (event) => {
      setLogs((current) => [...current.slice(-299), event.data]);
      setConnected(true);
      setError('');
    };
    stream.onerror = () => {
      setConnected(false);
      setError('日志流连接断开，正在等待浏览器自动重连。');
    };
    return () => {
      setConnected(false);
      stream.close();
    };
  }, [level]);

  return (
    <Panel title="实时日志" icon={<Terminal size={18} />}>
      {error && <p className="inlineError">{error}</p>}
      <div className="toolbar">
        {['debug', 'info', 'warning', 'error'].map((item) => (
          <button key={item} className={level === item ? 'activeMode' : ''} onClick={() => setLevel(item)}>
            {item}
          </button>
        ))}
        <button onClick={() => setLogs([])}>
          <Trash2 size={16} />
          清空
        </button>
        <span className={connected ? 'streamStatus online' : 'streamStatus'}>{connected ? '已连接' : '连接中'}</span>
      </div>
      <div className="logBox">
        {logs.map((line, index) => (
          <pre key={`${index}-${line}`}>{line}</pre>
        ))}
        {logs.length === 0 && <p className="empty">{connected ? '日志流已连接，等待新日志' : '正在连接日志流'}</p>}
      </div>
    </Panel>
  );
}

function Subscriptions({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newURL, setNewURL] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
      setMessage('订阅已创建');
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
      setMessage('订阅更新完成');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const saveSubscription = async (id: string, patch: { name: string; url: string }) => {
    setBusy(true);
    try {
      await api(`/api/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setMessage('订阅已保存');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteSubscription = async (id: string) => {
    if (!window.confirm('删除该订阅？会从配置中移除对应 proxy-provider。')) return;
    setBusy(true);
    try {
      await api(`/api/subscriptions/${id}`, { method: 'DELETE' });
      setMessage('订阅已删除');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {message && <p className="message">{message}</p>}
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
          <SubscriptionGrid items={managed} empty="还没有由 Manager 接管的订阅" onUpdate={updateSubscription} onSave={saveSubscription} onDelete={deleteSubscription} />
        </Panel>
        <Panel title="配置引用 Provider" icon={<ListTree size={18} />}>
          <SubscriptionGrid items={configProviders} empty="配置里没有额外 proxy-provider" onUpdate={updateSubscription} onSave={saveSubscription} onDelete={deleteSubscription} />
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
  onSave,
  onDelete
}: {
  items: Subscription[];
  empty: string;
  onUpdate: (id: string) => void;
  onSave: (id: string, patch: { name: string; url: string }) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="subscriptionGrid">
      {items.map((item) => <SubscriptionCard key={item.id} item={item} onUpdate={onUpdate} onSave={onSave} onDelete={onDelete} />)}
      {items.length === 0 && <p className="empty">{empty}</p>}
    </div>
  );
}

function SubscriptionCard({
  item,
  onUpdate,
  onSave,
  onDelete
}: {
  item: Subscription;
  onUpdate: (id: string) => void;
  onSave: (id: string, patch: { name: string; url: string }) => void;
  onDelete?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [url, setURL] = useState(item.url);
  useEffect(() => {
    setName(item.name);
    setURL(item.url);
  }, [item.name, item.url]);
  const canEdit = item.managed;
  const status = item.error ? '失败' : item.lastStatus === 'updated' ? '已更新' : validDate(item.updatedAt) ? '已更新' : '未刷新';
  return (
    <div className={item.exists ? 'subscriptionCard' : 'subscriptionCard warning'}>
      <div className="subHead">
        <div>
          <strong>{item.name}</strong>
          <span>{item.managed ? 'Manager' : 'Config'} · {item.type || 'provider'} · {item.providerName}</span>
        </div>
        <div className="subActions">
          {canEdit && (
            <button className="iconButton" title="编辑订阅" onClick={() => setEditing((value) => !value)}>
              <FileCode2 size={16} />
            </button>
          )}
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
      {editing ? (
        <div className="subscriptionEdit">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="订阅名称" />
          <input className={url && !validURL(url) ? 'invalidInput' : ''} value={url} onChange={(event) => setURL(event.target.value)} placeholder="https://example.com/sub" />
          <button className="primary" onClick={() => { onSave(item.id, { name, url }); setEditing(false); }} disabled={!validURL(url)}>
            <Save size={16} />
            保存
          </button>
        </div>
      ) : (
        <p className="subUrl">{item.url || item.path || 'mihomo provider'}</p>
      )}
      {!item.exists && <p className="inlineError">配置引用的 provider 文件不存在，无法刷新。</p>}
      <div className="subscriptionStats">
        <Metric label="节点数" value={String(item.nodeCount || 0)} />
        <Metric label="状态" value={status} />
        <Metric label="更新时间" value={validDate(item.updatedAt) ? formatDate(item.updatedAt!) : '-'} />
      </div>
      <div className="usageBar">
        <span style={{ width: `${usagePercent(item)}%` }} />
      </div>
      <div className="subMeta">
        <span>{formatUsage(item)}</span>
        <span>{item.expire ? `到期：${formatExpire(item.expire)}` : '无到期信息'}</span>
      </div>
      {item.error ? <p className="inlineError">{item.error}</p> : null}
    </div>
  );
}

function ChipEditor({
  label,
  tip,
  values,
  options,
  placeholder,
  onChange
}: {
  label: string;
  tip: string;
  values: string[];
  options: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = (value: string) => {
    const next = value.trim();
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
    setDraft('');
  };
  return (
    <div className="chipEditor">
      <div className="chipHeader">
        <strong>{label}</strong>
        <span>{tip}</span>
      </div>
      <div className="chipList">
        {values.map((item) => (
          <button key={item} className="chip" onClick={() => onChange(values.filter((value) => value !== item))}>
            {item}
            <CircleX size={13} />
          </button>
        ))}
        {values.length === 0 && <span className="chipEmpty">未选择</span>}
      </div>
      <div className="chipAdd">
        <select value="" onChange={(event) => add(event.target.value)}>
          <option value="">{placeholder}</option>
          {options.filter((item) => !values.includes(item)).map((item) => <option key={item} title={describeTarget(item)}>{item}</option>)}
        </select>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="手动输入高级值" />
        <button onClick={() => add(draft)} disabled={!draft.trim()}>
          <Plus size={15} />
          添加
        </button>
      </div>
    </div>
  );
}

function Providers({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'delay' | 'name'>('delay');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ providers: Record<string, Provider> }>('/api/mihomo/providers/proxies');
      const next = Object.entries(data.providers || {}).map(([name, value]) => ({ ...value, name }));
      setProviders(next);
      setSelectedProvider((current) => current || next[0]?.name || '');
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

  const healthCheckProvider = async (name: string) => {
    setBusy(true);
    try {
      await api(`/api/mihomo/providers/proxies/${encodeURIComponent(name)}/healthcheck`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateAllProviders = async () => {
    setBusy(true);
    try {
      for (const item of providers) {
        if (item.vehicleType !== 'Compatible') {
          await api(`/api/mihomo/providers/proxies/${encodeURIComponent(item.name)}`, { method: 'PUT', body: '{}' });
        }
      }
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const testProxy = async (proxyName: string) => {
    const node = providers.flatMap((item) => item.proxies || []).find((item) => item.name === proxyName);
    if (!isDelayTestable(node)) {
      setError(`${proxyName} 是 ${node?.type || 'Unknown'} 类型，不能直接测速。`);
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ delay?: number }>(
        `/api/mihomo/proxies/${encodeURIComponent(proxyName)}/delay?timeout=5000&url=${encodeURIComponent('https://www.gstatic.com/generate_204')}`
      );
      const delay = typeof data.delay === 'number' ? data.delay : 0;
      setProviders((current) =>
        current.map((provider) => ({
          ...provider,
          proxies: (provider.proxies || []).map((proxy) =>
            proxy.name === proxyName
              ? {
                  ...proxy,
                  alive: delay > 0,
                  history: [...((proxy.history || []).slice(-4)), { time: new Date().toISOString(), delay }]
                }
              : proxy
          )
        }))
      );
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const provider = providers.find((item) => item.name === selectedProvider);
  const query = filter.trim().toLowerCase();
  const nodes = useMemo(() => {
    const list = (provider?.proxies || []).filter((node) => {
      const text = [node.name, node.type, node.providerName, node['provider-name']].join(' ').toLowerCase();
      return !query || text.includes(query);
    });
    return [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : latestDelay(a) - latestDelay(b)));
  }, [filter, provider, sort]);

  return (
    <div className="split">
      <Panel title={`Proxy Providers (${providers.length})`} icon={<ListTree size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        <div className="toolbar">
          <button onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
          <button onClick={updateAllProviders}>
            <RotateCcw size={16} />
            更新全部
          </button>
        </div>
        <ProviderCards items={providers} selected={selectedProvider} onSelect={setSelectedProvider} onUpdate={updateProvider} onHealthCheck={healthCheckProvider} />
      </Panel>
      <Panel title={provider ? `${provider.name} · ${nodes.length}/${provider.proxies?.length || 0} 节点` : 'Provider 节点'} icon={<Activity size={18} />}>
        {provider ? (
          <>
            <div className="providerSummary">
              <Metric label="类型" value={provider.vehicleType || provider.type || '-'} />
              <Metric label="测试地址" value={provider.testUrl || '-'} />
              <Metric label="更新时间" value={validDate(provider.updatedAt) ? formatDate(provider.updatedAt!) : '未更新'} />
            </div>
            <div className="toolbar">
              <input className="searchInput" placeholder="筛选节点、类型、Provider" value={filter} onChange={(event) => setFilter(event.target.value)} />
              <button className={sort === 'delay' ? 'activeMode' : ''} onClick={() => setSort('delay')}>延迟</button>
              <button className={sort === 'name' ? 'activeMode' : ''} onClick={() => setSort('name')}>名称</button>
              <button onClick={() => healthCheckProvider(provider.name)}>
                <Gauge size={16} />
                Provider 测速
              </button>
            </div>
            <div className="providerNodeGrid">
              {nodes.map((node) => (
                <div className="providerNodeCard" key={`${provider.name}-${node.name}`}>
                  <div className="nodeMainText">
                    <strong>{node.name}</strong>
                    <span>{node.providerName || node['provider-name'] || provider.name}</span>
                  </div>
                  <div className="badgeRow">
                    <span className="badge">{node.type || 'Unknown'}</span>
                    {node.udp && <span className="badge">UDP</span>}
                    <span className={node.alive === false ? 'statusPill bad' : node.alive === true ? 'statusPill good' : 'statusPill'}>{node.alive === false ? '异常' : node.alive === true ? '正常' : '未知'}</span>
                    <span className={`delay ${delayClass(node)}`}>{formatDelay(node)}</span>
                  </div>
                  <button className="testButton" onClick={() => testProxy(node.name)} disabled={!isDelayTestable(node)}>
                    <Gauge size={15} />
                    测速
                  </button>
                </div>
              ))}
              {nodes.length === 0 && <p className="empty">没有匹配的节点</p>}
            </div>
          </>
        ) : (
          <p className="empty">请选择一个 provider</p>
        )}
      </Panel>
    </div>
  );
}

function Rules({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [providers, setProviders] = useState<RuleProvider[]>([]);
  const [rules, setRules] = useState<RuntimeRule[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const [providerData, ruleData] = await Promise.all([
        api<{ providers: Record<string, RuleProvider> }>('/api/mihomo/providers/rules'),
        api<{ rules: RuntimeRule[] }>('/api/mihomo/rules')
      ]);
      setProviders(Object.entries(providerData.providers || {}).map(([name, value]) => ({ ...value, name })));
      setRules(ruleData.rules || []);
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

  const query = filter.trim().toLowerCase();
  const ruleTargets = useMemo(() => {
    const counts = new Map<string, number>();
    rules.forEach((item) => counts.set(item.proxy || '-', (counts.get(item.proxy || '-') || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rules]);
  const visibleRules = rules.filter((item) => {
    const text = [item.type, item.payload, item.proxy].join(' ').toLowerCase();
    return (!selectedTarget || item.proxy === selectedTarget) && (!query || text.includes(query));
  });

  return (
    <div className="stack">
      <Panel title={`Rule Providers (${providers.length})`} icon={<Globe2 size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        <div className="table">
          {providers.map((item) => (
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
          {providers.length === 0 && <p className="empty">没有读取到 rule-provider</p>}
        </div>
      </Panel>
      <Panel title={`已加载规则 (${visibleRules.length}/${rules.length})`} icon={<ListTree size={18} />}>
        <div className="toolbar">
          <input className="searchInput" placeholder="筛选类型、规则内容、策略" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <button className={!selectedTarget ? 'activeMode' : ''} onClick={() => setSelectedTarget('')}>全部</button>
          <button onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
        <div className="targetChips">
          {ruleTargets.slice(0, 24).map(([target, count]) => (
            <button key={target} className={selectedTarget === target ? 'targetChip active' : 'targetChip'} onClick={() => setSelectedTarget(target)}>
              <span>{target}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
        <div className="ruleList">
          {visibleRules.map((item) => (
            <div className={item.extra?.disabled ? 'ruleCard disabled' : 'ruleCard'} key={`${item.index}-${item.type}-${item.payload}`}>
              <div className="ruleIndex">#{item.index}</div>
              <div className="ruleBody">
                <div className="ruleMain">
                  <span className="badge">{item.type}</span>
                  <strong>{item.payload || '-'}</strong>
                </div>
                <div className="ruleMeta">
                  <span>策略：{item.proxy || '-'}</span>
                  <span>命中：{item.extra?.hitCount || 0}</span>
                  <span>未命中：{item.extra?.missCount || 0}</span>
                  <span>大小：{item.size || 0}</span>
                  {item.extra?.hitAt && validDate(item.extra.hitAt) && <span>最近命中：{formatDate(item.extra.hitAt)}</span>}
                </div>
              </div>
            </div>
          ))}
          {visibleRules.length === 0 && <p className="empty">没有匹配的规则</p>}
        </div>
      </Panel>
    </div>
  );
}

function ProviderCards({
  items,
  selected,
  onSelect,
  onUpdate,
  onHealthCheck
}: {
  items: Provider[];
  selected: string;
  onSelect: (name: string) => void;
  onUpdate: (name: string) => void;
  onHealthCheck: (name: string) => void;
}) {
  return (
    <div className="providerGrid">
      {items.map((item) => (
        <div className={item.name === selected ? 'providerCard selected' : 'providerCard'} key={item.name}>
          <button className="providerSelect" onClick={() => onSelect(item.name)}>
            <strong>{item.name}</strong>
            <span>{item.type || item.vehicleType || 'provider'}</span>
          </button>
          <div className="providerActions">
            <button className="iconButton" title="更新 provider" onClick={() => onUpdate(item.name)} disabled={item.vehicleType === 'Compatible'}>
              <RefreshCw size={16} />
            </button>
            <button className="iconButton" title="Provider 测速" onClick={() => onHealthCheck(item.name)}>
              <Gauge size={16} />
            </button>
          </div>
          <Metric label="节点数" value={String(item.proxies?.length || 0)} />
        </div>
      ))}
      {items.length === 0 && <p className="empty">没有读取到 proxy-provider</p>}
    </div>
  );
}

function ConfigEditor({ setBusy, health }: { setBusy: (busy: boolean) => void; health: Health | null }) {
  const [content, setContent] = useState('');
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(true);

  const load = async () => {
    setBusy(true);
    try {
      const [data, backupData] = await Promise.all([
        api<{ content: string }>('/api/config'),
        api<{ backups: ConfigBackup[] }>('/api/config/backups')
      ]);
      setContent(data.content);
      setBackups(backupData.backups || []);
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
    if (!advanced && !window.confirm('高级 YAML 编辑未展开。确认要保存当前文本内容？')) return;
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
      await loadBackups();
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const loadBackups = async () => {
    const data = await api<{ backups: ConfigBackup[] }>('/api/config/backups');
    setBackups(data.backups || []);
  };

  const viewBackup = async (name: string) => {
    setBusy(true);
    try {
      const data = await api<{ content: string }>(`/api/config/backups/${encodeURIComponent(name)}`);
      setSelectedBackup(name);
      setContent(data.content);
      setMessage(`已载入备份：${name}`);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (name: string) => {
    if (!window.confirm(`恢复备份 ${name}？当前配置会先自动备份，然后替换并 reload。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/backups/${encodeURIComponent(name)}/restore`, { method: 'POST', body: '{}' });
      setSelectedBackup('');
      setMessage(`已恢复备份并 reload：${name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split configSplit">
      <Panel title="配置编辑" icon={<FileCode2 size={18} />}>
        <div className="formTip">优先使用“维护”页的结构化表单。这里是高级 YAML 文本编辑入口，仅用于批量调整或排查问题；保存前会自动备份。</div>
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
          <button onClick={() => setAdvanced((value) => !value)}>
            <FileCode2 size={16} />
            {advanced ? '收起高级编辑' : '展开高级编辑'}
          </button>
        </div>
        {selectedBackup && <p className="inlineHint">当前编辑器内容来自备份：{selectedBackup}。点“保存”会写入当前配置。</p>}
        {message && <p className="message">{message}</p>}
        {error && <p className="inlineError">{error}</p>}
        {advanced ? (
          <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />
        ) : (
          <div className="configPreview">
            <pre>{content.slice(0, 2400)}</pre>
            {content.length > 2400 && <span>仅预览前 2400 字符，展开高级编辑可查看完整配置。</span>}
          </div>
        )}
      </Panel>
      <div className="sideStack">
        <Service setBusy={setBusy} health={health} />
        <Panel title={`备份 (${backups.length})`} icon={<DatabaseBackup size={18} />}>
          <div className="toolbar">
            <button onClick={backup}>
              <DatabaseBackup size={16} />
              创建备份
            </button>
            <button onClick={() => loadBackups().catch((err) => setError(readError(err)))}>
              <RefreshCw size={16} />
              刷新
            </button>
          </div>
          <div className="backupList">
            {backups.map((item) => (
              <div className={selectedBackup === item.name ? 'backupCard selected' : 'backupCard'} key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatDate(item.modifiedAt)} · {formatBytes(item.size)}</span>
                </div>
                <div className="backupActions">
                  <button onClick={() => viewBackup(item.name)}>
                    <FileCode2 size={16} />
                    查看
                  </button>
                  <button className="danger" onClick={() => restoreBackup(item.name)}>
                    <RotateCcw size={16} />
                    恢复
                  </button>
                </div>
              </div>
            ))}
            {backups.length === 0 && <p className="empty">还没有配置备份</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Service({ setBusy, health }: { setBusy: (busy: boolean) => void; health: Health | null }) {
  const [status, setStatus] = useState('');
  const [active, setActive] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const call = async (action?: string) => {
    setBusy(true);
    try {
      if (action) {
        await api(`/api/service/${action}`, { method: 'POST', body: '{}' });
      }
      const data = await api<{ active: boolean; output: string; error: string }>('/api/service/status');
      setActive(data.active);
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
    <Panel title="服务与运行" icon={<Terminal size={18} />}>
      <div className="serviceHeader">
        <div>
          <strong>{health?.serviceMode === 'docker' ? 'mihomo container' : 'mihomo.service'}</strong>
          <span>{status || '正在读取服务状态'}</span>
        </div>
        <span className={active ? 'statusPill good' : 'statusPill warning'}>{active ? 'Active' : 'Inactive'}</span>
      </div>
      {error && <p className="inlineError">{error}</p>}
      <div className="serviceGrid">
        <Metric label="模式" value={health?.serviceMode || '-'} />
        <Metric label="控制器" value={health?.mihomoController || '-'} />
        <Metric label="配置" value={health?.mihomoConfigPath || '-'} />
      </div>
      <div className="serviceActions">
        <button className="primary" onClick={() => call('start')} disabled={active === true}>
          <Play size={16} />
          启动
        </button>
        <button onClick={() => call('reload')} disabled={active === false}>
          <RefreshCw size={16} />
          Reload 配置
        </button>
        <button onClick={() => call('restart')}>
          <RotateCcw size={16} />
          重启服务
        </button>
        <button className="danger" onClick={() => call('stop')} disabled={active === false}>
          <Square size={16} />
          停止
        </button>
      </div>
      <p className="inlineHint">这里合并到系统配置页：日常只需要 reload 或重启；停止会让代理服务不可用，按钮会根据实时状态禁用。</p>
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

function defaultTunForm(): TunForm {
  return {
    stack: 'system',
    device: '',
    dnsHijack: '0.0.0.0:53',
    autoRoute: true,
    autoDetectInterface: true
  };
}

function tunFormFromDiagnostics(diagnostics: TunDiagnostics | null, config: RuntimeConfig | null): TunForm {
  const defaults = defaultTunForm();
  const dnsHijack = diagnostics?.config?.dnsHijack?.length ? diagnostics.config.dnsHijack.join(', ') : defaults.dnsHijack;
  return {
    stack: diagnostics?.config?.stack || config?.tun?.stack || defaults.stack,
    device: diagnostics?.config?.device || config?.tun?.device || '',
    dnsHijack,
    autoRoute: diagnostics?.config?.autoRoute ?? defaults.autoRoute,
    autoDetectInterface: diagnostics?.config?.autoDetectInterface ?? defaults.autoDetectInterface
  };
}

function parseTunDnsHijack(value: string) {
  const items = value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : ['0.0.0.0:53'];
}

function sameTunForm(left: TunForm, right: TunForm) {
  return left.stack === right.stack
    && left.device.trim() === right.device.trim()
    && parseTunDnsHijack(left.dnsHijack).join(',') === parseTunDnsHijack(right.dnsHijack).join(',')
    && left.autoRoute === right.autoRoute
    && left.autoDetectInterface === right.autoDetectInterface;
}

function readTunReloadError(value: string) {
  const text = parseErrorText(value) || value;
  if (text.includes('/dev/net/tun') || text.includes('no such file or directory')) {
    return 'TUN 配置已写入，但 mihomo 无法创建 TUN 设备。Docker 部署需要挂载 /dev/net/tun，并添加 NET_ADMIN capability 或 privileged 模式。';
  }
  if (text.includes('operation not permitted') || text.includes('permission denied')) {
    return 'TUN 配置已写入，但 mihomo 权限不足。请检查容器 NET_ADMIN/privileged 或主机运行权限。';
  }
  if (text.includes('device or resource busy') || text.includes('device busy')) {
    return 'TUN 设备已被占用，系统已自动重启 mihomo 服务。';
  }
  if (text.includes('address already in use') || text.includes('already exists')) {
    return 'TUN 接口已存在。请检查是否有其他 TUN 接口冲突，或尝试指定不同的设备名称。';
  }
  return text;
}

function usagePercent(item: Subscription) {
  if (!item.total) return 0;
  return Math.min(100, Math.round((((item.upload || 0) + (item.download || 0)) / item.total) * 100));
}

function lines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function validName(value: string) {
  return /^[\p{L}\p{N} _.\-()!@]+$/u.test(value.trim());
}

function validURL(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function parseConfigRule(rule: string) {
  const parts = rule.split(',').map((item) => item.trim()).filter(Boolean);
  const type = parts[0] || '';
  if (type === 'MATCH') {
    return { type, payload: 'all', target: parts[1] || '' };
  }
  return { type, payload: parts[1] || '', target: parts[2] || '' };
}

function serializeConfigRule(rule: { type: string; payload: string; target: string }) {
  if (rule.type === 'MATCH') return ['MATCH', rule.target].filter(Boolean).join(',');
  return [rule.type, rule.payload, rule.target].filter(Boolean).join(',');
}

function validRule(rule: string) {
  const parsed = parseConfigRule(rule);
  if (!parsed.type) return false;
  if (parsed.type === 'MATCH') return Boolean(parsed.target);
  return Boolean(parsed.payload && parsed.target);
}

function validRulePayload(type: string, payload: string) {
  const value = payload.trim();
  if (!value) return false;
  if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') return /^(\*\.)?[\w.-]+\.[A-Za-z]{2,}$/.test(value);
  if (type === 'IP-CIDR' || type === 'IP-CIDR6') return value.includes('/');
  return true;
}

function rulePayloadPlaceholder(type: string) {
  if (type === 'DOMAIN-SUFFIX') return 'example.com';
  if (type === 'DOMAIN') return 'www.example.com';
  if (type === 'DOMAIN-KEYWORD') return 'google';
  if (type === 'GEOSITE') return 'cn / geolocation-!cn';
  if (type === 'GEOIP') return 'CN';
  if (type === 'IP-CIDR') return '192.168.0.0/16';
  if (type === 'PROCESS-NAME') return 'chrome.exe';
  if (type === 'MATCH') return 'MATCH 不需要内容，可留空';
  return '匹配内容';
}

function describeMode(value: string) {
  const map: Record<string, string> = {
    rule: '规则模式：按 rules 从上到下匹配，命中后走对应策略。',
    global: '全局模式：所有连接都走 GLOBAL/全局策略。',
    direct: '直连模式：所有连接直连，相当于临时关闭代理分流。'
  };
  return map[value] || value;
}

function describeLogLevel(value: string) {
  const map: Record<string, string> = {
    debug: '输出最详细日志，适合排查问题。',
    info: '常规日志级别，适合日常使用。',
    warning: '只显示警告和错误。',
    error: '只显示错误。',
    silent: '静默，不输出运行日志。'
  };
  return map[value] || value;
}

function describeGroupType(value: string) {
  const map: Record<string, string> = {
    select: '手动选择节点或策略组，最适合常用分组。',
    'url-test': '自动测速并选择延迟最低的可用节点。',
    fallback: '按顺序使用第一个可用节点，适合主备线路。',
    'load-balance': '在多个节点之间分摊连接，适合均衡负载。',
    relay: '链式代理，连接会按 proxies 顺序串联。'
  };
  return map[value] || value;
}

function describeRuleType(value: string) {
  const map: Record<string, string> = {
    'DOMAIN-SUFFIX': '匹配域名后缀，例如 example.com 会匹配 www.example.com。',
    DOMAIN: '精确匹配完整域名，例如 www.example.com。',
    'DOMAIN-KEYWORD': '域名包含关键词即匹配，例如 google。',
    GEOSITE: '使用 mihomo/geosite 内置域名集合，例如 cn。',
    'IP-CIDR': '匹配 IPv4 网段，例如 192.168.0.0/16。',
    'IP-CIDR6': '匹配 IPv6 网段。',
    GEOIP: '按目标 IP 所属国家/地区匹配，例如 CN。',
    'RULE-SET': '引用 rule-provider 规则集，适合远程或本地规则文件。',
    'PROCESS-NAME': '按进程名匹配，通常仅在客户端或支持进程识别的平台有效。',
    MATCH: '兜底规则，通常放在最后，匹配所有未命中的连接。'
  };
  return map[value] || value;
}

function describeTarget(value: string) {
  if (!value) return '选择规则命中后要走的策略。';
  if (value === 'DIRECT') return '直连，不经过代理。';
  if (value === 'REJECT') return '拒绝连接。';
  if (value === 'PROXY') return '常用代理策略组，具体节点由该组决定。';
  return `策略组或节点：${value}。规则命中后会转到这里。`;
}

function describeProviderType(value: string) {
  const map: Record<string, string> = {
    http: '远程规则集，通过 URL 拉取并按 interval 更新。',
    file: '本地规则集，从 path 指定的文件读取。',
    inline: '内联规则集，规则直接写在配置中。'
  };
  return map[value] || value;
}

function describeProviderBehavior(value: string) {
  const map: Record<string, string> = {
    domain: '规则集内容是域名类规则。',
    ipcidr: '规则集内容是 IP/CIDR 类规则。',
    classical: '规则集内容是完整 classical 规则语法。'
  };
  return map[value] || value;
}

function configRuleTarget(rule: string) {
  const parts = rule.split(',').map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts[0] === 'MATCH') return parts[1] || '';
  return parts[2] || '';
}

function formatUsage(item: Subscription) {
  const used = (item.upload || 0) + (item.download || 0);
  if (!item.total) return '无流量信息';
  return `${formatBytes(used)} / ${formatBytes(item.total)}`;
}

function formatRate(value: number) {
  return `${formatBytes(value)}/s`;
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

function connectionRouteTarget(conn: Connection) {
  const chain = conn.chains || [];
  if (chain.includes('DIRECT')) return 'DIRECT';
  if (chain.some((item) => item === 'REJECT' || item === 'REJECT-DROP')) return 'REJECT';
  return chain[0] || conn.rule || '-';
}

function routeLabel(target?: string) {
  if (!target || target === '-') return '未知链路';
  if (target === 'DIRECT') return '直连 DIRECT';
  if (target === 'REJECT' || target === 'REJECT-DROP') return '拦截 REJECT';
  return `代理 ${target}`;
}

function routeClass(conn: Connection) {
  const target = connectionRouteTarget(conn);
  if (target === 'DIRECT') return 'routePill direct';
  if (target === 'REJECT' || target === 'REJECT-DROP') return 'routePill reject';
  return 'routePill proxy';
}

function resolveConcreteNode(proxies: Record<string, ProxyNode>, startName: string) {
  let current = startName;
  const seen = new Set<string>();
  for (let index = 0; index < 8; index += 1) {
    if (!current || seen.has(current)) break;
    seen.add(current);
    const proxy = proxies[current];
    if (!proxy || !Array.isArray(proxy.all) || !proxy.now) break;
    current = proxy.now;
  }
  return current || startName || '-';
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

function nodeRegion(name: string) {
  const m = name.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  return m ? m[0] : '';
}

function isDelayTestable(node?: ProxyNode) {
  if (!node) return false;
  if (Array.isArray(node.all) && node.all.length > 0) return false;
  return !['Compatible', 'Selector', 'URLTest', 'Fallback', 'LoadBalance', 'Relay'].includes(node.type || '');
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
