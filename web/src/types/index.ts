export type Page = 'overview' | 'guide' | 'topology' | 'maintenance' | 'traffic' | 'proxies' | 'connections' | 'logs' | 'subscriptions' | 'providers' | 'rules' | 'config';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
};

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
  icon?: string;
};

export type ProxyNode = {
  name: string;
  type: string;
  alive?: boolean;
  history?: Array<{ delay: number }>;
  udp?: boolean;
  icon?: string;
  all?: string[];
  now?: string;
  country?: string;
  city?: string;
  region?: string;
};

export type Connection = {
  id: string;
  metadata: {
    network: string;
    type: string;
    sourceIP: string;
    sourcePort: string;
    destinationIP: string;
    destinationPort: string;
    host: string;
    process: string;
    processPath: string;
  };
  upload: number;
  download: number;
  start: string;
  chains?: string[];
  rule: string;
  rulePayload?: string;
};

export type Subscription = {
  name: string;
  url: string;
  updated?: string;
  trafficUsed?: number;
  trafficTotal?: number;
  expire?: number;
  error?: string;
  upload?: number;
  download?: number;
};

export type Provider = {
  name: string;
  type: string;
  vehicleType: string;
  updatedAt?: string;
  subscription?: {
    info?: {
      Upload?: number;
      Download?: number;
      Total?: number;
      Expire?: number;
    };
  };
};

export type Rule = {
  type: string;
  payload: string;
  proxy: string;
};

export type TunConfig = {
  enable?: boolean;
  stack?: string;
  dnsHijack?: string[];
  autoRoute?: boolean;
  autoDetectInterface?: boolean;
};

export type TunDiagnostics = {
  config: TunConfig;
  runtime: TunConfig;
  runtimeAvailable: boolean;
  serviceMode: string;
  hostTunExists: boolean;
  dockerDeviceMapped: boolean;
  dockerNetAdmin: boolean;
  dockerPrivileged: boolean;
  ready: boolean;
  notes: string[];
  blockers: TunBlocker[];
  suggestions: string[];
  canAutoFix: boolean;
  lastError?: string;
  mihomoLogSnippet?: string;
};

export type TunBlocker = {
  code: string;
  severity: 'error' | 'warning';
  title: string;
  description: string;
  fixCommand?: string;
  fixUrl?: string;
};

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  target?: string;
  page?: Page;
  action?: string;
};

export type AppConfig = {
  theme: 'light' | 'dark';
  onboardingCompleted: boolean;
  lastPage?: Page;
  sidebarCollapsed?: boolean;
};
