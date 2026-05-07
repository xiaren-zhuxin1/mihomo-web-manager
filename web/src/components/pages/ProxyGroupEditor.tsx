import React, { useEffect, useState, useCallback } from 'react';
import { Zap, Globe, Shield, ArrowRightLeft, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Settings, RotateCcw, Info } from 'lucide-react';
import { Panel, setPageGlobal } from '../ui';
import { api } from '../../services/api';
import type { ConfigProxyGroup, ConfigModel, Page } from '../../types';

const MODES = [
  {
    key: 'simple',
    icon: <Zap size={28} />,
    title: '简单模式',
    subtitle: '推荐新手使用',
    desc: '所有流量走同一条线路，自动选最快的节点。最省心，不用管。',
    groups: [
      { name: 'GLOBAL', type: 'select', proxies: ['AUTO', 'DIRECT'], use: [] },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ],
    tags: ['自动选最快', '一键切换']
  },
  {
    key: 'smart',
    icon: <Globe size={28} />,
    title: '智能分流',
    subtitle: '推荐大多数用户',
    desc: '不同网站自动走不同节点。GitHub 走日本、Google 走美国、Netflix 走专用节点。速度更快更稳定。',
    groups: [
      { name: 'PROXY', type: 'select', proxies: ['GITHUB', 'GOOGLE', 'OPENAI', 'NETFLIX', 'YOUTUBE', 'TWITTER', 'TELEGRAM', 'AUTO', 'DIRECT'], use: [] },
      { name: 'GITHUB', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'GOOGLE', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'OPENAI', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'NETFLIX', type: 'url-test', proxies: [], use: ['all'], url: 'https://www.netflix.com', interval: '600' },
      { name: 'YOUTUBE', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'TWITTER', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'TELEGRAM', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ],
    tags: ['按网站分流', '9 个频道']
  },
  {
    key: 'balance',
    icon: <ArrowRightLeft size={28} />,
    title: '负载均衡',
    subtitle: '适合带宽需求大',
    desc: '同时使用多个节点分担流量。下载大文件、多人同时上网时更快。像多车道并行。',
    groups: [
      { name: 'PROXY', type: 'select', proxies: ['BALANCE', 'AUTO', 'DIRECT'], use: [] },
      { name: 'BALANCE', type: 'load-balance', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ],
    tags: ['多节点并发', '大带宽']
  },
  {
    key: 'fallback',
    icon: <Shield size={28} />,
    title: '高可用模式',
    subtitle: '适合对稳定性要求高',
    desc: '主节点挂了自动切换备用。主备双保险，断线概率最低。',
    groups: [
      { name: 'PROXY', type: 'select', proxies: ['MAIN', 'BACKUP', 'AUTO', 'DIRECT'], use: [] },
      { name: 'MAIN', type: 'fallback', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'BACKUP', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' },
      { name: 'AUTO', type: 'url-test', proxies: [], use: ['all'], url: 'http://www.gstatic.com/generate_204', interval: '300' }
    ],
    tags: ['主备切换', '不断线']
  }
];

export function ProxyGroupEditor({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [groups, setGroups] = useState<ConfigProxyGroup[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [applyingMode, setApplyingMode] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    setTimeout(() => setMessage(''), 4000);
  };

  const applyMode = async (modeKey: string) => {
    const mode = MODES.find((m) => m.key === modeKey);
    if (!mode) return;
    setApplyingMode(modeKey);
    setBusy(true);
    try {
      for (const group of mode.groups) {
        await api('/api/config/proxy-groups/' + encodeURIComponent(group.name), {
          method: 'PUT',
          body: JSON.stringify(group)
        });
      }
      showMessage(`已切换到「${mode.title}」`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplyingMode(null);
      setBusy(false);
    }
  };

  const deleteGroup = async (name: string) => {
    setBusy(true);
    try {
      await api('/api/config/proxy-groups/' + encodeURIComponent(name), { method: 'DELETE' });
      showMessage('已删除');
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

  const typeLabel = (t: string) => ({
    select: '手动选择',
    'url-test': '自动测速',
    fallback: '故障转移',
    'load-balance': '负载均衡',
    relay: '链式代理'
  }[t] || t);

  const hasGlobal = groups.some((g) => g.name === 'PROXY' || g.name === 'GLOBAL');
  const hasAutoTest = groups.some((g) => g.type === 'url-test');
  const hasBalance = groups.some((g) => g.type === 'load-balance');

  return (
    <div className="stack">
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ margin: 0 }}>分流模式</h3>
        <p className="textMuted" style={{ margin: '4px 0 0', fontSize: '13px' }}>选择一个模式，决定你的网络流量怎么走。不懂就选「智能分流」。</p>
      </div>

      {message && (
        <div className="notice" style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s ease' }}>
          <CheckCircle2 size={16} />{message}
        </div>
      )}
      {error && <div className="notice error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        {MODES.map((mode) => {
          const isApplying = applyingMode === mode.key;
          return (
            <button
              key={mode.key}
              className={`modeCard${isApplying ? ' applying' : ''}`}
              onClick={() => applyMode(mode.key)}
              disabled={!!applyingMode}
            >
              <div className="modeCardIcon">{mode.icon}</div>
              <div className="modeCardBody">
                <strong>{mode.title}</strong>
                <span className="modeCardSub">{mode.subtitle}</span>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: '1.5' }}>{mode.desc}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {mode.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
              {isApplying && <div className="modeCardOverlay"><RotateCcw size={20} className="spin" /><span>应用中...</span></div>}
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: '16px', padding: '12px 16px', borderRadius: 'var(--radius-md)',
        background: 'var(--bg-active)', border: '1px solid var(--border-light)', display: 'flex', gap: '10px', alignItems: 'flex-start'
      }}>
        <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <strong style={{ color: 'var(--text-primary)' }}>当前配置：</strong>
          共 <b>{groups.length}</b> 个策略组
          {hasGlobal && ' · 有全局选择组'}
          {hasAutoTest && ' · 有自动测速'}
          {hasBalance && ' · 有负载均衡'}
          {!hasGlobal && !hasAutoTest && !hasBalance && ' · 配置可能不完整'}
          {' · '}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0 2px', fontSize: 'inherit' }}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '收起详情' : '查看详情'} {showAdvanced ? <ChevronUp size={13} style={{ verticalAlign: 'middle' }} /> : <ChevronDown size={13} style={{ verticalAlign: 'middle' }} />}
          </button>
        </div>
      </div>

      {showAdvanced && (
        <Panel title={`当前策略组 (${groups.length})`} icon={<Settings size={18} />}>
          {groups.length === 0 && <p className="empty">暂无策略组，请从上方选择一个模式</p>}
          <div className="groupList">
            {groups.map((g, i) => (
              <div key={g.name} className="groupListItem">
                <div className="groupListMain">
                  <div className="groupListInfo">
                    <span className="groupName">{g.name}</span>
                    <span className="typeBadge">{typeLabel(g.type)}</span>
                  </div>
                  <div className="groupListMeta">
                    {(g.proxies.length > 0) && <span>{g.proxies.length} 个引用</span>}
                    {(g.use.length > 0) && <span>使用 {g.use.join(', ')}</span>}
                  </div>
                </div>
                <div className="groupListActions">
                  <button className="iconButton small" title="上移" disabled={i === 0} onClick={() => moveGroup(g.name, 'up')}>
                    <ChevronUp size={14} />
                  </button>
                  <button className="iconButton small" title="下移" disabled={i === groups.length - 1} onClick={() => moveGroup(g.name, 'down')}>
                    <ChevronDown size={14} />
                  </button>
                  {confirmDelete === g.name ? (
                    <>
                      <button className="iconButton small danger" title="确认删除" onClick={() => deleteGroup(g.name)}>
                        <CheckCircle2 size={14} />
                      </button>
                      <button className="iconButton small" title="取消" onClick={() => setConfirmDelete(null)}>
                        <AlertTriangle size={14} />
                      </button>
                    </>
                  ) : (
                    <button className="iconButton small danger" title="删除" onClick={() => setConfirmDelete(g.name)}>
                      <AlertTriangle size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <FlowHint upstream={{ label: '代理策略 - 切换节点', page: 'proxies' }} downstream={{ label: '系统配置', page: 'config' }} />
    </div>
  );
}

function FlowHint({ upstream, downstream }: { upstream?: { label: string; page: Page }; downstream?: { label: string; page: Page } }) {
  if (!upstream && !downstream) return null;
  return (
    <div className="flowHint">
      {upstream && (<button className="flowHintBtn" onClick={() => setPageGlobal(upstream.page)}>&uarr; {upstream.label}</button>)}
      {downstream && (<button className="flowHintBtn" onClick={() => setPageGlobal(downstream.page)}>&darr; {downstream.label}</button>)}
    </div>
  );
}
