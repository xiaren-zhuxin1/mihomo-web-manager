import { Gauge, Activity, List, Terminal, BookOpen, Zap, ListTree, Globe2, Cable, Settings2, FileCode2, LucideIcon } from 'lucide-react';
import type { Page } from '../types';

export type NavItem = {
  id: Page;
  icon: LucideIcon;
  label: string;
  group: string;
  shortcut?: string;
  description?: string;
};

export type NavGroup = {
  name: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    name: '运行监控',
    items: [
      { id: 'overview', icon: Gauge, label: '总览', group: '运行监控', shortcut: '1', description: '系统运行状态概览' },
      { id: 'traffic', icon: Activity, label: '流量监控', group: '运行监控', shortcut: '2', description: '实时流量统计' },
      { id: 'connections', icon: List, label: '连接追踪', group: '运行监控', shortcut: '3', description: '活动连接列表' },
      { id: 'logs', icon: Terminal, label: '实时日志', group: '运行监控', shortcut: '4', description: '系统日志输出' },
    ]
  },
  {
    name: '代理路由',
    items: [
      { id: 'guide', icon: BookOpen, label: '路由向导', group: '代理路由', description: '新手入门指南' },
      { id: 'proxies', icon: Zap, label: '代理策略', group: '代理路由', shortcut: '5', description: '策略组管理' },
      { id: 'topology', icon: ListTree, label: '路由拓扑', group: '代理路由', description: '节点拓扑视图' },
      { id: 'rules', icon: Globe2, label: '规则命中', group: '代理路由', shortcut: '6', description: '规则匹配统计' },
    ]
  },
  {
    name: '配置维护',
    items: [
      { id: 'subscriptions', icon: Cable, label: '订阅管理', group: '配置维护', shortcut: '7', description: '订阅源管理' },
      { id: 'maintenance', icon: Settings2, label: '配置维护', group: '配置维护', shortcut: '8', description: '配置文件编辑' },
    ]
  },
  {
    name: '系统管理',
    items: [
      { id: 'config', icon: FileCode2, label: '系统配置', group: '系统管理', shortcut: '9', description: '系统设置' },
    ]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);

export const PAGE_SHORTCUTS: Record<string, Page> = {
  '1': 'overview',
  '2': 'traffic',
  '3': 'connections',
  '4': 'logs',
  '5': 'proxies',
  '6': 'rules',
  '7': 'subscriptions',
  '8': 'maintenance',
  '9': 'config'
};

export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: '欢迎使用 Mihomo Manager',
    description: '这是一个现代化的 Mihomo 代理管理界面，让我们快速了解主要功能。',
    page: 'overview' as Page
  },
  {
    id: 'overview',
    title: '总览页面',
    description: '这里显示系统运行状态、内存使用、连接数等关键指标。',
    target: '[data-onboarding="overview"]',
    page: 'overview' as Page
  },
  {
    id: 'proxies',
    title: '代理策略',
    description: '管理策略组和节点，切换代理节点，测试延迟。',
    target: '[data-onboarding="proxies"]',
    page: 'proxies' as Page
  },
  {
    id: 'subscriptions',
    title: '订阅管理',
    description: '添加和管理订阅源，自动更新节点列表。',
    target: '[data-onboarding="subscriptions"]',
    page: 'subscriptions' as Page
  },
  {
    id: 'maintenance',
    title: '配置维护',
    description: '编辑配置文件，管理规则，重启服务。',
    target: '[data-onboarding="maintenance"]',
    page: 'maintenance' as Page
  },
  {
    id: 'shortcuts',
    title: '快捷键',
    description: '使用数字键 1-9 快速切换页面，Ctrl+D 切换主题，Ctrl+R 刷新状态。',
    page: 'overview' as Page
  },
  {
    id: 'complete',
    title: '准备就绪',
    description: '您已完成新手引导，开始使用吧！如有问题，请查看路由向导页面。',
    page: 'overview' as Page
  }
];
