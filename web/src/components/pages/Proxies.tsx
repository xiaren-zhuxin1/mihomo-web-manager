import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Check, Gauge, RefreshCw, Zap } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import { formatDelay, delayClass, latestDelay, readError, isDelayTestable } from '../../utils/helpers';
import type { ProxyGroup, ProxyNode } from '../../types';

export function Proxies({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [groups, setGroups] = useState<ProxyGroup[]>([]);
  const [proxyMap, setProxyMap] = useState<Record<string, ProxyNode>>({});
  const [selectedGroup, setSelectedGroup] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'delay'>('delay');
  const [error, setError] = useState('');
  const [geoCache, setGeoCache] = useState<Record<string, { country: string; city: string; region: string }>>({});

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

  const loadGeoForNode = async (proxyName: string) => {
    if (geoCache[proxyName]) return;
    try {
      const geoData = await api<{ country?: string; city?: string; region?: string }>(
        `/api/proxy/${encodeURIComponent(proxyName)}/geo`
      );
      setGeoCache((current) => ({
        ...current,
        [proxyName]: {
          country: geoData.country || '',
          city: geoData.city || '',
          region: geoData.region || ''
        }
      }));
    } catch {
    }
  };

  const group = groups.find((item) => item.name === selectedGroup);
  const selectableGroup = group ? ['Selector', 'Compatible'].includes(group.type) : false;
  const autoGroup = group ? ['URLTest', 'Fallback', 'LoadBalance'].includes(group.type) : false;
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

  useEffect(() => {
    if (!group || !nodes.length) return;
    const nodesToLoad = nodes.filter(n => !geoCache[n.name] && isDelayTestable(n));
    nodesToLoad.slice(0, 5).forEach(n => loadGeoForNode(n.name));
  }, [selectedGroup, nodes]);

  const selectProxy = async (proxyName: string) => {
    if (!group) return;
    setBusy(true);
    try {
      await api(`/api/mihomo/proxies/${encodeURIComponent(group.name)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: proxyName })
      });
      setGroups((current) =>
        current.map((g) =>
          g.name === group.name ? { ...g, now: proxyName } : g
        )
      );
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
      setError(`${proxyName} 是 ${node?.type || 'Unknown'} 类型，不能直接测速。请选择具体出出站节点，或对策略组执行全组测速。`);
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
      <FlowHint upstream={{ label: '订阅管理 - 节点来源', page: 'subscriptions' }} downstream={{ label: '规则命中 - 分流规则', page: 'rules' }} />
      <Panel title={`策略组 (${groups.length})`} icon={<Zap size={18} />}>
        <div className="list">
          {groups.map((item) => {
            const isSelectable = ['Selector', 'Compatible'].includes(item.type);
            const isAuto = ['URLTest', 'Fallback', 'LoadBalance'].includes(item.type);
            return (
              <button key={item.name} className={item.name === selectedGroup ? 'row active' : 'row'} onClick={() => setSelectedGroup(item.name)}>
                <div className="groupName">
                  <span className="groupNameText">{item.name}</span>
                  {isSelectable && <span className="badge selectable">手动</span>}
                  {isAuto && <span className="badge auto">自动</span>}
                </div>
                <div className="groupNow">
                  {item.now && <span className="nowNode">{item.now}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel title={group ? `${group.name} · ${group.type} · ${group.all?.length || 0} 节点` : '节点'} icon={<Activity size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        {group && selectableGroup && <p className="inlineHint">点击节点卡片即可选用。当前策略组支持手动选择节点。</p>}
        {group && autoGroup && <p className="inlineHint">当前策略组为 {group.type} 自动选择模式，内核根据策略自动切换节点。仅 Selector/Compatible 类型支持手动选用。</p>}
        {group && !selectableGroup && !autoGroup && <p className="inlineHint">当前策略组类型为 {group.type}，不支持手动选用节点。</p>}
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
          {nodes.map((node) => {
            const isSelected = group?.now === node.name;
            const canSelect = selectableGroup;
            return (
              <div
                key={node.name}
                className={`nodeCard${isSelected ? ' selected' : ''}${canSelect ? ' clickable' : ''}`}
                onClick={() => canSelect && selectProxy(node.name)}
                style={{ cursor: canSelect ? 'pointer' : 'default' }}
              >
                <div className="nodeMain">
                  <span>{node.name}</span>
                  {isSelected && <Check size={16} className="selectedCheck" />}
                </div>
                <div className="badgeRow">
                  <span className="badge">{node.type || 'Unknown'}</span>
                  {node.udp && <span className="badge">UDP</span>}
                  {node.providerName && <span className="badge">{node.providerName}</span>}
                  {(geoCache[node.name]?.country || geoCache[node.name]?.city) && (
                    <span className="badge region">{geoCache[node.name]?.country || ''}{geoCache[node.name]?.city ? ` ${geoCache[node.name]?.city}` : ''}</span>
                  )}
                  <span className={`delay ${delayClass(node)}`}>{formatDelay(node)}</span>
                </div>
                <div className="nodeActions">
                  {canSelect && !isSelected && (
                    <button className="selectButton" onClick={(event) => { event.stopPropagation(); selectProxy(node.name); }}>
                      选用
                    </button>
                  )}
                  {isSelected && <span className="currentLabel">当前节点</span>}
                  <button
                    className="testButton"
                    onClick={(event) => { event.stopPropagation(); testProxy(node.name); }}
                    disabled={!isDelayTestable(node)}
                  >
                    <Gauge size={15} />
                    测速
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
