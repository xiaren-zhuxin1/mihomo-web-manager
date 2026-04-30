import type { Connection, ProxyNode, Subscription, TunDiagnostics, TunForm, RuntimeConfig } from '../types';

export function readError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (text.includes('unauthorized') || text.includes('401')) {
    return '未授权：当前 WebUI 不再内置 token 输入框，请关闭 MWM_TOKEN，或通过反向代理注入 Authorization。';
  }
  return text;
}

export function parseErrorText(text: string): string {
  if (!text.trim()) return '';
  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error || data.message || text;
  } catch {
    return text;
  }
}

export function defaultTunForm(): TunForm {
  return {
    stack: 'system',
    device: '',
    dnsHijack: '0.0.0.0:53',
    autoRoute: true,
    autoDetectInterface: true
  };
}

export function tunFormFromDiagnostics(diagnostics: TunDiagnostics | null, config: RuntimeConfig | null): TunForm {
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

export function parseTunDnsHijack(value: string): string[] {
  const items = value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : ['0.0.0.0:53'];
}

export function sameTunForm(left: TunForm, right: TunForm): boolean {
  return left.stack === right.stack
    && left.device.trim() === right.device.trim()
    && parseTunDnsHijack(left.dnsHijack).join(',') === parseTunDnsHijack(right.dnsHijack).join(',')
    && left.autoRoute === right.autoRoute
    && left.autoDetectInterface === right.autoDetectInterface;
}

export function readTunReloadError(value: string): string {
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

export function usagePercent(item: Subscription): number {
  if (!item.total) return 0;
  return Math.min(100, Math.round((((item.upload || 0) + (item.download || 0)) / item.total) * 100));
}

export function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export function validName(value: string): boolean {
  return /^[\p{L}\p{N} _.\-()!@]+$/u.test(value.trim());
}

export function validURL(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function parseConfigRule(rule: string): { type: string; payload: string; target: string } {
  const parts = rule.split(',').map((item) => item.trim()).filter(Boolean);
  const type = parts[0] || '';
  if (type === 'MATCH') {
    return { type, payload: 'all', target: parts[1] || '' };
  }
  return { type, payload: parts[1] || '', target: parts[2] || '' };
}

export function serializeConfigRule(rule: { type: string; payload: string; target: string }): string {
  if (rule.type === 'MATCH') return ['MATCH', rule.target].filter(Boolean).join(',');
  return [rule.type, rule.payload, rule.target].filter(Boolean).join(',');
}

export function validRule(rule: string): boolean {
  const parsed = parseConfigRule(rule);
  if (!parsed.type) return false;
  if (parsed.type === 'MATCH') return Boolean(parsed.target);
  return Boolean(parsed.payload && parsed.target);
}

export function validRulePayload(type: string, payload: string): boolean {
  const value = payload.trim();
  if (!value) return false;
  if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') return /^(\*\.)?[\w.-]+\.[A-Za-z]{2,}$/.test(value);
  if (type === 'IP-CIDR' || type === 'IP-CIDR6') return value.includes('/');
  return true;
}

export function rulePayloadPlaceholder(type: string): string {
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

export function describeMode(value: string): string {
  const map: Record<string, string> = {
    rule: '规则模式：按 rules 从上到下匹配，命中后走对应策略。',
    global: '全局模式：所有连接都走 GLOBAL/全局策略。',
    direct: '直连模式：所有连接直连，相当于临时关闭代理分流。'
  };
  return map[value] || value;
}

export function describeLogLevel(value: string): string {
  const map: Record<string, string> = {
    debug: '输出最详细日志，适合排查问题。',
    info: '常规日志级别，适合日常使用。',
    warning: '只显示警告和错误。',
    error: '只显示错误。',
    silent: '静默，不输出运行日志。'
  };
  return map[value] || value;
}

export function describeGroupType(value: string): string {
  const map: Record<string, string> = {
    select: '手动选择节点或策略组，最适合常用分组。',
    'url-test': '自动测速并选择延迟最低的可用节点。',
    fallback: '按顺序使用第一个可用节点，适合主备线路。',
    'load-balance': '在多个节点之间分摊连接，适合均衡负载。',
    relay: '链式代理，连接会按 proxies 顺序串联。'
  };
  return map[value] || value;
}

export function describeRuleType(value: string): string {
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

export function describeTarget(value: string): string {
  if (!value) return '选择规则命中后要走的策略。';
  if (value === 'DIRECT') return '直连，不经过代理。';
  if (value === 'REJECT') return '拒绝连接。';
  if (value === 'PROXY') return '常用代理策略组，具体节点由该组决定。';
  return `策略组或节点：${value}。规则命中后会转到这里。`;
}

export function describeProviderType(value: string): string {
  const map: Record<string, string> = {
    http: '远程规则集，通过 URL 拉取并按 interval 更新。',
    file: '本地规则集，从 path 指定的文件读取。',
    inline: '内联规则集，规则直接写在配置中。'
  };
  return map[value] || value;
}

export function describeProviderBehavior(value: string): string {
  const map: Record<string, string> = {
    domain: '规则集内容是域名类规则。',
    ipcidr: '规则集内容是 IP/CIDR 类规则。',
    classical: '规则集内容是完整 classical 规则语法。'
  };
  return map[value] || value;
}

export function configRuleTarget(rule: string): string {
  const parts = rule.split(',').map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts[0] === 'MATCH') return parts[1] || '';
  return parts[2] || '';
}

export function formatUsage(item: Subscription): string {
  const used = (item.upload || 0) + (item.download || 0);
  if (!item.total) return '无流量信息';
  return `${formatBytes(used)} / ${formatBytes(item.total)}`;
}

export function formatRate(value: number): string {
  return `${formatBytes(value)}/s`;
}

export function formatBytes(value: number): string {
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

export function validDate(value?: string): boolean {
  if (!value || value.startsWith('0001-')) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatExpire(value: number): string {
  return new Date(value * 1000).toLocaleDateString();
}

export function connectionRouteTarget(conn: Connection): string {
  const chain = conn.chains || [];
  if (chain.includes('DIRECT')) return 'DIRECT';
  if (chain.some((item) => item === 'REJECT' || item === 'REJECT-DROP')) return 'REJECT';
  return chain[0] || conn.rule || '-';
}

export function routeLabel(target?: string): string {
  if (!target || target === '-') return '未知链路';
  if (target === 'DIRECT') return '直连 DIRECT';
  if (target === 'REJECT' || target === 'REJECT-DROP') return '拦截 REJECT';
  return `代理 ${target}`;
}

export function routeClass(conn: Connection): string {
  const target = connectionRouteTarget(conn);
  if (target === 'DIRECT') return 'routePill direct';
  if (target === 'REJECT' || target === 'REJECT-DROP') return 'routePill reject';
  return 'routePill proxy';
}

export function resolveConcreteNode(proxies: Record<string, ProxyNode>, startName: string): string {
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

export function latestDelay(node: ProxyNode): number {
  const history = node.history || [];
  const latest = history[history.length - 1];
  if (!latest || latest.delay <= 0) return Number.MAX_SAFE_INTEGER;
  return latest.delay;
}

export function formatDelay(node: ProxyNode): string {
  if (node.alive === false) return 'Error';
  const delay = latestDelay(node);
  if (delay === Number.MAX_SAFE_INTEGER) return '- ms';
  return `${delay} ms`;
}

export function isDelayTestable(node?: ProxyNode): boolean {
  if (!node) return false;
  if (Array.isArray(node.all) && node.all.length > 0) return false;
  return !['Compatible', 'Selector', 'URLTest', 'Fallback', 'LoadBalance', 'Relay'].includes(node.type || '');
}

export function delayClass(node: ProxyNode): string {
  if (node.alive === false) return 'error';
  const delay = latestDelay(node);
  if (delay === Number.MAX_SAFE_INTEGER) return 'unknown';
  if (delay <= 200) return 'fast';
  if (delay <= 500) return 'good';
  if (delay <= 1000) return 'slow';
  return 'bad';
}
