import React, { useEffect, useState } from 'react';
import { Settings2, Save, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { readError } from '../../utils/helpers';

export function ConfigEditor() {
  const { setBusy, showToast, showConfirm } = useApp();
  const [config, setConfig] = useState<string>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

  useEffect(() => {
    loadConfig();
  }, []);

  const saveConfig = async () => {
    setBusy(true);
    try {
      await api.put('/api/config/raw', { content: config });
      showToast('success', '配置已保存');
      setMessage('配置已保存，需要重载生效');
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const reloadConfig = () => {
    showConfirm(
      '确认重载',
      '确定要重载配置吗？这可能会中断当前连接。',
      async () => {
        setBusy(true);
        try {
          await api.post('/api/config/reload');
          showToast('success', '配置已重载');
          setMessage('');
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

  const resetConfig = () => {
    showConfirm(
      '确认重置',
      '确定要重置为服务器上的配置吗？未保存的修改将丢失。',
      async () => {
        await loadConfig();
        showToast('success', '已重置为服务器配置');
      },
      'warning',
      '重置'
    );
  };

  return (
    <div className="stack">
      <PageGuide page="config" />
      
      {message && (
        <div className="notice success">
          {message}
          <button onClick={reloadConfig}>立即重载</button>
        </div>
      )}
      
      {error && <p className="inlineError">{error}</p>}

      <Panel title="配置文件编辑" icon={<Settings2 size={18} />}>
        <div className="configEditorToolbar">
          <button className="primary" onClick={saveConfig}>
            <Save size={16} />
            保存
          </button>
          <button onClick={reloadConfig}>
            <RefreshCw size={16} />
            重载
          </button>
          <button onClick={resetConfig}>
            <RotateCcw size={16} />
            重置
          </button>
        </div>

        <textarea
          className="configTextarea"
          value={config}
          onChange={e => {
            setConfig(e.target.value);
            setMessage('');
          }}
          spellCheck={false}
          placeholder="配置文件内容..."
        />

        <div className="configTips">
          <AlertTriangle size={14} />
          <span>修改配置后需要保存并重载才能生效。建议在修改前备份配置文件。</span>
        </div>
      </Panel>
    </div>
  );
}
