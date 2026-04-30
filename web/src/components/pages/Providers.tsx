import React, { useEffect, useState, useMemo } from 'react';
import { ListTree, Activity, RefreshCw, RotateCcw, Gauge } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { formatDelay, delayClass, latestDelay, readError } from '../../utils/helpers';
import type { ProxyNode } from '../../types';

type Provider = {
  name: string;
  type?: string;
  vehicleType?: string;
  testUrl?: string;
  updatedAt?: string;
  proxies?: ProxyNode[];
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function isDelayTestable(node?: ProxyNode): boolean {
  if (!node) return false;
  const type = node.type?.toLowerCase() || '';
  return !['direct', 'reject', 'reject-drop', 'dns', 'pass', 'compatible', 'fallback', 'url-test', 'load-balance', 'selector', 'relay', 'urltest'].includes(type);
}

export function Providers() {
  const { setBusy, showToast } = useApp();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'delay' | 'name'>('delay');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api.get<{ providers: Record<string, Provider> }>('/api/mihomo/providers/proxies');
      const next = Object.entries(data.providers || {}).map(([name, value]) => ({ ...value, name }));
      setProviders(next);
      setSelectedProvider(current => current || next[0]?.name || '');
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
      await api.put(`/api/mihomo/providers/proxies/${encodeURIComponent(name)}`, {});
      showToast('success', `资源 ${name} 已更新`);
      await load();
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const healthCheckProvider = async (name: string) => {
    setBusy(true);
    try {
      await api.get(`/api/mihomo/providers/proxies/${encodeURIComponent(name)}/healthcheck`);
      showToast('success', `资源 ${name} 测速完成`);
      await load();
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateAllProviders = async () => {
    setBusy(true);
    try {
      for (const item of providers) {
        if (item.vehicleType !== 'Compatible') {
          await api.put(`/api/mihomo/providers/proxies/${encodeURIComponent(item.name)}`, {});
        }
      }
      showToast('success', '所有资源已更新');
      await load();
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const testProxy = async (proxyName: string) => {
    const node = providers.flatMap(item => item.proxies || []).find(item => item.name === proxyName);
    if (!isDelayTestable(node)) {
      showToast('error', `${proxyName} 是 ${node?.type || 'Unknown'} 类型，不能直接测速。`);
      return;
    }
    setBusy(true);
    try {
      const data = await api.get<{ delay?: number }>(
        `/api/mihomo/proxies/${encodeURIComponent(proxyName)}/delay?timeout=5000&url=${encodeURIComponent('https://www.gstatic.com/generate_204')}`
      );
      const delay = typeof data.delay === 'number' ? data.delay : 0;
      setProviders(current =>
        current.map(provider => ({
          ...provider,
          proxies: (provider.proxies || []).map(proxy =>
            proxy.name === proxyName
              ? {
                  ...proxy,
                  alive: delay > 0,
                  history: [...(proxy.history || []).slice(-4), { time: new Date().toISOString(), delay }]
                }
              : proxy
          )
        }))
      );
      showToast('success', `${proxyName} 延迟: ${delay}ms`);
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const provider = providers.find(item => item.name === selectedProvider);
  const query = filter.trim().toLowerCase();

  const nodes = useMemo(() => {
    const list = (provider?.proxies || []).filter(node => {
      const text = [node.name, node.type].join(' ').toLowerCase();
      return !query || text.includes(query);
    });
    return [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : latestDelay(a.history) - latestDelay(b.history)
    );
  }, [filter, provider, sort]);

  return (
    <div className="split">
      <PageGuide page="providers" />
      
      <Panel title={`代理资源 (${providers.length})`} icon={<ListTree size={18} />}>
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

        <div className="providerGrid">
          {providers.map(item => (
            <div
              className={item.name === selectedProvider ? 'providerCard selected' : 'providerCard'}
              key={item.name}
            >
              <button className="providerSelect" onClick={() => setSelectedProvider(item.name)}>
                <strong>{item.name}</strong>
                <span>{item.type || item.vehicleType || '资源'}</span>
              </button>
              <div className="providerActions">
                <button
                  className="iconButton"
                  title="更新资源"
                  onClick={() => updateProvider(item.name)}
                  disabled={item.vehicleType === 'Compatible'}
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  className="iconButton"
                  title="资源测速"
                  onClick={() => healthCheckProvider(item.name)}
                >
                  <Gauge size={16} />
                </button>
              </div>
              <Metric label="节点数" value={String(item.proxies?.length || 0)} />
            </div>
          ))}
          {providers.length === 0 && <p className="empty">没有读取到代理资源</p>}
        </div>
      </Panel>

      <Panel
        title={provider ? `${provider.name} · ${nodes.length}/${provider.proxies?.length || 0} 节点` : '节点资源'}
        icon={<Activity size={18} />}
      >
        {provider ? (
          <>
            <div className="providerSummary">
              <Metric label="类型" value={provider.vehicleType || provider.type || '-'} />
              <Metric label="测试地址" value={provider.testUrl || '-'} />
            </div>

            <div className="toolbar">
              <input
                className="searchInput"
                placeholder="筛选节点、类型"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <button className={sort === 'delay' ? 'activeMode' : ''} onClick={() => setSort('delay')}>
                延迟
              </button>
              <button className={sort === 'name' ? 'activeMode' : ''} onClick={() => setSort('name')}>
                名称
              </button>
              <button onClick={() => healthCheckProvider(provider.name)}>
                <Gauge size={16} />
                资源测速
              </button>
            </div>

            <div className="providerNodeGrid">
              {nodes.map(node => (
                <div className="providerNodeCard" key={`${provider.name}-${node.name}`}>
                  <div className="nodeMainText">
                    <strong>{node.name}</strong>
                    <span>{node.type || 'Unknown'}</span>
                  </div>
                  <div className="badgeRow">
                    <span className="badge">{node.type || 'Unknown'}</span>
                    {node.udp && <span className="badge">UDP</span>}
                    <span
                      className={
                        node.alive === false ? 'statusPill bad' :
                        node.alive === true ? 'statusPill good' : 'statusPill'
                      }
                    >
                      {node.alive === false ? '异常' : node.alive === true ? '正常' : '未知'}
                    </span>
                    <span className={`delay ${delayClass(latestDelay(node.history), node.alive)}`}>
                      {formatDelay(latestDelay(node.history), node.alive)}
                    </span>
                  </div>
                  <button
                    className="testButton"
                    onClick={() => testProxy(node.name)}
                    disabled={!isDelayTestable(node)}
                  >
                    <Gauge size={15} />
                    测速
                  </button>
                </div>
              ))}
              {nodes.length === 0 && <p className="empty">没有匹配的节点</p>}
            </div>
          </>
        ) : (
          <p className="empty">请选择一个资源</p>
        )}
      </Panel>
    </div>
  );
}
