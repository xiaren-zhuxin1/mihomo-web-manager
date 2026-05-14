import React, { useEffect, useState, useCallback } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Shield, Zap, XCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../services/api';

type RecoveryEvent = {
  timestamp: string;
  type: string;
  level: string;
  message: string;
  action: string;
  success: boolean;
  detail: string;
};

type RecoveryStatus = {
  enabled: boolean;
  mihomoAlive: boolean;
  lastCheck: string;
  lastRecovery: string | null;
  recoveryCount: number;
  consecutiveFails: number;
  configHealthy: boolean;
  recentEvents: RecoveryEvent[];
};

type NodeHealth = {
  name: string;
  group: string;
  alive: boolean;
  delay: number;
  lastCheck: string;
  lastAlive: string;
  consecFails: number;
  totalChecks: number;
  totalFails: number;
  skipAuto: boolean;
  skipReason: string;
};

type NodeFailoverStatus = {
  enabled: boolean;
  autoSwitch: boolean;
  checkInterval: string;
  totalNodes: number;
  aliveNodes: number;
  failedNodes: number;
  skippedNodes: number;
};

type SubRecoveryStatus = {
  autoUpdate: boolean;
  updateInterval: string;
  lastAutoUpdate: string;
};

export function Recovery() {
  const [recovery, setRecovery] = useState<RecoveryStatus | null>(null);
  const [nodeFailover, setNodeFailover] = useState<NodeFailoverStatus | null>(null);
  const [subRecovery, setSubRecovery] = useState<SubRecoveryStatus | null>(null);
  const [nodeHealth, setNodeHealth] = useState<NodeHealth[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedEvents, setExpandedEvents] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(false);

  const load = useCallback(async () => {
    try {
      const [recoveryData, nodeData, subData] = await Promise.all([
        api<RecoveryStatus>('/api/recovery/status'),
        api<NodeFailoverStatus>('/api/nodes/failover'),
        api<SubRecoveryStatus>('/api/subscriptions/recovery'),
      ]);
      setRecovery(recoveryData);
      setNodeFailover(nodeData);
      setSubRecovery(subData);
      setError('');
    } catch (err: any) {
      setError(err.message || '加载容灾状态失败');
    }
  }, []);

  const loadNodeHealth = useCallback(async () => {
    try {
      const data = await api<{ health: NodeHealth[] }>(`/api/nodes/health${selectedGroup ? `?group=${encodeURIComponent(selectedGroup)}` : ''}`);
      setNodeHealth(data.health || []);
    } catch {
      setNodeHealth([]);
    }
  }, [selectedGroup]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    loadNodeHealth();
  }, [loadNodeHealth]);

  const toggleRecovery = async () => {
    if (!recovery) return;
    try {
      await api('/api/recovery/enabled', {
        method: 'PUT',
        body: JSON.stringify({ enabled: !recovery.enabled }),
      });
      setMessage(recovery.enabled ? '容灾守护已关闭' : '容灾守护已开启');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const triggerRecovery = async () => {
    try {
      await api('/api/recovery/trigger', { method: 'POST' });
      setMessage('已触发手动恢复');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetNodeSkip = async (group: string, node: string) => {
    try {
      await api('/api/nodes/reset-skip', {
        method: 'POST',
        body: JSON.stringify({ group, node }),
      });
      setMessage(`已重置节点 ${node} 的跳过状态`);
      await loadNodeHealth();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const autoSwitch = async (group: string) => {
    try {
      const result = await api<{ switched: boolean; from?: string; to?: string; message?: string }>(`/api/nodes/auto-switch?group=${encodeURIComponent(group)}`, {
        method: 'POST',
      });
      if (result.switched) {
        setMessage(`已自动切换 ${group}: ${result.from} → ${result.to}`);
      } else {
        setMessage(result.message || '当前节点已是最优');
      }
      await loadNodeHealth();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const levelIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle size={14} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-400" />;
      default: return <CheckCircle size={14} className="text-green-400" />;
    }
  };

  const formatTime = (t: string) => {
    if (!t) return '-';
    try {
      return new Date(t).toLocaleString('zh-CN');
    } catch {
      return t;
    }
  };

  return (
    <div className="recoveryPage">
      {error && <div className="notice error" onClick={() => setError('')}>{error}</div>}
      {message && <div className="notice success" onClick={() => setMessage('')}>{message}</div>}

      <div className="recoveryGrid">
        <div className="card">
          <div className="cardHeader">
            <Shield size={18} />
            <h3>Mihomo 守护进程</h3>
            <span className={`statusDot ${recovery?.mihomoAlive ? 'alive' : 'dead'}`} />
          </div>
          <div className="cardBody">
            <div className="statRow">
              <span>进程状态</span>
              <span className={recovery?.mihomoAlive ? 'text-green-400' : 'text-red-400'}>
                {recovery?.mihomoAlive ? '运行中' : '已停止'}
              </span>
            </div>
            <div className="statRow">
              <span>配置健康</span>
              <span className={recovery?.configHealthy ? 'text-green-400' : 'text-yellow-400'}>
                {recovery?.configHealthy ? '正常' : '异常'}
              </span>
            </div>
            <div className="statRow">
              <span>守护状态</span>
              <span>{recovery?.enabled ? '已启用' : '已关闭'}</span>
            </div>
            <div className="statRow">
              <span>连续失败</span>
              <span className={(recovery?.consecutiveFails || 0) > 0 ? 'text-yellow-400' : ''}>
                {recovery?.consecutiveFails || 0}
              </span>
            </div>
            <div className="statRow">
              <span>恢复次数</span>
              <span>{recovery?.recoveryCount || 0}</span>
            </div>
            <div className="statRow">
              <span>上次检查</span>
              <span className="text-sm">{formatTime(recovery?.lastCheck || '')}</span>
            </div>
            <div className="statRow">
              <span>上次恢复</span>
              <span className="text-sm">{formatTime(recovery?.lastRecovery || '')}</span>
            </div>
            <div className="cardActions">
              <button className="btn" onClick={toggleRecovery}>
                {recovery?.enabled ? '关闭守护' : '开启守护'}
              </button>
              <button className="btn accent" onClick={triggerRecovery} disabled={!recovery?.enabled}>
                手动恢复
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <Zap size={18} />
            <h3>节点故障转移</h3>
            <span className={`statusDot ${nodeFailover?.enabled ? 'alive' : 'dead'}`} />
          </div>
          <div className="cardBody">
            <div className="statRow">
              <span>故障转移</span>
              <span>{nodeFailover?.enabled ? '已启用' : '已关闭'}</span>
            </div>
            <div className="statRow">
              <span>自动切换</span>
              <span>{nodeFailover?.autoSwitch ? '已启用' : '已关闭'}</span>
            </div>
            <div className="statRow">
              <span>检查间隔</span>
              <span>{nodeFailover?.checkInterval || '-'}</span>
            </div>
            <div className="statRow">
              <span>总节点数</span>
              <span>{nodeFailover?.totalNodes || 0}</span>
            </div>
            <div className="statRow">
              <span>存活节点</span>
              <span className="text-green-400">{nodeFailover?.aliveNodes || 0}</span>
            </div>
            <div className="statRow">
              <span>故障节点</span>
              <span className="text-red-400">{nodeFailover?.failedNodes || 0}</span>
            </div>
            <div className="statRow">
              <span>已跳过节点</span>
              <span className="text-yellow-400">{nodeFailover?.skippedNodes || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <Activity size={18} />
            <h3>订阅自动更新</h3>
            <span className={`statusDot ${subRecovery?.autoUpdate ? 'alive' : 'dead'}`} />
          </div>
          <div className="cardBody">
            <div className="statRow">
              <span>自动更新</span>
              <span>{subRecovery?.autoUpdate ? '已启用' : '已关闭'}</span>
            </div>
            <div className="statRow">
              <span>更新间隔</span>
              <span>{subRecovery?.updateInterval || '-'}</span>
            </div>
            <div className="statRow">
              <span>上次更新</span>
              <span className="text-sm">{formatTime(subRecovery?.lastAutoUpdate || '')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="cardHeader clickable" onClick={() => setExpandedEvents(!expandedEvents)}>
          <Clock size={18} />
          <h3>恢复事件日志</h3>
          <span className="badge">{recovery?.recentEvents?.length || 0}</span>
          {expandedEvents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {expandedEvents && (
          <div className="cardBody">
            {(!recovery?.recentEvents || recovery.recentEvents.length === 0) ? (
              <p className="text-gray-500">暂无事件记录</p>
            ) : (
              <div className="eventList">
                {recovery.recentEvents.slice().reverse().map((event, i) => (
                  <div key={i} className={`eventItem ${event.level}`}>
                    {levelIcon(event.level)}
                    <span className="eventTime">{formatTime(event.timestamp)}</span>
                    <span className="eventMsg">{event.message}</span>
                    {event.action && <span className="eventAction">{event.action}</span>}
                    {event.detail && <span className="eventDetail">{event.detail}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="cardHeader clickable" onClick={() => setExpandedNodes(!expandedNodes)}>
          <Settings size={18} />
          <h3>节点健康状态</h3>
          <span className="badge">{nodeHealth.length}</span>
          {expandedNodes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {expandedNodes && (
          <div className="cardBody">
            <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="按策略组筛选..."
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="input"
                style={{ maxWidth: '300px' }}
              />
              <button className="btn" onClick={loadNodeHealth}>
                <RefreshCw size={14} />
              </button>
            </div>
            {nodeHealth.length === 0 ? (
              <p className="text-gray-500">暂无节点健康数据</p>
            ) : (
              <div className="nodeHealthTable">
                <table>
                  <thead>
                    <tr>
                      <th>策略组</th>
                      <th>节点</th>
                      <th>状态</th>
                      <th>延迟</th>
                      <th>连续失败</th>
                      <th>自动跳过</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodeHealth.map((node, i) => (
                      <tr key={i} className={node.skipAuto ? 'skipped' : node.alive ? 'alive' : 'dead'}>
                        <td>{node.group}</td>
                        <td>{node.name}</td>
                        <td>
                          {node.alive ? (
                            <span className="text-green-400">存活</span>
                          ) : (
                            <span className="text-red-400">故障</span>
                          )}
                        </td>
                        <td>{node.delay > 0 ? `${node.delay}ms` : '-'}</td>
                        <td className={node.consecFails > 0 ? 'text-yellow-400' : ''}>{node.consecFails}</td>
                        <td>
                          {node.skipAuto ? (
                            <span className="text-yellow-400" title={node.skipReason}>是</span>
                          ) : '否'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {node.skipAuto && (
                              <button className="btn sm" onClick={() => resetNodeSkip(node.group, node.name)}>
                                重置
                              </button>
                            )}
                            <button className="btn sm accent" onClick={() => autoSwitch(node.group)}>
                              切换
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .recoveryPage { padding: 0; }
        .recoveryGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
        .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .cardHeader { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
        .cardHeader.clickable { cursor: pointer; user-select: none; }
        .cardHeader h3 { margin: 0; font-size: 14px; font-weight: 600; flex: 1; }
        .cardBody { padding: 12px 16px; }
        .cardActions { display: flex; gap: 8px; margin-top: 12px; }
        .statRow { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 13px; }
        .statRow span:first-child { color: var(--text-secondary); }
        .statusDot { width: 8px; height: 8px; border-radius: 50%; }
        .statusDot.alive { background: #22c55e; }
        .statusDot.dead { background: #ef4444; }
        .badge { background: var(--bg-hover); padding: 2px 8px; border-radius: 10px; font-size: 12px; color: var(--text-secondary); }
        .eventList { max-height: 300px; overflow-y: auto; }
        .eventItem { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
        .eventItem:last-child { border-bottom: none; }
        .eventItem.error { color: #ef4444; }
        .eventItem.warning { color: #eab308; }
        .eventTime { color: var(--text-secondary); min-width: 140px; }
        .eventMsg { flex: 1; }
        .eventAction { background: var(--bg-hover); padding: 1px 6px; border-radius: 4px; font-size: 11px; }
        .eventDetail { color: var(--text-secondary); font-size: 11px; }
        .nodeHealthTable { overflow-x: auto; }
        .nodeHealthTable table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .nodeHealthTable th, .nodeHealthTable td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border); }
        .nodeHealthTable th { color: var(--text-secondary); font-weight: 500; }
        .nodeHealthTable tr.skipped { background: rgba(234, 179, 8, 0.05); }
        .nodeHealthTable tr.dead { background: rgba(239, 68, 68, 0.05); }
        .btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text); cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }
        .btn:hover { background: var(--bg-hover); }
        .btn.accent { background: #3b82f6; color: white; border-color: #3b82f6; }
        .btn.accent:hover { background: #2563eb; }
        .btn.sm { padding: 3px 8px; font-size: 11px; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-input); color: var(--text); font-size: 13px; }
        .notice { padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; cursor: pointer; }
        .notice.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .notice.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); }
        .text-green-400 { color: #22c55e; }
        .text-red-400 { color: #ef4444; }
        .text-yellow-400 { color: #eab308; }
        .text-gray-500 { color: var(--text-secondary); }
        .text-sm { font-size: 12px; }
      `}</style>
    </div>
  );
}
