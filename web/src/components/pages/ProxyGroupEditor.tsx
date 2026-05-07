import React, { useEffect, useState, useCallback } from 'react';
import { Zap, Globe, Shield, ArrowRightLeft, Code2, Tv, Gamepad2, Layers, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Settings, RotateCcw, Info, Star, Cpu } from 'lucide-react';
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
  detail: string;
  groups: ConfigProxyGroup[];
  tags: string[];
  recommended?: boolean;
}> = [
  {
    key: 'minimal',
    icon: <Zap size={28} />,
    title: '极简模式',
    subtitle: '零配置上手',
    desc: '最简单的方案。所有流量走同一条线路，系统自动选最快的节点。点一下就能用。',
    detail: '1 个全局选择组 + 1 个自动测速组。适合第一次使用、不想折腾的用户。',
    groups: [
      g('PROXY', 'select', ['AUTO', 'DIRECT']),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['2 个策略组', '一键切换']
  },
  {
    key: 'smart',
    icon: <Globe size={28} />,
    title: '智能分流',
    subtitle: '推荐大多数人',
    desc: '按网站自动分流：AI 服务走美区、GitHub 走日本、视频走香港。每个服务都走最优线路。',
    detail: '9 个频道覆盖主流海外服务。Google/OpenAI/Netflix/YouTube/Twitter/Telegram 各自独立测速选最优节点。',
    groups: [
      g('PROXY', 'select', ['GITHUB', 'GOOGLE', 'OPENAI', 'NETFLIX', 'YOUTUBE', 'TWITTER', 'TELEGRAM', 'AUTO', 'DIRECT']),
      g('GITHUB', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('GOOGLE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('OPENAI', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('NETFLIX', 'url-test', [], ['all'], { url: 'https://www.netflix.com', interval: '600' }),
      g('YOUTUBE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('TWITTER', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('TELEGRAM', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['9 个频道', '按网站分流'],
    recommended: true
  },
  {
    key: 'dev',
    icon: <Code2 size={28} />,
    title: '开发者模式',
    subtitle: '程序员专用',
    desc: '为开发者优化：GitHub/GitLab 拉代码飞快、Docker 镜像秒下、NPM/PyPI 不再超时、StackOverflow 秒开。',
    detail: '专门针对开发工具链优化。GitHub/GitLab/Docker Hub/npm/pip/Stack Overflow/Vercel/Cloudflare 各自选最优节点，开发体验大幅提升。',
    groups: [
      g('PROXY', 'select', ['GITHUB', 'DOCKER', 'NPM', 'GOOGLE', 'MISC-DEV', 'AUTO', 'DIRECT']),
      g('GITHUB', 'url-test', [], ['all'], { url: 'https://github.com', interval: '300' }),
      g('DOCKER', 'url-test', [], ['all'], { url: 'https://registry-1.docker.io/v2/', interval: '600' }),
      g('NPM', 'url-test', [], ['all'], { url: 'https://registry.npmjs.org', interval: '300' }),
      g('GOOGLE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('MISC-DEV', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['6 个频道', '开发加速']
  },
  {
    key: 'media',
    icon: <Tv size={28} />,
    title: '流媒体模式',
    subtitle: '追剧看片党',
    desc: 'Netflix、YouTube、Disney+、Spotify、HBO 各走各的专用线路。4K 不卡顿，音乐不中断。',
    detail: '流媒体平台各自独立选节点。Netflix 用专用解锁节点（测试间隔长避免频繁切换），YouTube 选大带宽节点，Spotify 选低延迟节点。',
    groups: [
      g('PROXY', 'select', ['NETFLIX', 'YOUTUBE', 'DISNEY', 'SPOTIFY', 'PRIME', 'HBO', 'AUTO', 'DIRECT']),
      g('NETFLIX', 'url-test', [], ['all'], { url: 'https://www.netflix.com', interval: '600', tolerance: '100' }),
      g('YOUTUBE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('DISNEY', 'url-test', [], ['all'], { url: 'https://disneyplus.com', interval: '600' }),
      g('SPOTIFY', 'url-test', [], ['all'], { url: 'https://spclient.wg.spotify.com', interval: '300' }),
      g('PRIME', 'url-test', [], ['all'], { url: 'https://www.primevideo.com', interval: '600' }),
      g('HBO', 'url-test', [], ['all'], { url: 'https://www.hbomax.com', interval: '600' }),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['7 个频道', '流媒体解锁']
  },
  {
    key: 'gaming',
    icon: <Gamepad2 size={28} />,
    title: '游戏加速模式',
    subtitle: '低延迟优先',
    desc: 'Steam、Epic、Battle.net、Xbox、PlayStation 各自选延迟最低的节点。FPS 游戏不再卡顿掉包。',
    detail: '游戏平台用 fallback（故障转移）策略，优先低延迟节点，挂了立即切备用。配合短间隔测速确保实时性。',
    groups: [
      g('PROXY', 'select', ['STEAM', 'EPIC', 'BATTLENET', 'CONSOLE', 'GAME-MISC', 'AUTO', 'DIRECT']),
      g('STEAM', 'fallback', [], ['all'], { url: 'http://www.steampowered.com', interval: '120' }),
      g('EPIC', 'fallback', [], ['all'], { url: 'https://www.epicgames.com', interval: '120' }),
      g('BATTLENET', 'fallback', [], ['all'], { url: 'https://us.battle.net', interval: '120' }),
      g('CONSOLE', 'fallback', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('GAME-MISC', 'fallback', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '120' }),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '180' })
    ],
    tags: ['6 个频道', '低延迟']
  },
  {
    key: 'balance',
    icon: <ArrowRightLeft size={28} />,
    title: '负载均衡模式',
    subtitle: '带宽最大化',
    desc: '同时利用多个节点的带宽叠加。下载速度翻倍，多人同时上网互不影响。',
    detail: 'Load-Balance 策略把流量分散到所有节点，总带宽 ≈ 所有节点之和。适合下载大文件、PT 用户、多设备家庭网络。',
    groups: [
      g('PROXY', 'select', ['BALANCE', 'FAST', 'DIRECT']),
      g('BALANCE', 'load-balance', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300', strategy: 'consistent-hashing' }),
      g('FAST', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '200' })
    ],
    tags: ['3 个策略组', '多倍带宽']
  },
  {
    key: 'ha',
    icon: <Shield size={28} />,
    title: '高可用模式',
    subtitle: '稳定第一',
    desc: '主备双保险。主节点故障瞬间切换到备用，断线概率降到最低。适合办公、远程桌面等不能断网的场景。',
    detail: 'Fallback 策略确保主节点挂了自动切备用。MAIN 组用 fallback 保证连续性，BACKUP 组用 url-test 选最优备用。',
    groups: [
      g('PROXY', 'select', ['MAIN', 'BACKUP', 'AUTO', 'DIRECT']),
      g('MAIN', 'fallback', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '180' }),
      g('BACKUP', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['4 个策略组', '主备切换']
  },
  {
    key: 'ultimate',
    icon: <Layers size={28} />,
    title: '全能模式',
    subtitle: '最全面方案',
    desc: '集大成者。按用途分 5 大类共 15 个频道：开发工具、AI 服务、流媒体、游戏、通用。每个场景都有最优线路。',
    detail: '最完整的策略组体系。开发/AI/流媒体/游戏/通用五大分区，每个分区内部再细分。适合对网络质量要求高的高级用户。',
    groups: [
      g('PROXY', 'select', [
        'DEV-GITHUB', 'DEV-DOCKER', 'DEV-NPM',
        'AI-OPENAI', 'AI-COPILOT', 'AI-ANTHROPIC',
        'MEDIA-NETFLIX', 'MEDIA-YOUTUBE', 'MEDIA-DISNEY',
        'GAME-STEAM', 'GAME-EPIC',
        'GENERAL-GOOGLE', 'GENERAL-TWITTER', 'GENERAL-TELEGRAM',
        'AUTO', 'DIRECT'
      ]),
      g('DEV-GITHUB', 'url-test', [], ['all'], { url: 'https://github.com', interval: '300' }),
      g('DEV-DOCKER', 'url-test', [], ['all'], { url: 'https://registry-1.docker.io/v2/', interval: '600' }),
      g('DEV-NPM', 'url-test', [], ['all'], { url: 'https://registry.npmjs.org', interval: '300' }),
      g('AI-OPENAI', 'url-test', [], ['all'], { url: 'https://api.openai.com', interval: '200' }),
      g('AI-COPILOT', 'url-test', [], ['all'], { url: 'https://api.githubcopilot.com', interval: '200' }),
      g('AI-ANTHROPIC', 'url-test', [], ['all'], { url: 'https://api.anthropic.com', interval: '200' }),
      g('MEDIA-NETFLIX', 'url-test', [], ['all'], { url: 'https://www.netflix.com', interval: '600' }),
      g('MEDIA-YOUTUBE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('MEDIA-DISNEY', 'url-test', [], ['all'], { url: 'https://disneyplus.com', interval: '600' }),
      g('GAME-STEAM', 'fallback', [], ['all'], { url: 'http://www.steampowered.com', interval: '120' }),
      g('GAME-EPIC', 'fallback', [], ['all'], { url: 'https://www.epicgames.com', interval: '120' }),
      g('GENERAL-GOOGLE', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('GENERAL-TWITTER', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('GENERAL-TELEGRAM', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' }),
      g('AUTO', 'url-test', [], ['all'], { url: 'http://www.gstatic.com/generate_204', interval: '300' })
    ],
    tags: ['16 个策略组', '5 大分区'],
    recommended: true
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
        <p className="textMuted" style={{ margin: '4px 0 0', fontSize: '13px' }}>选择一套预设方案，一键应用到你的代理。不懂就选带 ⭐ 的推荐。</p>
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
          共 <b>{groups.length}</b> 个策略组 · 使用 <b>{providers.length > 0 ? providers.join(', ') : '无'}</b> 节点资源
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
                    {(g.proxies.length > 0) && <span>{g.proxies.length} 个引用</span>}
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
