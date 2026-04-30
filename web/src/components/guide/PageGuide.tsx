import React, { useState, useEffect } from 'react';
import { X, HelpCircle, ChevronRight } from 'lucide-react';

type GuideTip = {
  id: string;
  title: string;
  content: string;
  action?: {
    label: string;
    page?: string;
  };
};

const PAGE_GUIDES: Record<string, GuideTip[]> = {
  overview: [
    {
      id: 'overview-1',
      title: '系统状态',
      content: '这里显示当前代理的核心状态，包括运行模式、内存使用和连接数。'
    },
    {
      id: 'overview-2',
      title: '当前代理',
      content: '显示当前选中的代理节点及其延迟。点击可快速切换到代理页面。'
    }
  ],
  proxies: [
    {
      id: 'proxies-1',
      title: '策略组',
      content: '左侧列表显示所有策略组，点击选择要管理的策略组。'
    },
    {
      id: 'proxies-2',
      title: '节点列表',
      content: '右侧显示该策略组下的所有节点。点击节点即可切换，点击测速按钮可测试延迟。'
    },
    {
      id: 'proxies-3',
      title: '筛选与排序',
      content: '使用搜索框筛选节点，点击"延迟"或"名称"按钮切换排序方式。'
    }
  ],
  connections: [
    {
      id: 'connections-1',
      title: '实时连接',
      content: '这里显示所有活跃的网络连接，每5秒自动刷新。'
    },
    {
      id: 'connections-2',
      title: '连接操作',
      content: '点击 X 按钮可关闭单个连接，点击"关闭全部"可断开所有连接。'
    }
  ],
  subscriptions: [
    {
      id: 'subs-1',
      title: '订阅管理',
      content: '添加和管理你的订阅链接。订阅会定期更新节点列表。'
    },
    {
      id: 'subs-2',
      title: '流量统计',
      content: '每个订阅卡片显示已用流量和总量，以及过期时间。'
    }
  ],
  maintenance: [
    {
      id: 'tun-1',
      title: 'TUN 设置',
      content: 'TUN 模式可以接管系统所有流量。启用前请检查是否有阻止项。'
    },
    {
      id: 'tun-2',
      title: '诊断信息',
      content: '如果 TUN 无法启用，查看诊断信息了解原因和解决方案。'
    }
  ],
  traffic: [
    {
      id: 'traffic-1',
      title: '实时流量',
      content: '显示当前上传和下载速度，以及累计流量统计。'
    },
    {
      id: 'traffic-2',
      title: '流量图表',
      content: '下方图表显示最近60秒的流量变化趋势。'
    }
  ],
  logs: [
    {
      id: 'logs-1',
      title: '日志级别',
      content: '选择日志级别过滤不同重要程度的信息。debug 最详细，error 最少。'
    }
  ],
  rules: [
    {
      id: 'rules-1',
      title: '规则列表',
      content: '显示所有已加载的分流规则，规则按顺序匹配，命中后停止。'
    },
    {
      id: 'rules-2',
      title: '目标筛选',
      content: '点击策略目标标签可快速筛选指向该策略的所有规则。'
    }
  ],
  providers: [
    {
      id: 'providers-1',
      title: '节点资源',
      content: '资源是节点订阅源，可以批量更新和测速。'
    },
    {
      id: 'providers-2',
      title: '节点管理',
      content: '选择资源后可查看所有节点，支持筛选、排序和单独测速。'
    }
  ],
  config: [
    {
      id: 'config-1',
      title: '配置编辑',
      content: '直接编辑配置文件。修改后需要保存并重载才能生效。'
    }
  ],
  guide: [
    {
      id: 'guide-1',
      title: '路由诊断',
      content: '自动检测配置问题并提供修复建议。'
    }
  ]
};

const STORAGE_KEY = 'mihomo-webui-guide-dismissed';

export function PageGuide({ page }: { page: string }) {
  const [visible, setVisible] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setDismissed(new Set(JSON.parse(saved)));
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const tips = PAGE_GUIDES[page] || [];
    const undismissed = tips.filter(t => !dismissed.has(t.id));
    if (undismissed.length > 0) {
      setCurrentTip(0);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [page, dismissed]);

  const tips = PAGE_GUIDES[page] || [];
  const undismissedTips = tips.filter(t => !dismissed.has(t.id));
  const tip = undismissedTips[currentTip];

  const dismissTip = () => {
    if (!tip) return;
    
    const newDismissed = new Set(dismissed);
    newDismissed.add(tip.id);
    setDismissed(newDismissed);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...newDismissed]));
    } catch {
      // Ignore
    }

    if (currentTip >= undismissedTips.length - 1) {
      setVisible(false);
    } else {
      setCurrentTip(prev => prev + 1);
    }
  };

  const dismissAll = () => {
    const newDismissed = new Set(dismissed);
    tips.forEach(t => newDismissed.add(t.id));
    setDismissed(newDismissed);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...newDismissed]));
    } catch {
      // Ignore
    }
    
    setVisible(false);
  };

  const resetAll = () => {
    setDismissed(new Set());
    localStorage.removeItem(STORAGE_KEY);
    setCurrentTip(0);
    setVisible(true);
  };

  if (!visible || !tip) return null;

  return (
    <div className="pageGuide">
      <div className="pageGuideHeader">
        <HelpCircle size={16} />
        <strong>{tip.title}</strong>
        <button className="pageGuideClose" onClick={dismissAll}>
          <X size={14} />
        </button>
      </div>
      <p className="pageGuideContent">{tip.content}</p>
      <div className="pageGuideFooter">
        <span className="pageGuideProgress">
          {currentTip + 1} / {undismissedTips.length}
        </span>
        <div className="pageGuideActions">
          <button className="pageGuideSkip" onClick={dismissTip}>
            跳过
          </button>
          <button className="pageGuideNext" onClick={dismissTip}>
            知道了
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function GuideResetButton() {
  const resetAll = () => {
    localStorage.removeItem('mihomo-webui-guide-dismissed');
    window.location.reload();
  };

  return (
    <button className="guideResetBtn" onClick={resetAll} title="重置所有引导提示">
      <HelpCircle size={14} />
      重置引导
    </button>
  );
}
