import React, { useEffect, useState, useMemo } from 'react';
import { Globe2, ListTree, RefreshCw } from 'lucide-react';
import { Panel, FlowHint } from '../ui';
import { api } from '../../services/api';
import { readError, routeLabel, formatDate, validDate } from '../../utils/helpers';
import type { RuleProvider, RuntimeRule } from '../../types';

export function Rules({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [providers, setProviders] = useState<RuleProvider[]>([]);
  const [rules, setRules] = useState<RuntimeRule[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const [providerData, ruleData] = await Promise.all([
        api<{ providers: Record<string, RuleProvider> }>('/api/mihomo/providers/rules'),
        api<{ rules: RuntimeRule[] }>('/api/mihomo/rules')
      ]);
      setProviders(Object.entries(providerData.providers || {}).map(([name, value]) => ({ ...value, name })));
      setRules(ruleData.rules || []);
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

  const updateRule = async (name: string) => {
    setBusy(true);
    try {
      await api(`/api/mihomo/providers/rules/${encodeURIComponent(name)}`, { method: 'PUT', body: '{}' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const query = filter.trim().toLowerCase();
  const ruleTargets = useMemo(() => {
    const counts = new Map<string, number>();
    rules.forEach((item) => counts.set(item.proxy || '-', (counts.get(item.proxy || '-') || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rules]);
  const visibleRules = rules.filter((item) => {
    const text = [item.type, item.payload, item.proxy].join(' ').toLowerCase();
    return (!selectedTarget || item.proxy === selectedTarget) && (!query || text.includes(query));
  });

  return (
    <div className="stack">
      <FlowHint upstream={{ label: '代理策略 - 分流目标', page: 'proxies' }} downstream={{ label: '连接追踪 - 连接详情', page: 'connections' }} />
      <Panel title={`规则资源 (${providers.length})`} icon={<Globe2 size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        <div className="table">
          {providers.map((item) => (
            <div className="tableRow" key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.behavior || item.vehicleType || 'rule-provider'} · {item.ruleCount || 0} rules</span>
              </div>
              <button className="iconButton" title="更新规则集" onClick={() => updateRule(item.name)}>
                <RefreshCw size={16} />
              </button>
            </div>
          ))}
          {providers.length === 0 && <p className="empty">没有读取到 rule-provider</p>}
        </div>
      </Panel>
      <Panel title={`已加载规则 (${visibleRules.length}/${rules.length})`} icon={<ListTree size={18} />}>
        <div className="toolbar">
          <input className="searchInput" placeholder="筛选类型、规则内容、策略" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <button className={!selectedTarget ? 'activeMode' : ''} onClick={() => setSelectedTarget('')}>全部</button>
          <button onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
        <div className="targetChips">
          {ruleTargets.slice(0, 24).map(([target, count]) => (
            <button key={target} className={selectedTarget === target ? 'targetChip active' : 'targetChip'} onClick={() => setSelectedTarget(target)}>
              <span>{target}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
        <div className="ruleList">
          {visibleRules.map((item) => (
            <div className={item.extra?.disabled ? 'ruleCard disabled' : 'ruleCard'} key={`${item.index}-${item.type}-${item.payload}`}>
              <div className="ruleIndex">#{item.index}</div>
              <div className="ruleBody">
                <div className="ruleMain">
                  <span className="badge">{item.type}</span>
                  <strong>{item.payload || '-'}</strong>
                </div>
                <div className="ruleMeta">
                  <span>策略：{item.proxy || '-'}</span>
                  <span>命中：{item.extra?.hitCount || 0}</span>
                  <span>未命中：{item.extra?.missCount || 0}</span>
                  <span>大小：{item.size || 0}</span>
                  {item.extra?.hitAt && validDate(item.extra.hitAt) && <span>最近命中：{formatDate(item.extra.hitAt)}</span>}
                </div>
              </div>
            </div>
          ))}
          {visibleRules.length === 0 && <p className="empty">没有匹配的规则</p>}
        </div>
      </Panel>
    </div>
  );
}
