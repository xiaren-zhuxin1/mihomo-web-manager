import React, { useEffect, useState } from 'react';
import { Activity, FileCode2, Server, Zap, RefreshCw, ListTree } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { formatDelay, delayClass, resolveConcreteNode, latestDelay } from '../../utils/helpers';
import type { ProxyNode, Health } from '../../types';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="sectionNote">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

type CurrentProxy = {
  group: string;
  node: string;
  type: string;
  provider: string;
  delay: string;
  delayClass: string;
  healthy: string;
};

export function Overview({ health, onRefresh }: { health: Health | null; onRefresh: () => void }) {
  const { showToast } = useApp();
  const [currentProxy, setCurrentProxy] = useState<CurrentProxy | null>(null);
  const [error, setError] = useState('');

  const loadCurrentProxy = async () => {
    try {
      const data = await api.get<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies');
      const groups = Object.values(data.proxies || {}).filter(proxy => Array.isArray(proxy.all) && proxy.all.length > 0);
      const group = groups.find(item => item.name === 'PROXY') ||
        groups.find(item => item.name === 'GLOBAL') ||
        groups.find(item => ['Selector', 'Compatible'].includes(item.type)) ||
        groups[0];
      
      if (!group) {
        setCurrentProxy(null);
        return;
      }
      
      const node = resolveConcreteNode(data.proxies || {}, group.now || group.name);
      const nodeInfo = data.proxies[node];
      const delay = nodeInfo ? latestDelay(nodeInfo.history) : Number.MAX_SAFE_INTEGER;
      
      setCurrentProxy({
        group: group.name,
        node,
        type: nodeInfo?.type || group.type || '-',
        provider: (nodeInfo as any)?.providerName || (nodeInfo as any)?.['provider-name'] || '-',
        delay: formatDelay(delay, nodeInfo?.alive),
        delayClass: delayClass(delay, nodeInfo?.alive),
        healthy: nodeInfo?.alive === false ? '异常' : nodeInfo?.alive === true ? '正常' : '未知'
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    loadCurrentProxy();
    const interval = setInterval(loadCurrentProxy, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await loadCurrentProxy();
    onRefresh();
  };

  return (
    <div className="stack">
      <PageGuide page="overview" />
      
      <div className="grid">
        <Panel title="控制器" icon={<Activity size={18} />}>
          <Metric label="状态" value={health?.ok ? 'Online' : 'Unknown'} />
          <Metric label="地址" value={health?.mihomoController || '-'} />
        </Panel>
        <Panel title="配置文件" icon={<FileCode2 size={18} />}>
          <Metric label="路径" value={health?.mihomoConfigPath || '-'} />
          <Metric label="系统" value={health?.os || '-'} />
        </Panel>
        <Panel title="服务模式" icon={<Server size={18} />}>
          <Metric label="模式" value={health?.serviceMode || '-'} />
          <Metric label="令牌保护" value={health?.managerTokenActive ? 'Enabled' : 'Disabled'} />
        </Panel>
      </div>
      
      <Panel title="当前节点" icon={<Zap size={18} />} onboardingId="proxies">
        {error && <p className="inlineError">{error}</p>}
        <div className="currentProxyBox">
          <div>
            <span>策略组</span>
            <strong>{currentProxy?.group || '-'}</strong>
          </div>
          <div>
            <span>节点</span>
            <strong>{currentProxy?.node || '-'}</strong>
          </div>
          <div>
            <span>类型</span>
            <strong>{currentProxy?.type || '-'}</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>{currentProxy?.provider || '-'}</strong>
          </div>
          <div>
            <span>健康</span>
            <strong>{currentProxy?.healthy || '-'}</strong>
          </div>
          <div>
            <span>延迟</span>
            <strong className={`delay inlineDelay ${currentProxy?.delayClass || 'unknown'}`}>
              {currentProxy?.delay || '- ms'}
            </strong>
          </div>
          <button onClick={handleRefresh}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
      </Panel>
      
      <Panel title="控制台分区" icon={<ListTree size={18} />}>
        <div className="sectionGrid">
          <SectionNote title="代理" body="策略组、节点选择、运行态切换，参考 MetaCubeXD / Zashboard 的 dashboard 视角。" />
          <SectionNote title="订阅" body="新增订阅、Manager 接管订阅、配置残留诊断，参考 Clash Verge 的 profile 管理视角。" />
          <SectionNote title="资源 / 规则" body="展示 mihomo 当前实际加载的代理资源与规则资源。" />
          <SectionNote title="配置 / 服务" body="服务器本机配置文件、备份、reload、Docker 或 systemd 生命周期控制。" />
        </div>
        <button className="primary" onClick={onRefresh}>
          <RefreshCw size={16} />
          刷新状态
        </button>
      </Panel>
    </div>
  );
}
