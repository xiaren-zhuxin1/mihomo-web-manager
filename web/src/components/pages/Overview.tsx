import React, { useEffect, useRef, useState } from 'react';
import { Activity, FileCode2, Server, Settings2, Zap } from 'lucide-react';
import { Panel, Metric, FlowHint, setPageGlobal } from '../ui';
import { api } from '../../services/api';
import {
  readError, formatDelay, delayClass, resolveConcreteNode, latestDelay,
  defaultTunForm, tunFormFromDiagnostics, parseTunDnsHijack,
  sameTunForm, readTunReloadError, describeMode, describeLogLevel
} from '../../utils/helpers';
import type { Health, ProxyNode, RuntimeConfig, MihomoVersion, TunDiagnostics, TunForm } from '../../types';

const PROXY_GROUP_KEY = 'mwm-selected-proxy-group';

export function Overview({ health, onRefresh }: { health: Health | null; onRefresh: () => void }) {
  const [activeGroups, setActiveGroups] = useState<Array<{
    group: string;
    node: string;
    type: string;
    provider: string;
    delay: string;
    delayClass: string;
    healthy: string;
  }>>([]);
  const [selectedGroup, setSelectedGroup] = useState(() => localStorage.getItem(PROXY_GROUP_KEY) || '');
  const [error, setError] = useState('');

  const loadCurrentProxy = async () => {
    try {
      const data = await api<{ proxies: Record<string, ProxyNode> }>('/api/mihomo/proxies');
      const groups = Object.values(data.proxies || {}).filter((proxy) => Array.isArray(proxy.all) && proxy.all.length > 0);
      const result = groups.map((group) => {
        const isLoadBalance = (group.type || '').toLowerCase() === 'loadbalance';
        let displayNode: string;
        let displayDelay: string;
        let delayCls: string;
        let healthStr: string;
        let nodeType: string;
        let provider: string;

        if (isLoadBalance) {
          const allNodes = group.all || [];
          const subNodes = allNodes.map((n) => data.proxies[n]).filter(Boolean);
          const alive = subNodes.filter((n) => n.alive !== false);
          const dead = subNodes.filter((n) => n.alive === false);
          const best = alive.length > 0 ? alive.sort((a, b) => latestDelay(a) - latestDelay(b))[0] : null;
          const activeNames = alive.slice(0, 3).map((n) => {
            const name = allNodes[subNodes.indexOf(n)];
            return data.proxies[name]?.name || name;
          });
          displayNode = `${alive.length}/${allNodes.length} 节点正常`;
          if (best) {
            displayDelay = `最佳 ${formatDelay(best)}`;
            delayCls = delayClass(best);
          } else {
            displayDelay = '- ms';
            delayCls = 'unknown';
          }
          healthStr = dead.length > 0 && alive.length === 0 ? '异常' : alive.length > 0 ? '正常' : '未知';
          nodeType = group.type || '-';
          provider = '-';
        } else {
          let node = resolveConcreteNode(data.proxies || {}, group.now || group.name);
          const nodeInfo = data.proxies[node];
          if (node === group.name || !nodeInfo || Array.isArray(nodeInfo?.all)) {
            node = group.now && group.now !== group.name ? group.now : '自动选择';
          }
          displayNode = node;
          const finalNodeInfo = data.proxies[displayNode] || nodeInfo;
          displayDelay = finalNodeInfo ? formatDelay(finalNodeInfo) : '- ms';
          delayCls = finalNodeInfo ? delayClass(finalNodeInfo) : 'unknown';
          healthStr = finalNodeInfo?.alive === false ? '异常' : finalNodeInfo?.alive === true ? '正常' : '未知';
          nodeType = finalNodeInfo?.type || group.type || '-';
          provider = finalNodeInfo?.providerName || finalNodeInfo?.['provider-name'] || '-';
        }

        return {
          group: group.name,
          node: displayNode,
          type: nodeType,
          provider,
          delay: displayDelay,
          delayClass: delayCls,
          healthy: healthStr
        };
      });
      setActiveGroups(result);
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    loadCurrentProxy();
    const interval = setInterval(loadCurrentProxy, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGroupClick = (groupName: string) => {
    localStorage.setItem(PROXY_GROUP_KEY, groupName);
    setSelectedGroup(groupName);
    setPageGlobal('proxies');
  };

  return (
    <div className="stack">
      <FlowHint downstream={{ label: '代理策略 - 切换节点', page: 'proxies' }} />
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
      <Panel title={`策略组当前节点 (${activeGroups.length})`} icon={<Zap size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        <div className="activeGroupGrid">
          {activeGroups.map((item) => (
            <div
              key={item.group}
              className={`activeGroupCard${item.group === selectedGroup ? ' selected' : ''}`}
              onClick={() => handleGroupClick(item.group)}
            >
              <div className="activeGroupHead">
                <span className="activeGroupName">{item.group}</span>
                <span className={`delay inlineDelay ${item.delayClass}`}>{item.delay}</span>
              </div>
              <div className="activeGroupBody">
                <div className="currentNodeRow">
                  <span className="currentLabel">当前:</span>
                  <span className="activeNodeName">{item.node}</span>
                </div>
                <span className={`statusPill ${item.healthy === '正常' ? 'good' : item.healthy === '异常' ? 'bad' : ''}`}>{item.healthy}</span>
              </div>
              <div className="activeGroupMeta">
                <span>{item.type}</span>
                {item.provider !== '-' && <span>{item.provider}</span>}
              </div>
            </div>
          ))}
          {activeGroups.length === 0 && <p className="empty">暂无策略组</p>}
        </div>
      </Panel>
      <RuntimeControls />
      <FlowHint upstream={{ label: '代理策略 - 节点选择', page: 'proxies' }} downstream={{ label: '流量监控 - 查看实时流量', page: 'traffic' }} />
    </div>
  );
}

function RuntimeControls() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [version, setVersion] = useState<MihomoVersion | null>(null);
  const [tunDiagnostics, setTunDiagnostics] = useState<TunDiagnostics | null>(null);
  const [tunForm, setTunForm] = useState<TunForm>(defaultTunForm());
  const tunFormDirtyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [nextConfig, nextVersion, nextTunDiagnostics] = await Promise.all([
        api<RuntimeConfig>('/api/mihomo/configs'),
        api<MihomoVersion>('/api/mihomo/version'),
        api<TunDiagnostics>('/api/config/tun')
      ]);
      setConfig(nextConfig);
      setVersion(nextVersion);
      setTunDiagnostics(nextTunDiagnostics);
      if (!tunFormDirtyRef.current) {
        setTunForm(tunFormFromDiagnostics(nextTunDiagnostics, nextConfig));
      }
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const patchConfig = async (patch: Partial<RuntimeConfig>) => {
    try {
      await api('/api/mihomo/configs', {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      setMessage('运行配置已更新');
      await load();
    } catch (err) {
      setError(readError(err));
    }
  };

  const saveTunConfig = async (enable = Boolean(tunDiagnostics?.config?.enable ?? config?.tun?.enable)) => {
    try {
      const response = await api<{ reloadStatus?: number; reloadBody?: string; reloadError?: string; diagnostics?: TunDiagnostics }>('/api/config/tun', {
        method: 'PATCH',
        body: JSON.stringify({
          enable,
          stack: tunForm.stack || 'system',
          device: tunForm.device.trim(),
          dnsHijack: parseTunDnsHijack(tunForm.dnsHijack),
          autoRoute: tunForm.autoRoute,
          autoDetectInterface: tunForm.autoDetectInterface
        })
      });
      if (response.diagnostics) {
        setTunDiagnostics(response.diagnostics);
        tunFormDirtyRef.current = false;
        setTunForm(tunFormFromDiagnostics(response.diagnostics, config));
      }
      if (response.reloadError || (response.reloadStatus && response.reloadStatus >= 300)) {
        setError(readTunReloadError(response.reloadBody || response.reloadError || 'TUN 配置已写入，但 mihomo reload 失败'));
      } else {
        setMessage(enable ? 'TUN 配置已写入并尝试启动' : 'TUN 已关闭');
        setError('');
      }
      await load();
    } catch (err) {
      setError(readError(err));
    }
  };

  const patchTun = async (enable: boolean) => {
    await saveTunConfig(enable);
  };

  const tunConfigEnabled = Boolean(tunDiagnostics?.config?.enable ?? config?.tun?.enable);
  const tunRuntimeEnabled = Boolean(tunDiagnostics?.runtimeAvailable && tunDiagnostics.runtime?.enable);
  const tunSavedForm = tunFormFromDiagnostics(tunDiagnostics, config);
  const tunFormDirty = !sameTunForm(tunForm, tunSavedForm);
  const updateTunForm = (patch: Partial<TunForm>) => {
    setTunForm((current) => {
      const next = { ...current, ...patch };
      tunFormDirtyRef.current = !sameTunForm(next, tunSavedForm);
      return next;
    });
  };

  return (
    <Panel title="运行配置" icon={<Settings2 size={18} />}>
      {error && <p className="inlineError">{error}</p>}
      {message && <p className="message">{message}</p>}
      <div className="runtimeGrid">
        <div className="runtimeBlock">
          <span>代理开关</span>
          <div className="toggleRow">
            <button className={config?.mode !== 'direct' ? 'activeMode powerButton on' : 'powerButton'} onClick={() => patchConfig({ mode: config?.mode === 'direct' ? 'rule' : 'direct' })}>
              <Zap size={15} />
              {config?.mode === 'direct' ? '代理关闭' : '代理开启'}
            </button>
            <label className={tunRuntimeEnabled ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
              <input type="checkbox" checked={tunRuntimeEnabled} onChange={(event) => patchTun(event.target.checked)} />
              <span className="switchTrack" aria-hidden="true" />
              <span>TUN</span>
            </label>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>模式</span>
          <div className="segmented">
            {['rule', 'global', 'direct'].map((mode) => (
              <button key={mode} title={describeMode(mode)} className={config?.mode === mode ? 'currentChoice' : ''} disabled={config?.mode === mode} onClick={() => patchConfig({ mode })}>
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="runtimeBlock">
          <span>日志级别</span>
          <div className="segmented">
            {['debug', 'info', 'warning', 'error', 'silent'].map((level) => (
              <button key={level} title={describeLogLevel(level)} className={config?.['log-level'] === level ? 'currentChoice' : ''} disabled={config?.['log-level'] === level} onClick={() => patchConfig({ 'log-level': level })}>
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="runtimeBlock">
          <span>开关</span>
          <div className="toggleRow">
            <label className={Boolean(config?.['allow-lan']) ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
              <input type="checkbox" checked={Boolean(config?.['allow-lan'])} onChange={(event) => patchConfig({ 'allow-lan': event.target.checked })} />
              <span className="switchTrack" aria-hidden="true" />
              <span>Allow LAN</span>
            </label>
            <label className={Boolean(config?.ipv6) ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
              <input type="checkbox" checked={Boolean(config?.ipv6)} onChange={(event) => patchConfig({ ipv6: event.target.checked })} />
              <span className="switchTrack" aria-hidden="true" />
              <span>IPv6</span>
            </label>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>内核</span>
          <div className="runtimeFacts">
            <strong>{version?.version || '-'}</strong>
            <small>{version?.meta ? 'Mihomo Meta' : 'Clash compatible'}</small>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>端口</span>
          <div className="runtimeFacts">
            <strong>mixed {config?.['mixed-port'] || '-'}</strong>
            <small>socks {config?.['socks-port'] || '-'} / http {config?.port || '-'}</small>
          </div>
        </div>
        <div className="runtimeBlock">
          <span>TUN</span>
          <div className="runtimeFacts">
            <strong>{tunRuntimeEnabled ? 'runtime enabled' : 'runtime disabled'}</strong>
            <small>config {tunConfigEnabled ? 'enabled' : 'disabled'} · {tunDiagnostics?.config?.stack || config?.tun?.stack || '-'}</small>
          </div>
        </div>
      </div>
      <div className="tunSettings">
        <div className="tunSettingsHeader">
          <div>
            <strong>TUN 参数</strong>
            <span>开启时如果 config.yaml 没有 tun 节点，会自动写入这些参数并重载 mihomo。</span>
          </div>
          <button className={tunFormDirty ? 'primary' : ''} disabled={!tunFormDirty} onClick={() => saveTunConfig(tunConfigEnabled)}>保存 TUN 配置</button>
        </div>
        <div className="tunSettingsGrid">
          <section className="tunFieldset">
            <div className="tunFieldsetTitle">
              <strong>设备与协议栈</strong>
              <span>决定 TUN 设备如何创建，以及使用哪种网络栈接管流量。</span>
            </div>
            <div className="tunFormGrid twoColumns">
              <label>
                <span>Stack</span>
                <select value={tunForm.stack} onChange={(event) => updateTunForm({ stack: event.target.value })}>
                  <option value="system">system</option>
                  <option value="gvisor">gvisor</option>
                  <option value="mixed">mixed</option>
                </select>
                <small>Linux 通常选 system；容器兼容性异常时再尝试 gvisor 或 mixed。</small>
              </label>
              <label>
                <span>Device</span>
                <input value={tunForm.device} placeholder="留空使用 mihomo 默认" onChange={(event) => updateTunForm({ device: event.target.value })} />
                <small>TUN 设备名。留空时不写入 device 字段，由 mihomo 自行决定。</small>
              </label>
            </div>
          </section>
          <section className="tunFieldset">
            <div className="tunFieldsetTitle">
              <strong>路由与 DNS</strong>
              <span>这组参数控制系统流量和 DNS 请求是否自动进入 mihomo。</span>
            </div>
            <div className="tunFormGrid dnsRouteGrid">
              <label className="wideTunField">
                <span>DNS Hijack</span>
                <input value={tunForm.dnsHijack} placeholder="0.0.0.0:53" onChange={(event) => updateTunForm({ dnsHijack: event.target.value })} />
                <small>多个地址用逗号分隔，例如 0.0.0.0:53, ::1:53。</small>
              </label>
              <div className="tunOptionGroup">
                <label className={tunForm.autoRoute ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
                  <input type="checkbox" checked={tunForm.autoRoute} onChange={(event) => updateTunForm({ autoRoute: event.target.checked })} />
                  <span className="switchTrack" aria-hidden="true" />
                  <span>Auto Route</span>
                </label>
                <small>自动添加路由，让系统流量进入 TUN。</small>
              </div>
              <div className="tunOptionGroup">
                <label className={tunForm.autoDetectInterface ? 'toggle toggleSwitch checked' : 'toggle toggleSwitch'}>
                  <input type="checkbox" checked={tunForm.autoDetectInterface} onChange={(event) => updateTunForm({ autoDetectInterface: event.target.checked })} />
                  <span className="switchTrack" aria-hidden="true" />
                  <span>Auto Interface</span>
                </label>
                <small>自动检测出口网卡，避免手动指定 interface-name。</small>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className={tunDiagnostics?.ready ? 'tunDiagnostic ready' : 'tunDiagnostic'}>
        <div className="tunDiagnosticHead">
          <div>
            <strong>{tunDiagnostics?.ready ? 'TUN 环境就绪' : 'TUN 环境需要处理'}</strong>
            <small>{tunDiagnostics?.ready ? '设备映射、权限和运行配置都已通过检查。' : '下面列出启动 TUN 前需要确认的项目。'}</small>
          </div>
          <span className={tunDiagnostics?.ready ? 'statusPill good' : 'statusPill warning'}>{tunDiagnostics?.ready ? 'Ready' : 'Attention'}</span>
        </div>
        <div className="tunCheckGrid">
          <div>
            <span>/dev/net/tun</span>
            <strong>{tunDiagnostics?.serviceMode === 'docker'
              ? tunDiagnostics?.dockerDeviceMapped || tunDiagnostics?.dockerPrivileged ? 'OK' : '缺失'
              : tunDiagnostics?.hostTunExists ? 'OK' : '缺失'}</strong>
          </div>
          <div>
            <span>NET_ADMIN</span>
            <strong>{tunDiagnostics?.serviceMode === 'docker'
              ? tunDiagnostics?.dockerNetAdmin || tunDiagnostics?.dockerPrivileged ? 'OK' : '缺失'
              : '主机模式'}</strong>
          </div>
          <div>
            <span>Runtime</span>
            <strong>{tunRuntimeEnabled ? 'enabled' : 'disabled'}</strong>
          </div>
        </div>
        {tunDiagnostics?.notes?.length ? (
          <ul>
            {tunDiagnostics.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}
