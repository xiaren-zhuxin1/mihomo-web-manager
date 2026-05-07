import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Edit3, RotateCcw, LayoutGrid, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Panel, setPageGlobal } from '../ui';
import { api } from '../../services/api';
import type { ConfigProxyGroup, ConfigModel, Page } from '../../types';

const GROUP_TYPES = [
  { value: 'select', label: 'Select（手动选择）' },
  { value: 'url-test', label: 'URL-Test（延迟测试）' },
  { value: 'fallback', label: 'Fallback（故障转移）' },
  { value: 'load-balance', label: 'Load-Balance（负载均衡）' },
  { value: 'relay', label: 'Relay（链式代理）' }
];

const PRESET_TEMPLATES: Record<string, {
  name: string;
  desc: string;
  groups: ConfigProxyGroup[];
}> = {
  simple: {
    name: '简洁模式',
    desc: '一个全局选择组 + 自动测速，适合简单场景',
    groups: [
      { name: 'GLOBAL', type: 'select', proxies: ['AUTO', 'DIRECT'], use: [] },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ]
  },
  smart: {
    name: '智能分流',
    desc: '按服务自动选择最优节点，覆盖主流网站',
    groups: [
      { name: 'GLOBAL', type: 'select', proxies: ['GITHUB', 'GOOGLE', 'OPENAI', 'NETFLIX', 'YOUTUBE', 'TWITTER', 'TELEGRAM', 'AUTO', 'DIRECT'], use: [] },
      { name: 'GITHUB', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'GOOGLE', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'OPENAI', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'NETFLIX', type: 'url-test', proxies: [], use: ['all'], url: 'https://www.netflix.com', interval: '600' },
      { name: 'YOUTUBE', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'TWITTER', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'TELEGRAM', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ]
  },
  balance: {
    name: '负载均衡',
    desc: '使用 LoadBalance 同时利用多个节点',
    groups: [
      { name: 'GLOBAL', type: 'select', proxies: ['BALANCE', 'AUTO', 'DIRECT'], use: [] },
      { name: 'BALANCE', type: 'load-balance', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ]
  },
  fallback: {
    name: '故障转移',
    desc: '主备切换，主节点故障时自动切换备用',
    groups: [
      { name: 'GLOBAL', type: 'select', proxies: ['MAIN', 'BACKUP', 'AUTO', 'DIRECT'], use: [] },
      { name: 'MAIN', type: 'fallback', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'BACKUP', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ]
  }
};

export function ProxyGroupEditor({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [groups, setGroups] = useState<ConfigProxyGroup[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<ConfigProxyGroup | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<ConfigModel>('/api/config/model');
      const safeGroups = (data.proxyGroups || []).map((g) => ({
        ...g,
        proxies: g.proxies || [],
        use: g.use || []
      }));
      setGroups(safeGroups);
      setProviders(data.proxyProviders || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const saveGroup = async (group: ConfigProxyGroup) => {
    setBusy(true);
    try {
      await api('/api/config/proxy-groups/' + encodeURIComponent(group.name), {
        method: 'PUT',
        body: JSON.stringify(group)
      });
      showMessage(`策略组 "${group.name}" 已保存`);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async (name: string) => {
    setBusy(true);
    try {
      await api('/api/config/proxy-groups/' + encodeURIComponent(name), { method: 'DELETE' });
      showMessage(`策略组 "${name}" 已删除`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const moveGroup = async (name: string, direction: string) => {
    setBusy(true);
    try {
      await api('/api/config/proxy-groups/' + encodeURIComponent(name) + '/move', {
        method: 'POST',
        body: JSON.stringify({ direction })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = async (presetKey: string) => {
    const preset = PRESET_TEMPLATES[presetKey];
    if (!preset) return;
    setBusy(true);
    try {
      for (const group of preset.groups) {
        await api('/api/config/proxy-groups/' + encodeURIComponent(group.name), {
          method: 'PUT',
          body: JSON.stringify(group)
        });
      }
      showMessage(`已应用预设模板: ${preset.name}`);
      setShowPresets(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const availableTargets = [...groups.map(g => g.name), ...providers, 'DIRECT', 'REJECT', 'REJECT-DROP'];

  return (
    <div className="stack">
      <div className="flexBetween">
        <div>
          <h3 style={{ margin: 0 }}>策略组管理</h3>
          <p className="textMuted" style={{ margin: '4px 0 0' }}>
            管理、编辑、重置代理策略组配置
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="button secondary" onClick={() => setShowPresets(!showPresets)}>
            <LayoutGrid size={16} /> 预设模板
          </button>
          <button className="button primary" onClick={() => setEditing({ name: '', type: 'select', proxies: [], use: [] })}>
            <Plus size={16} /> 新建策略组
          </button>
        </div>
      </div>

      {message && <div className="notice" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} />{message}</div>}
      {error && <div className="notice error">{error}</div>}

      {showPresets && (
        <Panel title="选择预设模板" icon={<LayoutGrid size={18} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {Object.entries(PRESET_TEMPLATES).map(([key, t]) => (
              <div key={key} className="presetCard" onClick={() => applyPreset(key)}>
                <strong>{t.name}</strong>
                <p className="textMuted" style={{ fontSize: '12px', margin: '4px 0 8px' }}>{t.desc}</p>
                <span className="tag">{t.groups.length} 个策略组</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {editing !== null && (
        <GroupEditorForm
          group={editing}
          availableTargets={availableTargets}
          providers={providers}
          onSave={saveGroup}
          onCancel={() => setEditing(null)}
        />
      )}

      <Panel title={`当前策略组 (${groups.length})`} icon={<LayoutGrid size={18} />}>
        {groups.length === 0 && <p className="empty">暂无策略组，请选择预设模板或手动创建</p>}
        <div className="groupList">
          {groups.map((g, i) => (
            <div key={g.name} className="groupListItem">
              <div className="groupListMain">
                <div className="groupListInfo">
                  <span className="groupName">{g.name}</span>
                  <span className="typeBadge">{g.type}</span>
                </div>
                <div className="groupListMeta">
                  {g.proxies.length > 0 && <span>{g.proxies.length} 个节点</span>}
                  {g.use.length > 0 && <span>{g.use.length} 个资源</span>}
                  {g.url && <span>URL测试</span>}
                </div>
              </div>
              <div className="groupListActions">
                <button className="iconButton small" title="上移" disabled={i === 0} onClick={() => moveGroup(g.name, 'up')}>
                  <ChevronUp size={14} />
                </button>
                <button className="iconButton small" title="下移" disabled={i === groups.length - 1} onClick={() => moveGroup(g.name, 'down')}>
                  <ChevronDown size={14} />
                </button>
                <button className="iconButton small" title="编辑" onClick={() => setEditing({ ...g })}>
                  <Edit3 size={14} />
                </button>
                {confirmDelete === g.name ? (
                  <>
                    <button className="iconButton small danger" title="确认删除" onClick={() => deleteGroup(g.name)}>
                      <CheckCircle2 size={14} />
                    </button>
                    <button className="iconButton small" title="取消" onClick={() => setConfirmDelete(null)}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button className="iconButton small danger" title="删除" onClick={() => setConfirmDelete(g.name)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <FlowHint upstream={{ label: '代理策略 - 切换节点', page: 'proxies' }} downstream={{ label: '系统配置 - 直接编辑 YAML', page: 'config' }} />
    </div>
  );
}

function GroupEditorForm({
  group, availableTargets, providers, onSave, onCancel
}: {
  group: ConfigProxyGroup;
  availableTargets: string[];
  providers: string[];
  onSave: (g: ConfigProxyGroup) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ConfigProxyGroup>({
    ...group,
    proxies: group.proxies || [],
    use: group.use || []
  });
  const [proxyInput, setProxyInput] = useState('');

  const isAutoTest = form.type === 'url-test' || form.type === 'fallback' || form.type === 'load-balance';
  const isNew = !group.name;

  return (
    <Panel title={isNew ? '新建策略组' : `编辑策略组: ${group.name}`} icon={<Edit3 size={18} />}>
      <div className="formGrid" style={{ maxWidth: '640px' }}>
        <label className="field">
          <span className="fieldLabel">名称 *</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="如: GLOBAL, GITHUB, AUTO"
            disabled={!isNew}
          />
        </label>

        <label className="field">
          <span className="fieldLabel">类型 *</span>
          <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {GROUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="fieldLabel">使用节点资源 (use)</span>
          <div className="chipRow">
            {providers.map(p => (
              <button
                key={p}
                className={`chip${form.use.includes(p) ? ' active' : ''}`}
                onClick={() => setForm(f => ({
                  ...f,
                  use: f.use.includes(p) ? f.use.filter(x => x !== p) : [...f.use, p]
                }))}
              >
                {p === 'all' ? '全部订阅' : p}
              </button>
            ))}
            <button
              className={`chip${form.use.includes('all') ? ' active' : ''}`}
              onClick={() => setForm(f => ({
                ...f,
                use: f.use.includes('all') ? f.use.filter(x => x !== 'all') : [...f.use, 'all']
              }))}
            >
              全部(all)
            </button>
          </div>
        </label>

        <label className="field">
          <span className="fieldLabel">指定节点 (proxies)</span>
          <div className="chipRow" style={{ flexWrap: 'wrap' }}>
            {form.proxies.map(p => (
              <span key={p} className="chip active" style={{ cursor: 'default' }}>
                {p}
                <X size={12} style={{ marginLeft: '4px', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, proxies: f.proxies.filter(x => x !== p) }))} />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <input
              className="input"
              value={proxyInput}
              onChange={(e) => setProxyInput(e.target.value)}
              placeholder="输入节点名或从下方选择..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && proxyInput.trim() && !form.proxies.includes(proxyInput.trim())) {
                  setForm(f => ({ ...f, proxies: [...f.proxies, proxyInput.trim()] }));
                  setProxyInput('');
                }
              }}
            />
          </div>
          <div className="chipRow" style={{ marginTop: '6px', flexWrap: 'wrap' }}>
            {['DIRECT', 'REJECT', 'REJECT-DROP'].filter(t => !form.proxies.includes(t)).map(t => (
              <button key={t} className="chip" onClick={() => setForm(f => ({ ...f, proxies: [...f.proxies, t] }))}>{t}</button>
            ))}
            {availableTargets.filter(t =>
              !['DIRECT', 'REJECT', 'REJECT-DROP'].includes(t) && !form.proxies.includes(t)
            ).slice(0, 10).map(t => (
              <button key={t} className="chip" onClick={() => setForm(f => ({ ...f, proxies: [...f.proxies, t] }))}>{t}</button>
            ))}
          </div>
        </label>

        {isAutoTest && (
          <>
            <label className="field">
              <span className="fieldLabel">测试 URL</span>
              <input
                className="input"
                value={form.url || ''}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="http://www.gstatic.com/generate_204"
              />
            </label>
            <label className="field">
              <span className="fieldLabel">测试间隔 (秒)</span>
              <input
                className="input"
                value={form.interval || ''}
                onChange={(e) => setForm({ ...form, interval: e.target.value })}
                placeholder="300"
              />
            </label>
          </>
        )}

        <div className="field" style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="button secondary" onClick={onCancel}>取消</button>
          <button
            className="button primary"
            disabled={!form.name.trim() || !form.type}
            onClick={() => onSave(form)}
          >
            {isNew ? '创建' : '保存'}
          </button>
        </div>
      </div>
    </Panel>
  );
}

function FlowHint({ upstream, downstream }: { upstream?: { label: string; page: Page }; downstream?: { label: string; page: Page } }) {
  if (!upstream && !downstream) return null;
  return (
    <div className="flowHint">
      {upstream && (
        <button className="flowHintBtn" onClick={() => setPageGlobal(upstream.page)}>&uarr; {upstream.label}</button>
      )}
      {downstream && (
        <button className="flowHintBtn" onClick={() => setPageGlobal(downstream.page)}>&darr; {downstream.label}</button>
      )}
    </div>
  );
}
