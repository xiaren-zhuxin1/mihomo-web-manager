import React, { useEffect, useState } from 'react';
import { Settings2, RefreshCw, Save, RotateCcw, Zap, AlertTriangle, Check, CircleX } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { readError } from '../../utils/helpers';
import type { TunDiagnostics, TunBlocker, TunConfig } from '../../types';

export function Maintenance() {
  const { setBusy, showToast, showConfirm } = useApp();
  const [config, setConfig] = useState<string>('');
  const [tunDiag, setTunDiag] = useState<TunDiagnostics | null>(null);
  const [tunForm, setTunForm] = useState({
    enable: false,
    stack: 'system',
    dnsHijack: '0.0.0.0:53',
    autoRoute: true,
    autoDetectInterface: true
  });
  const [error, setError] = useState('');

  const loadConfig = async () => {
    setBusy(true);
    try {
      const data = await api.get<{ content: string }>('/api/config/raw');
      setConfig(data.content || '');
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const loadTunDiagnostics = async () => {
    try {
      const data = await api.get<TunDiagnostics>('/api/config/tun/diagnostics');
      setTunDiag(data);
      setTunForm({
        enable: data.config?.enable || false,
        stack: data.config?.stack || 'system',
        dnsHijack: data.config?.dnsHijack?.join(', ') || '0.0.0.0:53',
        autoRoute: data.config?.autoRoute ?? true,
        autoDetectInterface: data.config?.autoDetectInterface ?? true
      });
    } catch (err) {
      console.error('Failed to load TUN diagnostics:', err);
    }
  };

  useEffect(() => {
    loadConfig();
    loadTunDiagnostics();
  }, []);

  const saveConfig = async () => {
    setBusy(true);
    try {
      await api.put('/api/config/raw', { content: config });
      showToast('success', '配置已保存');
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const reloadConfig = async () => {
    showConfirm(
      '确认重载',
      '确定要重载配置吗？这可能会中断当前连接。',
      async () => {
        setBusy(true);
        try {
          await api.post('/api/config/reload');
          showToast('success', '配置已重载');
          await loadTunDiagnostics();
        } catch (err) {
          showToast('error', readError(err));
        } finally {
          setBusy(false);
        }
      },
      'warning',
      '重载'
    );
  };

  const patchTun = async (enable: boolean) => {
    setBusy(true);
    try {
      await api.patch('/api/config/tun', {
        enable,
        stack: tunForm.stack,
        dnsHijack: tunForm.dnsHijack.split(',').map(s => s.trim()).filter(Boolean),
        autoRoute: tunForm.autoRoute,
        autoDetectInterface: tunForm.autoDetectInterface
      });
      showToast('success', enable ? 'TUN 已启用' : 'TUN 已禁用');
      await loadTunDiagnostics();
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <PageGuide page="maintenance" />
      
      <Panel title="TUN 设置" icon={<Zap size={18} />}>
        {tunDiag && (
          <>
            <div className="tunStatus">
              <span className={`statusBadge ${tunDiag.ready ? 'success' : 'error'}`}>
                {tunDiag.ready ? '就绪' : '未就绪'}
              </span>
              <span>服务模式: {tunDiag.serviceMode}</span>
            </div>

            {tunDiag.blockers.length > 0 && (
              <div className="tunBlockers">
                {tunDiag.blockers.map((blocker, i) => (
                  <div key={i} className={`blockerItem ${blocker.severity}`}>
                    <AlertTriangle size={16} />
                    <div className="blockerContent">
                      <strong>{blocker.title}</strong>
                      <p>{blocker.description}</p>
                      {blocker.fixCommand && (
                        <code className="fixCommand">{blocker.fixCommand}</code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="tunForm">
              <label>
                <input
                  type="checkbox"
                  checked={tunForm.enable}
                  onChange={e => setTunForm(prev => ({ ...prev, enable: e.target.checked }))}
                />
                启用 TUN
              </label>
              
              <div className="formRow">
                <label>Stack:</label>
                <select
                  value={tunForm.stack}
                  onChange={e => setTunForm(prev => ({ ...prev, stack: e.target.value }))}
                >
                  <option value="system">System</option>
                  <option value="gvisor">gVisor</option>
                  <option value="lwip">LWIP</option>
                </select>
              </div>
              
              <div className="formRow">
                <label>DNS 劫持:</label>
                <input
                  value={tunForm.dnsHijack}
                  onChange={e => setTunForm(prev => ({ ...prev, dnsHijack: e.target.value }))}
                  placeholder="0.0.0.0:53"
                />
              </div>

              <div className="formActions">
                <button
                  className={tunForm.enable ? 'danger' : 'primary'}
                  onClick={() => patchTun(!tunForm.enable)}
                >
                  {tunForm.enable ? '禁用 TUN' : '启用 TUN'}
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel title="配置文件" icon={<Settings2 size={18} />}>
        <textarea
          value={config}
          onChange={e => setConfig(e.target.value)}
          spellCheck={false}
        />
        <div className="configActions">
          <button className="primary" onClick={saveConfig}>
            <Save size={16} />
            保存
          </button>
          <button onClick={reloadConfig}>
            <RefreshCw size={16} />
            重载
          </button>
          <button onClick={loadConfig}>
            <RotateCcw size={16} />
            重置
          </button>
        </div>
        {error && <p className="inlineError">{error}</p>}
      </Panel>
    </div>
  );
}
