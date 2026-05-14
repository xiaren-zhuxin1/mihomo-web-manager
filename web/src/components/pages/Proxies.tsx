import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Check, ChevronRight, Gauge, Globe, RefreshCw, Zap, ArrowLeft } from 'lucide-react';
import { Panel, FlowHint } from '../ui';
import { api } from '../../services/api';
import { formatDelay, delayClass, latestDelay, readError, isDelayTestable } from '../../utils/helpers';
import { useGeoCache } from '../../hooks/useGeoCache';
import type { ProxyGroup, ProxyNode } from '../../types';

const PROXY_GROUP_KEY = 'mwm-selected-proxy-group';

const GROUP_TYPES = ['Selector', 'URLTest', 'Fallback', 'LoadBalance', 'Compatible'];

// 判断节点是否是策略组
const isNodeGroup = (node: ProxyNode) => {
  return GROUP_TYPES.includes(node.type || '') || (node.all && node.all.length > 0);
};

// 判断策略组是否支持手动选择
const isSelectableType = (type: string) => ['Selector', 'Compatible', 'Fallback'].includes(type);

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
  const isSelectable = group ? isSelectableType(group.type) : false;
  const isAuto = group ? ['URLTest', 'LoadBalance'].includes(group.type) : false;

  // 获取当前组的节点列表
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

  // 选择节点作为当前策略组的选中节点
  const selectNode = async (nodeName: string) => {
    if (!group || !isSelectable) return;
    setBusy(true);
    try {
      await api(`/api/mihomo/proxies/${encodeURIComponent(group.name)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: nodeName })
      });
      // 更新本地状态
      setGroups((current) =>
        current.map((g) =>
          g.name === group.name ? { ...g, now: nodeName } : g
        )
      );
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  // 进入子策略组
  const enterGroup = (groupName: string) => {
    setSelectedGroup(groupName);
    setFilter('');
  };

  // 测试单个节点延迟
  const testNodeDelay = async (nodeName: string) => {
    const node = proxyMap[nodeName];
    if (!isDelayTestable(node)) {
      setError(`${nodeName} 是 ${node?.type || 'Unknown'} 类型，不能直接测速。`);
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ delay?: number }>(
        `/api/mihomo/proxies/${encodeURIComponent(nodeName)}/delay?timeout=5000&url=${encodeURIComponent('https://www.gstatic.com/generate_204')}`
      );
      const delay = typeof data.delay === 'number' ? data.delay : 0;
      setProxyMap((current) => ({
        ...current,
        [nodeName]: {
          ...(current[nodeName] || ({ name: nodeName, type: 'Unknown' } as ProxyNode)),
          alive: delay > 0,
          history: [
            ...((current[nodeName]?.history || []).slice(-4)),
            { time: new Date().toISOString(), delay }
          ]
        }
      }));
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  // 测试整个策略组
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

  // 测试地区
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

  const geoStats = useMemo(() => {
    const testableNodes = nodes.filter(n => isDelayTestable(n));
    const total = testableNodes.length;
    const cached = testableNodes.filter((n) => geoCache[n.name]).length;
    return { cached, total };
  }, [nodes, geoCache]);

  return (
    <div className="split">
      <FlowHint upstream={{ label: '订阅管理 - 节点来源', page: 'subscriptions' }} downstream={{ label: '规则命中 - 分流规则', page: 'rules' }} />
      
      {/* 左侧：策略组列表 */}
      <Panel title={`策略组 (${groups.length})`} icon={<Zap size={18} />}>
        <div className="list">
          {groups.map((item) => {
            const groupSelectable = isSelectableType(item.type);
            const groupAuto = ['URLTest', 'LoadBalance'].includes(item.type);
            const isActive = item.name === selectedGroup;
            return (
              <button 
                key={item.name} 
                className={isActive ? 'row active' : 'row'} 
                onClick={() => setSelectedGroup(item.name)}
              >
                <div className="groupName">
                  <span className="groupNameText">{item.name}</span>
                  {groupSelectable && <span className="badge selectable">可切换</span>}
                  {groupAuto && <span className="badge auto">自动</span>}
                </div>
                <div className="groupNow">
                  {item.now && (
                    <span className={`nowNode ${item.now === 'DIRECT' ? 'direct' : ''}`}>
                      {item.now}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* 右侧：节点列表 */}
      <Panel 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} />
            {group ? `${group.name} · ${group.type}` : '节点'}
          </div>
        } 
        icon={null}
      >
        {error && <p className="inlineError">{error}</p>}
        
        {/* 提示信息 */}
        {group && isSelectable && (
          <p className="inlineHint">
            当前策略组支持手动切换节点。点击"选用"按钮选择该节点，点击"进入"按钮管理子策略组。
          </p>
        )}
        {group && isAuto && (
          <p className="inlineHint">
            当前策略组为 {group.type} 自动选择模式，内核会自动选择最优节点。
          </p>
        )}
        {group && !isSelectable && !isAuto && (
          <p className="inlineHint">
            当前策略组类型为 {group.type}，不支持手动选用节点。
          </p>
        )}

        {/* 工具栏 */}
        <div className="toolbar">
          <input 
            className="searchInput" 
            placeholder="筛选节点" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)} 
          />
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

        {/* 节点卡片网格 */}
        <div className="nodeCardGrid">
          {nodes.map((node) => {
            const isSelected = group?.now === node.name;
            const nodeIsGroup = isNodeGroup(node);
            const geoStatus = getGeoStatus(node.name);
            
            return (
              <div
                key={node.name}
                className={`nodeCard${isSelected ? ' selected' : ''}${nodeIsGroup ? ' isGroup' : ''}`}
              >
                {/* 节点信息 */}
                <div className="nodeMain">
                  <span>{node.name}</span>
                  {isSelected && <Check size={16} className="selectedCheck" />}
                </div>

                {/* 标签行 */}
                <div className="badgeRow">
                  {nodeIsGroup ? (
                    <span className="badge groupBadge">策略组 · {node.type}</span>
                  ) : (
                    <span className="badge">{node.type || 'Unknown'}</span>
                  )}
                  {node.udp && <span className="badge">UDP</span>}
                  {node.providerName && <span className="badge">{node.providerName}</span>}
                  {geoStatus.status === 'cached' && geoStatus.info && (
                    <span className="badge region" title={`IP: ${geoStatus.info.ip}`}>
                      {geoStatus.info.country}{geoStatus.info.city ? ` ${geoStatus.info.city}` : ''}
                    </span>
                  )}
                  {geoStatus.status === 'testing' && <span className="badge testing">检测中</span>}
                  <span className={`delay ${delayClass(node)}`}>{formatDelay(node)}</span>
                </div>

                {/* 操作按钮 */}
                <div className="nodeActions">
                  {/* 选用按钮 - 仅对支持手动选择的策略组显示 */}
                  {isSelectable && !isSelected && (
                    <button 
                      className="selectButton" 
                      onClick={() => selectNode(node.name)}
                    >
                      选用
                    </button>
                  )}
                  {isSelected && (
                    <span className="currentLabel">当前节点</span>
                  )}

                  {/* 进入按钮 - 仅对子策略组显示 */}
                  {nodeIsGroup && (
                    <button 
                      className="enterButton" 
                      onClick={() => enterGroup(node.name)}
                    >
                      进入 <ChevronRight size={14} />
                    </button>
                  )}

                  {/* 测速按钮 - 仅对非策略组节点显示 */}
                  {!nodeIsGroup && (
                    <button
                      className="testButton"
                      onClick={() => testNodeDelay(node.name)}
                      disabled={!isDelayTestable(node)}
                    >
                      <Gauge size={15} />
                      测速
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
