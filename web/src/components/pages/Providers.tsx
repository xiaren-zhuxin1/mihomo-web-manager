import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Gauge, Globe, ListTree, RefreshCw, RotateCcw } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import { formatDelay, delayClass, latestDelay, readError, isDelayTestable, formatDate, validDate } from '../../utils/helpers';
import { useGeoCache } from '../../hooks/useGeoCache';
import type { ProxyNode, Provider } from '../../types';

export function Providers({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'delay' | 'name'>('delay');
  const [error, setError] = useState('');
  const [testingGeo, setTestingGeo] = useState(false);
  const { geoCache, loadGeoForNodes, getGeoStatus, loadAllCache } = useGeoCache();

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

  const testAllGeo = async () => {
    if (!provider || testingGeo) return;
    setTestingGeo(true);
    try {
      const nodeNames = (provider.proxies || []).map((n) => n.name);
      await loadGeoForNodes(nodeNames, 3);
    } finally {
      setTestingGeo(false);
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

  const geoStats = useMemo(() => {
    if (!provider) return { cached: 0, total: 0 };
    const total = (provider.proxies || []).length;
    const cached = (provider.proxies || []).filter((n) => geoCache[n.name]).length;
    return { cached, total };
  }, [provider, geoCache]);

  return (
    <div className="split">
      <FlowHint upstream={{ label: '订阅管理 - 节点来源', page: 'subscriptions' }} downstream={{ label: '代理策略 - 节点选择', page: 'proxies' }} />
      <Panel title={`节点资源 (${providers.length})`} icon={<ListTree size={18} />}>
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
      <Panel title={provider ? `${provider.name} · ${nodes.length}/${provider.proxies?.length || 0} 节点` : '资源节点'} icon={<Activity size={18} />}>
        {provider ? (
          <>
            <div className="providerSummary">
              <Metric label="类型" value={provider.vehicleType || provider.type || '-'} />
              <Metric label="测试地址" value={provider.testUrl || '-'} />
              <Metric label="更新时间" value={validDate(provider.updatedAt) ? formatDate(provider.updatedAt!) : '未更新'} />
              <Metric label="地区已测" value={`${geoStats.cached}/${geoStats.total}`} />
            </div>
            <div className="toolbar">
              <input className="searchInput" placeholder="筛选节点、类型、资源" value={filter} onChange={(event) => setFilter(event.target.value)} />
              <button className={sort === 'delay' ? 'activeMode' : ''} onClick={() => setSort('delay')}>延迟</button>
              <button className={sort === 'name' ? 'activeMode' : ''} onClick={() => setSort('name')}>名称</button>
              <button onClick={() => healthCheckProvider(provider.name)}>
                <Gauge size={16} />
                测速
              </button>
              <button onClick={testAllGeo} disabled={testingGeo}>
                <Globe size={16} />
                {testingGeo ? '检测中...' : '测地区'}
              </button>
            </div>
            <div className="providerNodeGrid">
              {nodes.map((node) => {
                const geoStatus = getGeoStatus(node.name);
                return (
                  <div className="providerNodeCard" key={`${provider.name}-${node.name}`}>
                    <div className="nodeMainText">
                      <strong>{node.name}</strong>
                      <span>{node.providerName || node['provider-name'] || provider.name}</span>
                    </div>
                    <div className="badgeRow">
                      <span className="badge">{node.type || 'Unknown'}</span>
                      {node.udp && <span className="badge">UDP</span>}
                      {geoStatus.status === 'cached' && geoStatus.info && (
                        <span className="badge region" title={`IP: ${geoStatus.info.ip} | 来源: ${geoStatus.info.source}`}>
                          {geoStatus.info.country}{geoStatus.info.city ? ` ${geoStatus.info.city}` : ''}
                        </span>
                      )}
                      {geoStatus.status === 'testing' && <span className="badge testing">检测中</span>}
                      {geoStatus.status === 'failed' && <span className="badge failed">检测失败</span>}
                      {geoStatus.status === 'not_tested' && <span className="badge not_tested">未检测</span>}
                      <span className={node.alive === false ? 'statusPill bad' : node.alive === true ? 'statusPill good' : 'statusPill'}>{node.alive === false ? '异常' : node.alive === true ? '正常' : '未知'}</span>
                      <span className={`delay ${delayClass(node)}`}>{formatDelay(node)}</span>
                    </div>
                    <button className="testButton" onClick={() => testProxy(node.name)} disabled={!isDelayTestable(node)}>
                      <Gauge size={15} />
                      测速
                    </button>
                  </div>
                );
              })}
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
            <button className="iconButton" title="资源测速" onClick={() => onHealthCheck(item.name)}>
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
