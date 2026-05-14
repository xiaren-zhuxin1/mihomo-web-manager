export type Page = 'overview' | 'guide' | 'topology' | 'maintenance' | 'traffic' | 'proxies' | 'connections' | 'logs' | 'subscriptions' | 'providers' | 'rules' | 'config' | 'groups' | 'recovery';

export type Health = {
  ok: boolean;
  version?: string;
  buildDate?: string;
  mihomoController: string;
  mihomoConfigPath: string;
  managerTokenActive: boolean;
  serviceMode?: string;
  os: string;
};

export type ProxyGroup = {
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

export type ProxyNode = ProxyGroup & {
  providerName?: string;
  'provider-name'?: string;
};

export type Provider = {
  name: string;
  type?: string;
  vehicleType?: string;
  testUrl?: string;
  expectedStatus?: string;
  updatedAt?: string;
  proxies?: ProxyNode[];
};

export type RuleProvider = {
  name: string;
  behavior?: string;
  vehicleType?: string;
  ruleCount?: number;
  updatedAt?: string;
};

export type RuntimeConfig = {
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

export type TunDiagnostics = {
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

export type TunForm = {
  stack: string;
  device: string;
  dnsHijack: string;
  autoRoute: boolean;
  autoDetectInterface: boolean;
};

export type MihomoVersion = {
  version?: string;
  meta?: boolean;
};

export type RuntimeRule = {
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

export type Connection = {
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

export type ConnectionsResponse = {
  connections: Connection[];
  uploadTotal?: number;
  downloadTotal?: number;
  memory?: number;
};

export type TrafficPoint = {
  time: string;
  up: number;
  down: number;
};

export type Subscription = {
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

export type ConfigBackup = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
};

export type ConfigProxyGroup = {
  name: string;
  type: string;
  proxies: string[];
  use: string[];
  url?: string;
  interval?: string;
  filter?: string;
};

export type ConfigRuleProvider = {
  name: string;
  type: string;
  behavior: string;
  url?: string;
  path?: string;
  interval?: string;
};

export type ConfigModel = {
  proxyGroups: ConfigProxyGroup[];
  proxyProviders: string[];
  rules: string[];
  ruleProviders: ConfigRuleProvider[];
};

export type ConfigValidationIssue = {
  level: 'error' | 'warning';
  scope: string;
  name: string;
  message: string;
};

export type ConfigValidation = {
  ok: boolean;
  issues: ConfigValidationIssue[];
};

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type AppConfig = {
  theme: 'light' | 'dark';
  onboardingCompleted?: boolean;
  sidebarCollapsed?: boolean;
  lastPage?: Page;
};
