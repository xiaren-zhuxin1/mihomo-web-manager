export function readError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (text.includes('unauthorized') || text.includes('401')) {
    return '未授权：当前 WebUI 不再内置 token 输入框，请关闭 MWM_TOKEN，或通过反向代理注入 Authorization。';
  }
  if (text.includes('fetch')) {
    return '无法连接到管理服务，请确认服务已启动';
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

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatExpire(value: number): string {
  return new Date(value * 1000).toLocaleDateString();
}

export function lines(value: string): string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
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

export function usagePercent(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export function parseConfigRule(rule: string): { type: string; payload: string; target: string } {
  const parts = rule.split(',').map(item => item.trim()).filter(Boolean);
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
  const map: Record<string, string> = {
    'DOMAIN-SUFFIX': 'example.com',
    'DOMAIN': 'www.example.com',
    'DOMAIN-KEYWORD': 'google',
    'GEOSITE': 'cn / geolocation-!cn',
    'GEOIP': 'CN',
    'IP-CIDR': '192.168.0.0/16',
    'PROCESS-NAME': 'chrome.exe',
    'MATCH': 'MATCH 不需要内容，可留空'
  };
  return map[type] || '匹配内容';
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
    'DOMAIN': '精确匹配完整域名，例如 www.example.com。',
    'DOMAIN-KEYWORD': '域名包含关键词即匹配，例如 google。',
    'GEOSITE': '使用 mihomo/geosite 内置域名集合，例如 cn。',
    'IP-CIDR': '匹配 IPv4 网段，例如 192.168.0.0/16。',
    'IP-CIDR6': '匹配 IPv6 网段。',
    'GEOIP': '按目标 IP 所属国家/地区匹配，例如 CN。',
    'RULE-SET': '引用规则资源规则集，适合远程或本地规则文件。',
    'PROCESS-NAME': '按进程名匹配，通常仅在客户端或支持进程识别的平台有效。',
    'MATCH': '兜底规则，通常放在最后，匹配所有未命中的连接。'
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

export function delayClass(delay: number, alive?: boolean): string {
  if (alive === false) return 'error';
  if (delay === Number.MAX_SAFE_INTEGER || delay <= 0) return 'unknown';
  if (delay <= 200) return 'fast';
  if (delay <= 500) return 'good';
  if (delay <= 1000) return 'slow';
  return 'bad';
}

export function formatDelay(delay: number, alive?: boolean): string {
  if (alive === false) return 'Error';
  if (delay === Number.MAX_SAFE_INTEGER || delay <= 0) return '- ms';
  return `${delay} ms`;
}

export function latestDelay(history?: Array<{ delay: number }>): number {
  if (!history || history.length === 0) return Number.MAX_SAFE_INTEGER;
  const latest = history[history.length - 1];
  return latest?.delay > 0 ? latest.delay : Number.MAX_SAFE_INTEGER;
}

export function resolveConcreteNode(proxies: Record<string, { all?: string[]; now?: string }>, startName: string): string {
  let current = startName;
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    if (!current || seen.has(current)) break;
    seen.add(current);
    const proxy = proxies[current];
    if (!proxy || !Array.isArray(proxy.all) || !proxy.now) break;
    current = proxy.now;
  }
  return current || startName || '-';
}

export function connectionRouteTarget(conn: { chains?: string[]; rule?: string }): string {
  const chain = conn.chains || [];
  if (chain.includes('DIRECT')) return 'DIRECT';
  if (chain.some(item => item === 'REJECT' || item === 'REJECT-DROP')) return 'REJECT';
  return chain[0] || conn.rule || '-';
}

export function routeLabel(target?: string): string {
  if (!target || target === '-') return '未知链路';
  if (target === 'DIRECT') return '直连 DIRECT';
  if (target === 'REJECT' || target === 'REJECT-DROP') return '拦截 REJECT';
  return `代理 ${target}`;
}

export function routeClass(conn: { chains?: string[]; rule?: string }): string {
  const target = connectionRouteTarget(conn);
  if (target === 'DIRECT') return 'routePill direct';
  if (target === 'REJECT' || target === 'REJECT-DROP') return 'routePill reject';
  return 'routePill proxy';
}
