import React, { useEffect, useState } from 'react';
import { CircleX, List, RefreshCw, Gauge } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import { formatBytes, readError, connectionRouteTarget, routeLabel, routeClass, formatDate } from '../../utils/helpers';
import type { ConnectionsResponse } from '../../types';

export function Connections({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [data, setData] = useState<ConnectionsResponse>({ connections: [] });
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const next = await api<ConnectionsResponse>('/api/mihomo/connections');
      setData({ ...next, connections: next.connections || [] });
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const closeConnection = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/mihomo/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const closeAll = async () => {
    setBusy(true);
    try {
      await api('/api/mihomo/connections', { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const query = filter.trim().toLowerCase();
  const connections = (data.connections || []).filter((conn) => {
    const text = [
      conn.metadata?.host,
      conn.metadata?.destinationIP,
      conn.metadata?.destinationPort,
      conn.metadata?.process,
      conn.rule,
      conn.rulePayload,
      conn.chains?.join(' ')
    ].join(' ').toLowerCase();
    return !query || text.includes(query);
  });

  return (
    <div className="stack">
      <FlowHint upstream={{ label: '流量监控 - 实时流量', page: 'traffic' }} downstream={{ label: '代理策略 - 节点选择', page: 'proxies' }} />
      <div className="grid">
        <Panel title="累计统计" icon={<Gauge size={18} />}>
          <Metric label="上传总量" value={formatBytes(data.uploadTotal || 0)} />
          <Metric label="下载总量" value={formatBytes(data.downloadTotal || 0)} />
          <Metric label="内存占用" value={formatBytes(data.memory || 0)} />
        </Panel>
        <Panel title="活跃连接" icon={<List size={18} />}>
          <Metric label="当前连接数" value={String(data.connections?.length || 0)} />
          <Metric label="筛选结果" value={String(connections.length)} />
          <button onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
        </Panel>
      </div>
      <Panel title={`连接列表 (${connections.length})`} icon={<List size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        <div className="toolbar">
          <input className="searchInput" placeholder="筛选域名、IP、规则、进程" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <button className="danger" onClick={closeAll} disabled={connections.length === 0}>
            <CircleX size={16} />
            关闭全部
          </button>
        </div>
        <div className="connectionList">
          {connections.map((conn) => (
            <div className="connectionCard" key={conn.id}>
              <div>
                <strong>{conn.metadata?.host || conn.metadata?.destinationIP || 'unknown'}</strong>
                <span>{conn.metadata?.network || '-'} · {conn.metadata?.type || '-'} · {conn.metadata?.destinationIP || '-'}:{conn.metadata?.destinationPort || '-'}</span>
                <small>{conn.metadata?.process || 'unknown process'} · {conn.start ? formatDate(conn.start) : '-'}</small>
              </div>
              <div>
                <span className={routeClass(conn)}>{routeLabel(connectionRouteTarget(conn))}</span>
                <small>规则：{conn.rule || '-'} {conn.rulePayload ? `· ${conn.rulePayload}` : ''}</small>
              </div>
              <div className="chainList">
                {(conn.chains || []).map((chain) => (
                  <span key={chain}>{chain}</span>
                ))}
                {(conn.chains || []).length === 0 && <span>-</span>}
              </div>
              <div className="connectionTraffic">
                <span>↑ {formatBytes(conn.upload || 0)}</span>
                <span>↓ {formatBytes(conn.download || 0)}</span>
              </div>
              <button className="iconButton" title="关闭连接" onClick={() => closeConnection(conn.id)}>
                <CircleX size={16} />
              </button>
            </div>
          ))}
          {connections.length === 0 && <p className="empty">当前无活跃连接 · 累计上传 {formatBytes(data.uploadTotal || 0)} · 累计下载 {formatBytes(data.downloadTotal || 0)}</p>}
        </div>
      </Panel>
    </div>
  );
}
