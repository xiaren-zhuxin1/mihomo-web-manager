import React, { useEffect, useState } from 'react';
import { DatabaseBackup, FileCode2, Play, RefreshCw, RotateCcw, Save, Square, Terminal } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import { readError, formatBytes, formatDate } from '../../utils/helpers';
import type { Health, ConfigBackup } from '../../types';

export function ConfigEditor({ setBusy, health }: { setBusy: (busy: boolean) => void; health: Health | null }) {
  const [content, setContent] = useState('');
  const [backups, setBackups] = useState<ConfigBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(true);

  const load = async () => {
    setBusy(true);
    try {
      const [data, backupData] = await Promise.all([
        api<{ content: string }>('/api/config'),
        api<{ backups: ConfigBackup[] }>('/api/config/backups')
      ]);
      setContent(data.content);
      setBackups(backupData.backups || []);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!advanced && !window.confirm('高级 YAML 编辑未展开。确认要保存当前文本内容？')) return;
    setBusy(true);
    try {
      await api('/api/config', { method: 'PUT', body: JSON.stringify({ content, reload }) });
      setMessage('已保存');
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    setBusy(true);
    try {
      const data = await api<{ path: string }>('/api/config/backup', { method: 'POST', body: '{}' });
      setMessage(`备份完成：${data.path}`);
      await loadBackups();
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const loadBackups = async () => {
    const data = await api<{ backups: ConfigBackup[] }>('/api/config/backups');
    setBackups(data.backups || []);
  };

  const viewBackup = async (name: string) => {
    setBusy(true);
    try {
      const data = await api<{ content: string }>(`/api/config/backups/${encodeURIComponent(name)}`);
      setSelectedBackup(name);
      setContent(data.content);
      setMessage(`已载入备份：${name}`);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (name: string) => {
    if (!window.confirm(`恢复备份 ${name}？当前配置会先自动备份，然后替换并 reload。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/backups/${encodeURIComponent(name)}/restore`, { method: 'POST', body: '{}' });
      setSelectedBackup('');
      setMessage(`已恢复备份并 reload：${name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="split configSplit">
      <FlowHint upstream={{ label: '配置维护 - 结构化编辑', page: 'maintenance' }} downstream={{ label: '总览 - 运行状态', page: 'overview' }} />
      <Panel title="配置编辑" icon={<FileCode2 size={18} />}>
        <div className="formTip">优先使用"维护"页的结构化表单。这里是高级 YAML 文本编辑入口，仅用于批量调整或排查问题；保存前会自动备份。</div>
        <div className="toolbar">
          <label className="check">
            <input type="checkbox" checked={reload} onChange={(event) => setReload(event.target.checked)} />
            保存后 reload
          </label>
          <button className="iconButton" title="备份" onClick={backup}>
            <DatabaseBackup size={16} />
          </button>
          <button className="iconButton" title="刷新" onClick={load}>
            <RefreshCw size={16} />
          </button>
          <button className="primary" onClick={save}>
            <Save size={16} />
            保存
          </button>
          <button onClick={() => setAdvanced((value) => !value)}>
            <FileCode2 size={16} />
            {advanced ? '收起高级编辑' : '展开高级编辑'}
          </button>
        </div>
        {selectedBackup && <p className="inlineHint">当前编辑器内容来自备份：{selectedBackup}。点"保存"会写入当前配置。</p>}
        {message && <p className="message">{message}</p>}
        {error && <p className="inlineError">{error}</p>}
        {advanced ? (
          <textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />
        ) : (
          <div className="configPreview">
            <pre>{content.slice(0, 2400)}</pre>
            {content.length > 2400 && <span>仅预览前 2400 字符，展开高级编辑可查看完整配置。</span>}
          </div>
        )}
      </Panel>
      <div className="sideStack">
        <Service setBusy={setBusy} health={health} />
        <Panel title={`备份 (${backups.length})`} icon={<DatabaseBackup size={18} />}>
          <div className="toolbar">
            <button onClick={backup}>
              <DatabaseBackup size={16} />
              创建备份
            </button>
            <button onClick={() => loadBackups().catch((err) => setError(readError(err)))}>
              <RefreshCw size={16} />
              刷新
            </button>
          </div>
          <div className="backupList">
            {backups.map((item) => (
              <div className={selectedBackup === item.name ? 'backupCard selected' : 'backupCard'} key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatDate(item.modifiedAt)} · {formatBytes(item.size)}</span>
                </div>
                <div className="backupActions">
                  <button onClick={() => viewBackup(item.name)}>
                    <FileCode2 size={16} />
                    查看
                  </button>
                  <button className="danger" onClick={() => restoreBackup(item.name)}>
                    <RotateCcw size={16} />
                    恢复
                  </button>
                </div>
              </div>
            ))}
            {backups.length === 0 && <p className="empty">还没有配置备份</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Service({ setBusy, health }: { setBusy: (busy: boolean) => void; health: Health | null }) {
  const [status, setStatus] = useState('');
  const [active, setActive] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const call = async (action?: string) => {
    setBusy(true);
    try {
      if (action) {
        await api(`/api/service/${action}`, { method: 'POST', body: '{}' });
      }
      const data = await api<{ active: boolean; output: string; error: string }>('/api/service/status');
      setActive(data.active);
      setStatus(`${data.active ? 'active' : 'inactive'} ${data.output || ''} ${data.error || ''}`.trim());
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    call();
  }, []);

  return (
    <Panel title="服务与运行" icon={<Terminal size={18} />}>
      <div className="serviceHeader">
        <div>
          <strong>{health?.serviceMode === 'docker' ? 'mihomo container' : 'mihomo.service'}</strong>
          <span>{status || '正在读取服务状态'}</span>
        </div>
        <span className={active ? 'statusPill good' : 'statusPill warning'}>{active ? 'Active' : 'Inactive'}</span>
      </div>
      {error && <p className="inlineError">{error}</p>}
      <div className="serviceGrid">
        <Metric label="模式" value={health?.serviceMode || '-'} />
        <Metric label="控制器" value={health?.mihomoController || '-'} />
        <Metric label="配置" value={health?.mihomoConfigPath || '-'} />
      </div>
      <div className="serviceActions">
        <button className="primary" onClick={() => call('start')} disabled={active === true}>
          <Play size={16} />
          启动
        </button>
        <button onClick={() => call('reload')} disabled={active === false}>
          <RefreshCw size={16} />
          Reload 配置
        </button>
        <button onClick={() => call('restart')}>
          <RotateCcw size={16} />
          重启服务
        </button>
        <button className="danger" onClick={() => call('stop')} disabled={active === false}>
          <Square size={16} />
          停止
        </button>
      </div>
      <p className="inlineHint">这里合并到系统配置页：日常只需要 reload 或重启；停止会让代理服务不可用，按钮会根据实时状态禁用。</p>
    </Panel>
  );
}
