import React, { useEffect, useState } from 'react';
import { Activity, Gauge, List, RefreshCw } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { formatBytes, readError } from '../../utils/helpers';

type TrafficPoint = {
  time: string;
  up: number;
  down: number;
};

type ConnectionsResponse = {
  connections: Array<{
    id: string;
    upload: number;
    download: number;
  }>;
  uploadTotal: number;
  downloadTotal: number;
};

function formatRate(bytes: number): string {
  if (bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Traffic() {
  const { setBusy } = useApp();
  const [points, setPoints] = useState<TrafficPoint[]>([]);
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [error, setError] = useState('');

  const loadConnections = async () => {
    try {
      const next = await api.get<ConnectionsResponse>('/api/mihomo/connections');
      setConnections({ ...next, connections: next.connections || [] });
      setError('');
    } catch (err) {
      setError(readError(err));
    }
  };

  useEffect(() => {
    let closed = false;
    loadConnections();
    
    const timer = window.setInterval(loadConnections, 3000);
    
    const stream = new EventSource('/api/mihomo/traffic');
    stream.onmessage = (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data) as { up?: number; down?: number };
        setPoints(current => [
          ...current.slice(-59),
          { time: new Date().toLocaleTimeString(), up: data.up || 0, down: data.down || 0 }
        ]);
      } catch {
        // Ignore malformed stream chunks
      }
    };
    
    stream.onerror = () => setError('实时流量连接断开，正在等待浏览器自动重连。');
    
    return () => {
      closed = true;
      window.clearInterval(timer);
      stream.close();
    };
  }, []);

  const latest = points[points.length - 1];
  const max = Math.max(1, ...points.map(point => Math.max(point.up, point.down)));

  const handleRefresh = async () => {
    setBusy(true);
    await loadConnections();
    setBusy(false);
  };

  return (
    <div className="stack">
      <PageGuide page="traffic" />
      
      {error && <p className="inlineError">{error}</p>}
      
      <div className="grid">
        <Panel title="实时速度" icon={<Activity size={18} />}>
          <Metric label="上传" value={formatRate(latest?.up || 0)} />
          <Metric label="下载" value={formatRate(latest?.down || 0)} />
        </Panel>
        
        <Panel title="累计流量" icon={<Gauge size={18} />}>
          <Metric label="上传总量" value={formatBytes(connections?.uploadTotal || 0)} />
          <Metric label="下载总量" value={formatBytes(connections?.downloadTotal || 0)} />
        </Panel>
        
        <Panel title="连接" icon={<List size={18} />}>
          <Metric label="当前连接数" value={String(connections?.connections?.length || 0)} />
          <button onClick={handleRefresh}>
            <RefreshCw size={16} />
            刷新
          </button>
        </Panel>
      </div>
      
      <Panel title="最近 60 秒" icon={<Activity size={18} />}>
        <div className="trafficChart">
          {points.map((point, index) => (
            <div
              className="trafficBar"
              key={`${point.time}-${index}`}
              title={`${point.time} ↑${formatRate(point.up)} ↓${formatRate(point.down)}`}
            >
              <span
                className="up"
                style={{ height: `${Math.max(2, (point.up / max) * 100)}%` }}
              />
              <span
                className="down"
                style={{ height: `${Math.max(2, (point.down / max) * 100)}%` }}
              />
            </div>
          ))}
          {points.length === 0 && <p className="empty">等待实时流量数据</p>}
        </div>
      </Panel>
    </div>
  );
}
