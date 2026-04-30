import React, { useEffect, useState } from 'react';
import { List, X, RefreshCw, Search } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { formatBytes, formatSpeed, readError, routeClass, routeLabel } from '../../utils/helpers';
import type { Connection } from '../../types';

export function Connections() {
  const { setBusy, showToast } = useApp();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api.get<{ connections: Connection[] }>('/api/mihomo/connections');
      setConnections(data.connections || []);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const closeConnection = async (id: string) => {
    try {
      await api.delete(`/api/mihomo/connections/${encodeURIComponent(id)}`);
      setConnections(prev => prev.filter(c => c.id !== id));
      showToast('success', '连接已关闭');
    } catch (err) {
      showToast('error', readError(err));
    }
  };

  const closeAll = async () => {
    try {
      await api.delete('/api/mihomo/connections');
      setConnections([]);
      showToast('success', '所有连接已关闭');
    } catch (err) {
      showToast('error', readError(err));
    }
  };

  const filtered = connections.filter(c => {
    const query = filter.toLowerCase();
    return !query ||
      c.metadata.host?.toLowerCase().includes(query) ||
      c.metadata.process?.toLowerCase().includes(query) ||
      c.metadata.sourceIP?.includes(query);
  });

  const totalUp = connections.reduce((sum, c) => sum + c.upload, 0);
  const totalDown = connections.reduce((sum, c) => sum + c.download, 0);

  return (
    <div className="stack">
      <PageGuide page="connections" />
      
      <Panel title="连接追踪" icon={<List size={18} />}>
        <div className="connectionToolbar">
          <div className="searchBox">
            <Search size={16} />
            <input
              placeholder="搜索主机/进程/IP..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <div className="connectionStats">
            <span>↑ {formatSpeed(totalUp)}</span>
            <span>↓ {formatSpeed(totalDown)}</span>
            <span>共 {connections.length} 个连接</span>
          </div>
          <button onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
          <button className="danger" onClick={closeAll}>
            <X size={16} />
            关闭全部
          </button>
        </div>

        {error && <p className="inlineError">{error}</p>}

        <div className="connectionList">
          {filtered.map(conn => (
            <div key={conn.id} className="connectionCard">
              <div className="connMeta">
                <strong>{conn.metadata.host || conn.metadata.destinationIP}</strong>
                <span>{conn.metadata.process || conn.metadata.network}</span>
              </div>
              <div className="connInfo">
                <span>{conn.metadata.sourceIP}:{conn.metadata.sourcePort}</span>
                <span>→ {conn.metadata.destinationPort}</span>
              </div>
              <div className="connTraffic">
                <span>↑ {formatBytes(conn.upload)}</span>
                <span>↓ {formatBytes(conn.download)}</span>
              </div>
              <div className={routeClass(conn)}>
                {routeLabel(conn.chains?.[0] || conn.rule)}
              </div>
              <button
                className="iconBtn"
                onClick={() => closeConnection(conn.id)}
                title="关闭连接"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {filtered.length === 0 && <p className="empty">暂无连接</p>}
        </div>
      </Panel>
    </div>
  );
}
