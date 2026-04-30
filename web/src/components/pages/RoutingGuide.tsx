import React, { useEffect, useState } from 'react';
import { Compass, ArrowRight, Check, X, AlertTriangle, HelpCircle, RefreshCw } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { readError } from '../../utils/helpers';

type GuideStep = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'checking' | 'success' | 'error' | 'warning';
  detail?: string;
  action?: {
    label: string;
    handler: () => void;
  };
};

export function RoutingGuide() {
  const { setBusy, showToast, setPage } = useApp();
  const [steps, setSteps] = useState<GuideStep[]>([
    {
      id: 'config',
      title: '检查配置文件',
      description: '验证配置文件格式和必要字段',
      status: 'pending'
    },
    {
      id: 'proxies',
      title: '检查代理节点',
      description: '确认至少有一个可用的代理节点',
      status: 'pending'
    },
    {
      id: 'groups',
      title: '检查策略组',
      description: '确认策略组配置正确',
      status: 'pending'
    },
    {
      id: 'rules',
      title: '检查规则',
      description: '确认分流规则已配置',
      status: 'pending'
    },
    {
      id: 'dns',
      title: '检查 DNS',
      description: '确认 DNS 配置正确',
      status: 'pending'
    },
    {
      id: 'connection',
      title: '测试连接',
      description: '测试代理连接是否正常',
      status: 'pending'
    }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState('');

  const updateStep = (id: string, updates: Partial<GuideStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...updates } : step
    ));
  };

  const checkConfig = async () => {
    updateStep('config', { status: 'checking' });
    try {
      const data = await api.get<{ ok: boolean; issues?: Array<{ level: string; message: string }> }>('/api/config/validate');
      if (data.ok) {
        updateStep('config', { status: 'success', detail: '配置文件格式正确' });
        return true;
      } else {
        const errors = data.issues?.filter(i => i.level === 'error') || [];
        if (errors.length > 0) {
          updateStep('config', {
            status: 'error',
            detail: errors.map(e => e.message).join('; ')
          });
          return false;
        }
        updateStep('config', { status: 'warning', detail: '配置有警告，但不影响使用' });
        return true;
      }
    } catch (err) {
      updateStep('config', { status: 'error', detail: readError(err) });
      return false;
    }
  };

  const checkProxies = async () => {
    updateStep('proxies', { status: 'checking' });
    try {
      const data = await api.get<{ proxies: Record<string, { type: string; alive?: boolean }> }>('/api/mihomo/proxies');
      const proxies = Object.values(data.proxies || {});
      const nodeCount = proxies.filter(p => !['Selector', 'URLTest', 'Fallback', 'Direct', 'Reject'].includes(p.type)).length;
      
      if (nodeCount > 0) {
        updateStep('proxies', { status: 'success', detail: `发现 ${nodeCount} 个代理节点` });
        return true;
      }
      updateStep('proxies', { status: 'warning', detail: '未发现代理节点，请检查订阅' });
      return false;
    } catch (err) {
      updateStep('proxies', { status: 'error', detail: readError(err) });
      return false;
    }
  };

  const checkGroups = async () => {
    updateStep('groups', { status: 'checking' });
    try {
      const data = await api.get<{ proxies: Record<string, { type: string; all?: string[] }> }>('/api/mihomo/proxies');
      const groups = Object.values(data.proxies || {}).filter(p =>
        ['Selector', 'URLTest', 'Fallback', 'LoadBalance'].includes(p.type)
      );
      
      if (groups.length > 0) {
        updateStep('groups', { status: 'success', detail: `发现 ${groups.length} 个策略组` });
        return true;
      }
      updateStep('groups', { status: 'warning', detail: '未发现策略组' });
      return false;
    } catch (err) {
      updateStep('groups', { status: 'error', detail: readError(err) });
      return false;
    }
  };

  const checkRules = async () => {
    updateStep('rules', { status: 'checking' });
    try {
      const data = await api.get<{ rules: unknown[] }>('/api/mihomo/rules');
      const ruleCount = data.rules?.length || 0;
      
      if (ruleCount > 0) {
        updateStep('rules', { status: 'success', detail: `已加载 ${ruleCount} 条规则` });
        return true;
      }
      updateStep('rules', { status: 'warning', detail: '未加载任何规则' });
      return false;
    } catch (err) {
      updateStep('rules', { status: 'error', detail: readError(err) });
      return false;
    }
  };

  const checkDns = async () => {
    updateStep('dns', { status: 'checking' });
    try {
      const data = await api.get<{ dns?: { enable?: boolean; 'enhanced-mode'?: string } }>('/api/mihomo/configs');
      if (data.dns?.enable) {
        updateStep('dns', { status: 'success', detail: `DNS 已启用，模式: ${data.dns['enhanced-mode'] || 'normal'}` });
        return true;
      }
      updateStep('dns', { status: 'warning', detail: 'DNS 未启用或未配置' });
      return false;
    } catch (err) {
      updateStep('dns', { status: 'error', detail: readError(err) });
      return false;
    }
  };

  const checkConnection = async () => {
    updateStep('connection', { status: 'checking' });
    try {
      const data = await api.get<{ delay: number }>('/api/mihomo/proxies/PROXY/delay?timeout=5000&url=https://www.gstatic.com/generate_204');
      if (data.delay > 0) {
        updateStep('connection', { status: 'success', detail: `连接正常，延迟: ${data.delay}ms` });
        return true;
      }
      updateStep('connection', { status: 'error', detail: '代理连接失败' });
      return false;
    } catch (err) {
      updateStep('connection', { status: 'error', detail: readError(err) });
      return false;
    }
  };

  const runAllChecks = async () => {
    setBusy(true);
    setError('');
    
    const checks = [checkConfig, checkProxies, checkGroups, checkRules, checkDns, checkConnection];
    
    for (let i = 0; i < checks.length; i++) {
      setCurrentStep(i);
      await checks[i]();
    }
    
    setCurrentStep(-1);
    setBusy(false);
  };

  useEffect(() => {
    runAllChecks();
  }, []);

  const getStepIcon = (status: GuideStep['status']) => {
    switch (status) {
      case 'success': return <Check size={16} className="iconSuccess" />;
      case 'error': return <X size={16} className="iconError" />;
      case 'warning': return <AlertTriangle size={16} className="iconWarning" />;
      case 'checking': return <span className="spinner" />;
      default: return <HelpCircle size={16} className="iconPending" />;
    }
  };

  const successCount = steps.filter(s => s.status === 'success').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const warningCount = steps.filter(s => s.status === 'warning').length;

  return (
    <div className="stack">
      <PageGuide page="guide" />
      
      <Panel title="路由诊断向导" icon={<Compass size={18} />}>
        {error && <p className="inlineError">{error}</p>}

        <div className="guideSummary">
          <span className="success">{successCount} 通过</span>
          <span className="warning">{warningCount} 警告</span>
          <span className="error">{errorCount} 错误</span>
        </div>

        <div className="guideSteps">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`guideStep ${step.status} ${currentStep === index ? 'active' : ''}`}
            >
              <div className="stepHeader">
                {getStepIcon(step.status)}
                <strong>{step.title}</strong>
              </div>
              <p className="stepDescription">{step.description}</p>
              {step.detail && (
                <p className={`stepDetail ${step.status}`}>{step.detail}</p>
              )}
              {step.status === 'error' && (
                <button
                  className="stepAction"
                  onClick={() => {
                    if (step.id === 'proxies' || step.id === 'groups') {
                      setPage('proxies');
                    } else if (step.id === 'rules') {
                      setPage('rules');
                    } else if (step.id === 'config') {
                      setPage('maintenance');
                    }
                  }}
                >
                  前往修复 <ArrowRight size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="guideActions">
          <button className="primary" onClick={runAllChecks}>
            <RefreshCw size={16} />
            重新检测
          </button>
        </div>
      </Panel>
    </div>
  );
}
