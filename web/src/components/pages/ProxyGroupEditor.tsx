import React, { useEffect, useState, useCallback } from 'react';
import { Zap, Globe, Shield, ArrowRightLeft, Tv, Gamepad2, Layers, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Settings, RotateCcw, Info, Star, Wifi } from 'lucide-react';
import { Panel, setPageGlobal } from '../ui';
import { api } from '../../services/api';
import type { ConfigProxyGroup, ConfigModel, Page } from '../../types';

function g(name: string, type: string, proxies: string[], use: string[] = [], extra?: Record<string, string>): ConfigProxyGroup {
  return { name, type, proxies, use, ...extra };
}

const MODES: Array<{
  key: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  groups: ConfigProxyGroup[];
  tags: string[];
  recommended?: boolean;
}> = [
  {
    key: 'minimal',
    icon: <Zap size={28} />,
    title: '极简模式',
    subtitle: '最简单省心',
    desc: '只有 2 个策略组：一个全局选择 + 自动测速选最快节点。适合不想折腾的用户。',
    groups: [
      g('PROXY', 'select', ['AUTO', 'DIRECT']),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['2 个组', '一键切换']
  },
  {
    key: 'smart',
    icon: <Wifi size={28} />,
    title: '智能容灾',
    subtitle: '推荐 · 最快+自动切换+优先同地区',
    desc: '每个地区自动选最快节点，节点失效瞬间切换存活节点。选香港就优先走香港节点，香港全挂了自动切其他地区。全程无需手动干预。',
    groups: [
      g('PROXY', 'select', ['HK', 'JP', 'SG', 'US', 'AUTO-GLOBAL', 'DIRECT']),
      g('AUTO-GLOBAL', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('HK', 'fallback', ['AUTO-HK', 'AUTO-GLOBAL'], []),
      g('AUTO-HK', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('JP', 'fallback', ['AUTO-JP', 'AUTO-GLOBAL'], []),
      g('AUTO-JP', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('SG', 'fallback', ['AUTO-SG', 'AUTO-GLOBAL'], []),
      g('AUTO-SG', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('US', 'fallback', ['AUTO-US', 'AUTO-GLOBAL'], []),
      g('AUTO-US', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' })
    ],
    tags: ['10 个组', '容灾自愈'],
    recommended: true
  },
  {
    key: 'daily',
    icon: <Globe size={28} />,
    title: '日常模式',
    subtitle: '手动+自动混合',
    desc: '按地区分组（港/日/新/美），每个地区可手动选具体节点或走自动策略。适合想精细控制的用户。',
    groups: [
      g('PROXY', 'select', ['AUTO', 'FAILOVER', 'BALANCE', 'OVERSEAS', 'DIRECT']),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('FAILOVER', 'fallback', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '300' }),
      g('BALANCE', 'load-balance', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '300' }),
      g('HK', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('JP', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('SG', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('US', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('OVERSEAS', 'select', ['HK', 'JP', 'SG', 'US', 'AUTO', 'FAILOVER', 'BALANCE', 'DIRECT'])
    ],
    tags: ['9 个组', '灵活控制']
  },
  {
    key: 'media',
    icon: <Tv size={28} />,
    title: '流媒体模式',
    subtitle: '追剧看片党',
    desc: '在日常模式基础上增加专用流媒体频道。Netflix/YouTube 各走各的线路，解锁更稳定，4K 不卡。',
    groups: [
      g('PROXY', 'select', ['STREAMING', 'AUTO', 'FAILOVER', 'BALANCE', 'OVERSEAS', 'DIRECT']),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('FAILOVER', 'fallback', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '300' }),
      g('BALANCE', 'load-balance', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '300' }),
      g('NETFLIX', 'url-test', [], ['all'], { url: 'https://www.netflix.com', interval: '600' }),
      g('YOUTUBE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('HK', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('JP', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('SG', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('US', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('OVERSEAS', 'select', ['HK', 'JP', 'SG', 'US', 'NETFLIX', 'YOUTUBE', 'AUTO', 'FAILOVER', 'BALANCE', 'DIRECT']),
      g('STREAMING', 'select', ['NETFLIX', 'YOUTUBE', 'US', 'JP', 'SG', 'AUTO', 'DIRECT'])
    ],
    tags: ['12 个组', '流媒体优化']
  },
  {
    key: 'gaming',
    icon: <Gamepad2 size={28} />,
    title: '游戏加速模式',
    subtitle: '低延迟优先',
    desc: '短间隔实时测延迟，故障转移确保不断线。Steam/Epic/主机游戏低延迟不卡顿。',
    groups: [
      g('PROXY', 'select', ['GAME', 'AUTO', 'FAILOVER', 'JP', 'US', 'DIRECT']),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '180' }),
      g('FAILOVER', 'fallback', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '120' }),
      g('GAME', 'fallback', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('JP', 'select', ['GAME', 'AUTO', 'FAILOVER', 'DIRECT']),
      g('US', 'select', ['GAME', 'AUTO', 'FAILOVER', 'DIRECT']),
      g('HK', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('SG', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('OVERSEAS', 'select', ['JP', 'US', 'HK', 'SG', 'GAME', 'AUTO', 'FAILOVER', 'DIRECT'])
    ],
    tags: ['9 个组', '120s 测速']
  },
  {
    key: 'balance',
    icon: <ArrowRightLeft size={28} />,
    title: '负载均衡模式',
    subtitle: '带宽最大化',
    desc: '所有节点同时工作，总带宽叠加。下载大文件、PT、多人上网首选。',
    groups: [
      g('PROXY', 'select', ['BALANCE', 'FAST', 'DIRECT']),
      g('BALANCE', 'load-balance', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '300' }),
      g('FAST', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '200' })
    ],
    tags: ['3 个组', '多倍带宽']
  },
  {
    key: 'ha',
    icon: <Shield size={28} />,
    title: '高可用模式',
    subtitle: '稳定第一',
    desc: '主备双保险，故障自动切换。办公/远程桌面等不能断网的场景。',
    groups: [
      g('PROXY', 'select', ['MAIN', 'BACKUP', 'AUTO', 'DIRECT']),
      g('MAIN', 'fallback', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '180' }),
      g('BACKUP', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['4 个组', '主备切换']
  },
  {
    key: 'full',
    icon: <Layers size={28} />,
    title: '完整模式',
    subtitle: '功能最全',
    desc: '包含所有功能：地区选择 + 流媒体 + 游戏加速 + 负载均衡 + 高可用。适合高级玩家。',
    groups: [
      g('PROXY', 'select', ['STREAMING', 'GAME', 'OVERSEAS', 'BALANCE', 'AUTO', 'FAILOVER', 'DIRECT']),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('FAILOVER', 'fallback', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '200' }),
      g('BALANCE', 'load-balance', [], ['all'], { url: 'https://www.gstatic.com/generate_204', interval: '300' }),
      g('NETFLIX', 'url-test', [], ['all'], { url: 'https://www.netflix.com', interval: '600' }),
      g('YOUTUBE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('GAME', 'fallback', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('HK', 'select', ['AUTO', 'FAILOVER', 'GAME', 'DIRECT']),
      g('JP', 'select', ['AUTO', 'FAILOVER', 'GAME', 'DIRECT']),
      g('SG', 'select', ['AUTO', 'FAILOVER', 'DIRECT']),
      g('US', 'select', ['AUTO', 'FAILOVER', 'GAME', 'DIRECT']),
      g('OVERSEAS', 'select', ['HK', 'JP', 'SG', 'US', 'NETFLIX', 'YOUTUBE', 'GAME', 'AUTO', 'FAILOVER', 'BALANCE', 'DIRECT']),
      g('STREAMING', 'select', ['NETFLIX', 'YOUTUBE', 'US', 'JP', 'SG', 'AUTO', 'DIRECT']),
      g('ALL-NODES', 'select', ['DIRECT'])
    ],
    tags: ['14 个组', '全功能']
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
      const model = await api<ConfigModel>('/api/config/model');
      const realProviders = model.proxyProviders || [];
      const existingNames = (model.proxyGroups || []).map((g: ConfigProxyGroup) => g.name);
      const newNames = mode.groups.map((g) => g.name);
      for (const name of existingNames) {
        if (!newNames.includes(name)) {
          try { await api('/api/config/proxy-groups/' + encodeURIComponent(name), { method: 'DELETE' }); } catch {}
        }
      }
      const rules = model.rules || [];
      for (let i = 0; i < rules.length; i++) {
        const raw: any = rules[i];
        const ruleStr: string = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw as string[]).join(',') : String(raw);
        const parts: string[] = ruleStr.split(',');
        const flags = ['no-resolve', 'noRedirect'];
        let targetIdx = parts.length - 1;
        while (targetIdx > 0 && flags.includes(parts[targetIdx])) { targetIdx--; }
        const target = parts[targetIdx] || '';
        if (target && !newNames.includes(target) && target !== 'DIRECT' && target !== 'PROXY' && target !== 'REJECT') {
          try {
            parts[targetIdx] = 'PROXY';
            await api('/api/config/rules/' + i, {
              method: 'PUT',
              body: JSON.stringify({ rule: parts.join(',') })
            });
          } catch {}
        }
      }
      for (const group of mode.groups) {
        const resolved = { ...group };
        if (resolved.use && resolved.use.includes('all') && realProviders.length > 0) {
          resolved.use = realProviders;
        }
        await api('/api/config/proxy-groups/' + encodeURIComponent(group.name), {
          method: 'PUT',
          body: JSON.stringify(resolved)
        });
      }
      showMessage(`已应用「${mode.title}」(${mode.groups.length} 个策略组)`);
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

  return (
    <div className="stack">
      <div style={{ marginBottom: '8px' }}>
        <h3 style={{ margin: 0 }}>分流模式</h3>
        <p className="textMuted" style={{ margin: '4px 0 0', fontSize: '13px' }}>选择一套方案，一键应用到你的代理。应用后会替换当前所有策略组。不懂就选带 ⭐ 的推荐。</p>
      </div>

      {message && (
        <div className="notice" style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s ease' }}>
          <CheckCircle2 size={16} />{message}
        </div>
      )}
      {error && <div className="notice error">{error}</div>}

      <div className="modesGrid">
        {MODES.map((mode) => {
          const isApplying = applyingMode === mode.key;
          return (
            <button
              key={mode.key}
              className={`modeCard${isApplying ? ' applying' : ''}`}
              onClick={() => applyMode(mode.key)}
              disabled={!!applyingMode}
            >
              {mode.recommended && <span className="modeCardBadge"><Star size={12} />推荐</span>}
              <div className="modeCardIcon">{mode.icon}</div>
              <div className="modeCardBody">
                <strong>{mode.title}</strong>
                <span className="modeCardSub">{mode.subtitle}</span>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: '1.55' }}>{mode.desc}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {mode.tags.map((tag) => (<span key={tag} className="tag">{tag}</span>))}
                </div>
              </div>
              {isApplying && <div className="modeCardOverlay"><RotateCcw size={20} className="spin" /><span>正在应用...</span></div>}
            </button>
          );
        })}
      </div>

      <div className="statusBar">
        <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <strong style={{ color: 'var(--text-primary)' }}>当前状态：</strong>
          共 <b>{groups.length}</b> 个策略组 · 节点资源: <b>{providers.length > 0 ? providers.join(', ') : '无'}</b>
          {' · '}
          <button className="linkBtn" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? '收起详情' : '查看/管理策略组'}
            {showAdvanced ? <ChevronUp size={13} style={{ verticalAlign: 'middle' }} /> : <ChevronDown size={13} style={{ verticalAlign: 'middle' }} />}
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
                    {(g.proxies.length > 0) && <span>{g.proxies.length} 个引用: {g.proxies.slice(0, 5).join(', ')}{g.proxies.length > 5 ? '...' : ''}</span>}
                    {(g.use.length > 0) && <span>资源: {g.use.join(', ')}</span>}
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
