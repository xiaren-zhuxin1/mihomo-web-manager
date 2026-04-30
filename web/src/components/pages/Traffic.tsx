import React, { useEffect, useState } from 'react';
import { Activity, Gauge, List, RefreshCw } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import { formatBytes, formatRate, readError } from '../../utils/helpers';
import type { ConnectionsResponse, TrafficPoint } from '../../types';

export function Traffic({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [points, setPoints] = useState<TrafficPoint[]>([]);
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [error, setError] = useState('');

  const loadConnections = async () => {
    try {
      const next = await api<ConnectionsResponse>('/api/mihomo/connections');
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
    let stream: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectStream = () => {
      if (closed) return;
      stream = new EventSource('/api/mihomo/traffic');
      stream.onmessage = (event) => {
        if (closed) return;
        try {
          const data = JSON.parse(event.data) as { up?: number; down?: number };
          setPoints((current) => [...current.slice(-59), { time: new Date().toLocaleTimeString(), up: data.up || 0, down: data.down || 0 }]);
          setError('');
        } catch {
          // Ignore malformed stream chunks from upstream.
        }
      };
      stream.onerror = () => {
        if (closed) return;
        stream?.close();
        stream = null;
        setError('实时流量连接断开，3秒后自动重连...');
        reconnectTimer = setTimeout(connectStream, 3000);
      };
    };

    connectStream();

    return () => {
      closed = true;
      window.clearInterval(timer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stream?.close();
    };
  }, []);

  const latest = points[points.length - 1];
  const max = Math.max(1, ...points.map((point) => Math.max(point.up, point.down)));

  return (
    <div className="stack">
      <FlowHint upstream={{ label: '总览 - 运行状态', page: 'overview' }} downstream={{ label: '连接追踪 - 查看连接详情', page: 'connections' }} />
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
          <button onClick={() => { setBusy(true); loadConnections().finally(() => setBusy(false)); }}>
            <RefreshCw size={16} />
            刷新
          </button>
        </Panel>
      </div>
      <Panel title="最近 60 秒" icon={<Activity size={18} />}>
        <div className="trafficChart">
          {points.map((point, index) => (
            <div className="trafficBar" key={`${point.time}-${index}`} title={`${point.time} ↑${formatRate(point.up)} ↓${formatRate(point.down)}`}>
              <span className="up" style={{ height: `${Math.max(2, (point.up / max) * 100)}%` }} />
              <span className="down" style={{ height: `${Math.max(2, (point.down / max) * 100)}%` }} />
            </div>
          ))}
          {points.length === 0 && <p className="empty">等待实时流量数据</p>}
        </div>
      </Panel>
    </div>
  );
}
