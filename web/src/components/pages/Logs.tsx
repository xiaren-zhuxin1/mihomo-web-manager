import React, { useEffect, useState } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { Panel, FlowHint } from '../ui';

export function Logs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [level, setLevel] = useState('info');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setLogs([]);
    setConnected(false);
    const stream = new EventSource(`/api/mihomo/logs?level=${encodeURIComponent(level)}`);
    stream.addEventListener('status', () => {
      setConnected(true);
      setError('');
    });
    stream.addEventListener('error', (event: MessageEvent) => {
      const data = event.data;
      if (data) setError(data);
    });
    stream.onmessage = (event) => {
      setLogs((current) => [...current.slice(-299), event.data]);
      setConnected(true);
      setError('');
    };
    stream.onerror = () => {
      setConnected(false);
      setError('日志流连接断开，正在等待浏览器自动重连。');
    };
    return () => {
      setConnected(false);
      stream.close();
    };
  }, [level]);

  return (
    <div className="stack">
      <FlowHint upstream={{ label: '流量监控 - 实时流量', page: 'traffic' }} downstream={{ label: '连接追踪 - 连接详情', page: 'connections' }} />
      <Panel title="实时日志" icon={<Terminal size={18} />}>
        {error && <p className="inlineError">{error}</p>}
        <div className="toolbar">
          {['debug', 'info', 'warning', 'error'].map((item) => (
            <button key={item} className={level === item ? 'activeMode' : ''} onClick={() => setLevel(item)}>
              {item}
            </button>
          ))}
          <button onClick={() => setLogs([])}>
            <Trash2 size={16} />
            清空
          </button>
          <span className={connected ? 'streamStatus online' : 'streamStatus'}>{connected ? '已连接' : '连接中'}</span>
        </div>
        <div className="logBox">
          {logs.map((line, index) => (
            <pre key={`${index}-${line}`}>{line}</pre>
          ))}
          {logs.length === 0 && <p className="empty">{connected ? '日志流已连接，等待新日志' : '正在连接日志流'}</p>}
        </div>
      </Panel>
    </div>
  );
}
