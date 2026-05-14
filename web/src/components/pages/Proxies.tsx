import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Check, Gauge, Globe, RefreshCw, Zap } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import { formatDelay, delayClass, latestDelay, readError, isDelayTestable } from '../../utils/helpers';
import { useGeoCache } from '../../hooks/useGeoCache';
import type { ProxyGroup, ProxyNode } from '../../types';

const PROXY_GROUP_KEY = 'mwm-selected-proxy-group';

export function Proxies({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [groups, setGroups] = useState<ProxyGroup[]>([]);
  const [proxyMap, setProxyMap] = useState<Record<string, ProxyNode>>({});
  const [selectedGroup, setSelectedGroup] = useState(() => localStorage.getItem(PROXY_GROUP_KEY) || '');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'delay'>('delay');
  const [error, setError] = useState('');
  const [testingGeo, setTestingGeo] = useState(false);
  const { geoCache, loadGeoForNodes, getGeoStatus } = useGeoCache();

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies');
      const next = Object.values(data.proxies).filter((proxy) => Array.isArray(proxy.all) && proxy.all.length > 0);
      setProxyMap(data.proxies || {});
      setGroups(next);
      const saved = localStorage.getItem(PROXY_GROUP_KEY);
      const exists = saved && next.some((g) => g.name === saved);
      setSelectedGroup((current) => {
        if (exists) return saved || '';
        return current || next[0]?.name || '';
      });
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

  useEffect(() => {
    if (selectedGroup) {
      localStorage.setItem(PROXY_GROUP_KEY, selectedGroup);
    }
  }, [selectedGroup]);

  const group = groups.find((item) => item.name === selectedGroup);
  const selectableGroup = group ? ['Selector', 'Compatible', 'Fallback'].includes(group.type) : false;
  const autoGroup = group ? ['URLTest', 'LoadBalance'].includes(group.type) : false;
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

  const testAllGeo = async () => {
    if (!group || testingGeo) return;
    setTestingGeo(true);
    try {
      const nodeNames = nodes.filter(n => isDelayTestable(n)).map(n => n.name);
      await loadGeoForNodes(nodeNames, 3);
    } finally {
      setTestingGeo(false);
    }
  };

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

  const geoStats = useMemo(() => {
    const testableNodes = nodes.filter(n => isDelayTestable(n));
    const total = testableNodes.length;
    const cached = testableNodes.filter((n) => geoCache[n.name]).length;
    return { cached, total };
  }, [nodes, geoCache]);

  return (
    <div className="split">
      <FlowHint upstream={{ label: '订阅管理 - 节点来源', page: 'subscriptions' }} downstream={{ label: '规则命中 - 分流规则', page: 'rules' }} />
      <Panel title={`策略组 (${groups.length})`} icon={<Zap size={18} />}>
        <div className="list">
          {groups.map((item) => {
            const isSelectable = ['Selector', 'Compatible', 'Fallback'].includes(item.type);
            const isAuto = ['URLTest', 'LoadBalance'].includes(item.type);
            return (
              <button key={item.name} className={item.name === selectedGroup ? 'row active' : 'row'} onClick={() => setSelectedGroup(item.name)}>
                <div className="groupName">
                  <span className="groupNameText">{item.name}</span>
                  {isSelectable && <span className="badge selectable">可切换</span>}
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
        {group && selectableGroup && <p className="inlineHint">点击节点卡片即可选用。当前策略组支持手动切换节点。</p>}
        {group && autoGroup && <p className="inlineHint">当前策略组为 {group.type} 自动选择模式，内核根据策略自动切换节点。如需手动选择，请切换到标记为"可切换"的策略组（如 GLOBAL、PROXY、HK 等）。</p>}
        {group && !selectableGroup && !autoGroup && <p className="inlineHint">当前策略组类型为 {group.type}，不支持手动选用节点。</p>}
        <div className="toolbar">
          <input className="searchInput" placeholder="筛选节点或类型" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <button className={sort === 'delay' ? 'activeMode' : ''} onClick={() => setSort('delay')}>延迟</button>
          <button className={sort === 'name' ? 'activeMode' : ''} onClick={() => setSort('name')}>名称</button>
          <button onClick={testGroup}>
            <Gauge size={16} />
            全组测速
          </button>
          <button onClick={testAllGeo} disabled={testingGeo}>
            <Globe size={16} />
            {testingGeo ? '检测中...' : '测地区'}
          </button>
          <button className="iconButton" title="刷新" onClick={load}>
            <RefreshCw size={16} />
          </button>
        </div>
        {geoStats.total > 0 && (
          <p className="inlineHint">地区已测: {geoStats.cached}/{geoStats.total}</p>
        )}
        <div className="nodeCardGrid">
          {nodes.map((node) => {
            const isSelected = group?.now === node.name;
            const canSelect = selectableGroup;
            const geoStatus = getGeoStatus(node.name);
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
                  {geoStatus.status === 'cached' && geoStatus.info && (
                    <span className="badge region" title={`IP: ${geoStatus.info.ip} | 来源: ${geoStatus.info.source}`}>
                      {geoStatus.info.country}{geoStatus.info.city ? ` ${geoStatus.info.city}` : ''}
                    </span>
                  )}
                  {geoStatus.status === 'testing' && <span className="badge testing">检测中</span>}
                  {geoStatus.status === 'failed' && <span className="badge failed">检测失败</span>}
                  {geoStatus.status === 'not_tested' && isDelayTestable(node) && <span className="badge not_tested">未检测</span>}
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
