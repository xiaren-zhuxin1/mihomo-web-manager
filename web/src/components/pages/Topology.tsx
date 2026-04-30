import React, { useEffect, useState, useMemo } from 'react';
import { ListTree, Shield, Settings2, Zap, Globe2, List } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { formatDelay, resolveConcreteNode, routeLabel, readError } from '../../utils/helpers';
import type { ProxyNode } from '../../types';

type RuntimeRule = {
  index: number;
  type: string;
  payload: string;
  proxy: string;
  extra?: { hitCount?: number };
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Topology() {
  const { setBusy } = useApp();
  const [proxyMap, setProxyMap] = useState<Record<string, ProxyNode>>({});
  const [rules, setRules] = useState<RuntimeRule[]>([]);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const [proxyData, ruleData] = await Promise.all([
        api.get<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies'),
        api.get<{ rules: RuntimeRule[] }>('/api/mihomo/rules')
      ]);
      setProxyMap(proxyData.proxies || {});
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

  const groups = useMemo(
    () => Object.values(proxyMap).filter(proxy => Array.isArray(proxy.all) && proxy.all.length > 0),
    [proxyMap]
  );

  const ruleTargets = useMemo(() => {
    const counts = new Map<string, number>();
    rules.forEach(rule => counts.set(rule.proxy || '-', (counts.get(rule.proxy || '-') || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rules]);

  const visibleRules = selectedTarget ? rules.filter(rule => rule.proxy === selectedTarget) : rules.slice(0, 120);
  const directRuleCount = rules.filter(rule => rule.proxy === 'DIRECT').length;
  const rejectRuleCount = rules.filter(rule => ['REJECT', 'REJECT-DROP'].includes(rule.proxy)).length;

  return (
    <div className="stack">
      <PageGuide page="topology" />
      
      {error && <p className="inlineError">{error}</p>}
      
      <div className="grid">
        <Panel title="关系总览" icon={<ListTree size={18} />}>
          <Metric label="策略组" value={String(groups.length)} />
          <Metric label="规则数" value={String(rules.length)} />
        </Panel>
        
        <Panel title="直连/拦截" icon={<Shield size={18} />}>
          <Metric label="DIRECT 规则" value={String(directRuleCount)} />
          <Metric label="REJECT 规则" value={String(rejectRuleCount)} />
        </Panel>
        
        <Panel title="维护入口" icon={<Settings2 size={18} />}>
          <Metric label="策略组维护" value="代理页选择、测速、切换" />
          <Metric label="规则维护" value="规则页按策略目标筛选" />
        </Panel>
      </div>
      
      <div className="topologyLayout">
        <Panel title="策略组 ER" icon={<Zap size={18} />}>
          <div className="topologyList">
            {groups.map(group => {
              const concrete = resolveConcreteNode(proxyMap, group.now || group.name);
              const groupRuleCount = rules.filter(rule => rule.proxy === group.name).length;
              const concreteRuleCount = rules.filter(rule => rule.proxy === concrete).length;
              const nodeInfo = proxyMap[concrete];
              
              return (
                <div className="topologyCard" key={group.name}>
                  <div className="topologyHead">
                    <strong>{group.name}</strong>
                    <span>{group.type}</span>
                  </div>
                  <div className="flowLine">
                    <span>规则 {groupRuleCount}</span>
                    <b>→</b>
                    <span>{group.now || '-'}</span>
                    <b>→</b>
                    <span>{concrete}</span>
                  </div>
                  <div className="ruleMeta">
                    <span>可选节点：{group.all?.length || 0}</span>
                    <span>命中具体节点的规则：{concreteRuleCount}</span>
                    <span>当前延迟：{nodeInfo ? formatDelay(nodeInfo.history?.[0]?.delay || 0, nodeInfo.alive) : '- ms'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        
        <Panel title="规则目标分布" icon={<Globe2 size={18} />}>
          <div className="targetList">
            <button
              className={!selectedTarget ? 'targetRow active' : 'targetRow'}
              onClick={() => setSelectedTarget('')}
            >
              <span>全部规则</span>
              <strong>{rules.length}</strong>
            </button>
            {ruleTargets.map(([target, count]) => (
              <button
                key={target}
                className={selectedTarget === target ? 'targetRow active' : 'targetRow'}
                onClick={() => setSelectedTarget(target)}
              >
                <span>{target}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      
      <Panel title={selectedTarget ? `规则明细：${selectedTarget}` : '规则明细：前 120 条'} icon={<List size={18} />}>
        <div className="ruleList compact">
          {visibleRules.map(rule => (
            <div className="ruleCard" key={`${rule.index}-${rule.type}-${rule.payload}`}>
              <div className="ruleIndex">#{rule.index}</div>
              <div className="ruleBody">
                <div className="ruleMain">
                  <span className="badge">{rule.type}</span>
                  <strong>{rule.payload || '-'}</strong>
                </div>
                <div className="ruleMeta">
                  <span>目标：{rule.proxy || '-'}</span>
                  <span>命中：{rule.extra?.hitCount || 0}</span>
                  <span>{routeLabel(rule.proxy)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
