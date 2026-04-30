import React, { useEffect, useState, useMemo } from 'react';
import { Zap, RefreshCw, Search, ArrowUpDown } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { formatDelay, delayClass, latestDelay, readError } from '../../utils/helpers';
import type { ProxyGroup, ProxyNode } from '../../types';

export function Proxies() {
  const { setBusy, showToast } = useApp();
  const [groups, setGroups] = useState<ProxyGroup[]>([]);
  const [proxyMap, setProxyMap] = useState<Record<string, ProxyNode>>({});
  const [selectedGroup, setSelectedGroup] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'delay'>('delay');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api.get<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies');
      const next = Object.values(data.proxies || {}).filter(proxy => Array.isArray(proxy.all) && proxy.all.length > 0);
      setProxyMap(data.proxies || {});
      setGroups(next);
      setSelectedGroup(current => current || next[0]?.name || '');
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

  const group = groups.find(item => item.name === selectedGroup);
  const nodes = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const list = (group?.all || [])
      .map(name => proxyMap[name] || { name, type: 'Unknown' })
      .filter(node => !query || node.name.toLowerCase().includes(query));
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      return latestDelay(a.history) - latestDelay(b.history);
    });
  }, [filter, group, proxyMap, sort]);

  const selectProxy = async (proxyName: string) => {
    if (!group) return;
    setBusy(true);
    try {
      await api.put(`/api/mihomo/proxies/${encodeURIComponent(group.name)}`, { name: proxyName });
      showToast('success', `已切换到 ${proxyName}`);
      await load();
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const testProxy = async (proxyName: string) => {
    setBusy(true);
    try {
      const data = await api.get<{ delay?: number }>(
        `/api/mihomo/proxies/${encodeURIComponent(proxyName)}/delay?timeout=5000&url=${encodeURIComponent('https://www.gstatic.com/generate_204')}`
      );
      const delay = data.delay || 0;
      
      let country = '';
      let city = '';
      if (delay > 0) {
        try {
          const geoData = await api.get<{ country?: string; city?: string }>(
            `/api/proxy/${encodeURIComponent(proxyName)}/geo`
          );
          country = geoData.country || '';
          city = geoData.city || '';
        } catch {
          // 地区获取失败不影响主流程
        }
      }
      
      setProxyMap(current => ({
        ...current,
        [proxyName]: {
          ...current[proxyName],
          alive: delay > 0,
          country,
          city,
          history: [...(current[proxyName]?.history || []).slice(-4), { delay }]
        }
      }));
      showToast(delay > 0 ? 'success' : 'error', delay > 0 ? `延迟: ${delay}ms` : '节点不可用');
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <PageGuide page="proxies" />
      
      <Panel title="代理策略" icon={<Zap size={18} />}>
        <div className="proxyToolbar">
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
            {groups.map(g => (
              <option key={g.name} value={g.name}>{g.name} ({g.type})</option>
            ))}
          </select>
          <div className="searchBox">
            <Search size={16} />
            <input
              placeholder="筛选节点..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <button onClick={() => setSort(s => s === 'name' ? 'delay' : 'name')}>
            <ArrowUpDown size={16} />
            {sort === 'name' ? '按名称' : '按延迟'}
          </button>
          <button onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
        
        {error && <p className="inlineError">{error}</p>}
        
        <div className="proxyGrid">
          {nodes.map(node => {
            const delay = latestDelay(node.history);
            const isActive = group?.now === node.name;
            const region = (node as any).country || (node as any).city ? `${(node as any).country || ''}${(node as any).city ? ' ' + (node as any).city : ''}`.trim() : '';
            return (
              <div
                key={node.name}
                className={`proxyCard ${isActive ? 'active' : ''}`}
                onClick={() => selectProxy(node.name)}
              >
                <div className="proxyName">{node.name}</div>
                <div className="proxyMeta">
                  <span className="proxyType">{node.type}</span>
                  {region && <span className="proxyRegion">{region}</span>}
                  <span className={`delay ${delayClass(delay, node.alive)}`}>
                    {formatDelay(delay, node.alive)}
                  </span>
                </div>
                <button
                  className="testBtn"
                  onClick={e => { e.stopPropagation(); testProxy(node.name); }}
                >
                  测速
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
