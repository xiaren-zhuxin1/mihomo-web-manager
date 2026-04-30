import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CircleX, Globe2, ListTree, Plus, Save, Shield, Trash2, Zap } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import {
  readError, validName, validURL, validRule, validRulePayload,
  parseConfigRule, serializeConfigRule, configRuleTarget,
  rulePayloadPlaceholder, describeGroupType, describeRuleType,
  describeTarget, describeProviderType, describeProviderBehavior
} from '../../utils/helpers';
import type { ConfigModel, ConfigValidation, ConfigProxyGroup, ConfigRuleProvider } from '../../types';

export function Maintenance({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [model, setModel] = useState<ConfigModel>({ proxyGroups: [], proxyProviders: [], rules: [], ruleProviders: [] });
  const [validation, setValidation] = useState<ConfigValidation>({ ok: true, issues: [] });
  const [groupDraft, setGroupDraft] = useState<ConfigProxyGroup>({ name: '', type: 'select', proxies: [], use: [] });
  const [ruleDraft, setRuleDraft] = useState('');
  const [ruleBuilder, setRuleBuilder] = useState({ type: 'DOMAIN-SUFFIX', payload: '', target: 'PROXY' });
  const [providerDraft, setProviderDraft] = useState<ConfigRuleProvider>({ name: '', type: 'http', behavior: 'domain', url: '', path: '', interval: '86400' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const [data, validationData] = await Promise.all([
        api<ConfigModel>('/api/config/model'),
        api<ConfigValidation>('/api/config/validate')
      ]);
      setModel({
        proxyGroups: data.proxyGroups || [],
        proxyProviders: data.proxyProviders || [],
        rules: data.rules || [],
        ruleProviders: data.ruleProviders || []
      });
      setValidation({ ok: validationData.ok, issues: validationData.issues || [] });
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

  const saveGroup = async () => {
    setBusy(true);
    try {
      await api(`/api/config/proxy-groups/${encodeURIComponent(groupDraft.name)}`, { method: 'PUT', body: JSON.stringify(groupDraft) });
      setMessage(`策略组已保存：${groupDraft.name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async (name: string) => {
    if (!window.confirm(`删除策略组 ${name}？会修改 config.yaml，并在保存前自动备份。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/proxy-groups/${encodeURIComponent(name)}`, { method: 'DELETE' });
      setMessage(`策略组已删除：${name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const moveGroup = async (name: string, direction: 'up' | 'down') => {
    setBusy(true);
    try {
      await api(`/api/config/proxy-groups/${encodeURIComponent(name)}/move`, { method: 'POST', body: JSON.stringify({ direction }) });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const addRule = async () => {
    setBusy(true);
    try {
      await api('/api/config/rules', { method: 'POST', body: JSON.stringify({ rule: ruleDraft }) });
      setRuleDraft('');
      setMessage('规则已新增');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateRule = async (index: number, rule: string) => {
    setBusy(true);
    try {
      await api(`/api/config/rules/${index}`, { method: 'PUT', body: JSON.stringify({ rule }) });
      setMessage(`规则已更新：#${index}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteRule = async (index: number) => {
    if (!window.confirm(`删除规则 #${index}？会修改 config.yaml，并在保存前自动备份。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/rules/${index}`, { method: 'DELETE' });
      setMessage(`规则已删除：#${index}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const moveRule = async (index: number, direction: 'up' | 'down') => {
    setBusy(true);
    try {
      await api(`/api/config/rules/${index}/move`, { method: 'POST', body: JSON.stringify({ direction }) });
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const saveRuleProvider = async () => {
    setBusy(true);
    try {
      await api(`/api/config/rule-providers/${encodeURIComponent(providerDraft.name)}`, { method: 'PUT', body: JSON.stringify(providerDraft) });
      setMessage(`规则资源已保存：${providerDraft.name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteRuleProvider = async (name: string) => {
    if (!window.confirm(`删除 rule-provider ${name}？引用它的 RULE-SET 规则可能失效。`)) return;
    setBusy(true);
    try {
      await api(`/api/config/rule-providers/${encodeURIComponent(name)}`, { method: 'DELETE' });
      setMessage(`规则资源已删除：${name}`);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const buildRule = () => {
    const next = [ruleBuilder.type, ruleBuilder.payload, ruleBuilder.target].map((item) => item.trim()).filter(Boolean).join(',');
    setRuleDraft(next);
  };

  const groupNames = model.proxyGroups.map((item) => item.name);
  const proxyProviders = model.proxyProviders || [];
  const providerNames = model.ruleProviders.map((item) => item.name);
  const groupNameValid = validName(groupDraft.name);
  const providerNameValid = validName(providerDraft.name);
  const providerUrlValid = providerDraft.type !== 'http' || validURL(providerDraft.url || '');
  const providerPathValid = providerDraft.type !== 'file' || Boolean((providerDraft.path || '').trim());
  const intervalValid = !providerDraft.interval || /^\d+$/.test(providerDraft.interval);
  const ruleDraftValid = validRule(ruleDraft);
  const errorCount = validation.issues.filter((item) => item.level === 'error').length;
  const warningCount = validation.issues.filter((item) => item.level === 'warning').length;
  const ruleTargetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    model.rules.forEach((rule) => {
      const target = configRuleTarget(rule);
      if (target) counts.set(target, (counts.get(target) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [model.rules]);

  return (
    <div className="stack">
      <FlowHint upstream={{ label: '订阅管理 - 节点来源', page: 'subscriptions' }} downstream={{ label: '代理策略 - 节点选择', page: 'proxies' }} />
      {message && <p className="message">{message}</p>}
      {error && <p className="inlineError">{error}</p>}
      <div className="grid">
        <Panel title="配置体检" icon={<Shield size={18} />}>
          <Metric label="状态" value={validation.ok ? 'OK' : '需要处理'} />
          <Metric label="错误 / 警告" value={`${errorCount} / ${warningCount}`} />
        </Panel>
        <Panel title="规则目标分布" icon={<Globe2 size={18} />}>
          <div className="miniTargetList">
            {ruleTargetCounts.slice(0, 6).map(([target, count]) => (
              <span key={target}>{target} · {count}</span>
            ))}
            {ruleTargetCounts.length === 0 && <span>-</span>}
          </div>
        </Panel>
        <Panel title="引用关系" icon={<ListTree size={18} />}>
          <Metric label="策略组" value={String(model.proxyGroups.length)} />
          <Metric label="rule-provider" value={String(model.ruleProviders.length)} />
        </Panel>
      </div>
      {validation.issues.length > 0 && (
        <Panel title={`风险提示 (${validation.issues.length})`} icon={<AlertTriangle size={18} />}>
          <div className="issueList">
            {validation.issues.map((issue, index) => (
              <div className={`issueCard ${issue.level}`} key={`${issue.scope}-${issue.name}-${index}`}>
                <span>{issue.level}</span>
                <strong>{issue.scope} · {issue.name}</strong>
                <p>{issue.message}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <div className="maintainGrid">
        <Panel title={`策略组维护 (${model.proxyGroups.length})`} icon={<Zap size={18} />}>
          <div className="formTip">策略组名称建议只使用字母、数字、中文、空格、下划线、中横线。节点和资源尽量点选，不需要手写 YAML 数组。</div>
          <div className="maintainForm">
            <input className={groupDraft.name && !groupNameValid ? 'invalidInput' : ''} placeholder="策略组名称，例如 PROXY / AI / 香港节点" value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} />
            {groupDraft.name && !groupNameValid && <div className="fieldError">名称不能包含逗号、冒号、方括号等 YAML 特殊字符。</div>}
            <select title={describeGroupType(groupDraft.type)} value={groupDraft.type} onChange={(event) => setGroupDraft({ ...groupDraft, type: event.target.value })}>
              {['select', 'url-test', 'fallback', 'load-balance', 'relay'].map((item) => <option key={item} title={describeGroupType(item)}>{item}</option>)}
            </select>
            <div className="selectTip">{describeGroupType(groupDraft.type)}</div>
            <ChipEditor
              label="固定节点 / 策略组"
              tip="适合 DIRECT、REJECT、其他策略组，或少量固定节点。大量订阅节点建议用下面的 use。"
              values={groupDraft.proxies || []}
              options={[...new Set(['DIRECT', 'REJECT', ...groupNames.filter((name) => name !== groupDraft.name)])]}
              placeholder="输入或选择节点/策略组"
              onChange={(values) => setGroupDraft({ ...groupDraft, proxies: values })}
            />
            <ChipEditor
              label="引用 proxy-provider"
              tip="这里选择订阅资源，mihomo 会把资源内节点加入该策略组。"
              values={groupDraft.use || []}
              options={proxyProviders}
              placeholder="选择 proxy-provider"
              onChange={(values) => setGroupDraft({ ...groupDraft, use: values })}
            />
            <div className="toolbar">
              <button className="primary" onClick={saveGroup} disabled={!groupDraft.name.trim() || !groupNameValid}>
                <Save size={16} />
                保存策略组
              </button>
              <button onClick={() => setGroupDraft({ name: '', type: 'select', proxies: [], use: [] })}>
                <Plus size={16} />
                新建
              </button>
            </div>
          </div>
          <div className="maintainList">
            {model.proxyGroups.map((item) => (
              <div className="maintainRow" key={item.name}>
                <button onClick={() => setGroupDraft(item)}>
                  <span>{item.name}</span>
                  <small>{item.type} · proxies {item.proxies?.length || 0} · use {item.use?.length || 0}</small>
                </button>
                <button className="iconButton" title="上移策略组" onClick={() => moveGroup(item.name, 'up')}>
                  <ArrowUp size={16} />
                </button>
                <button className="iconButton" title="下移策略组" onClick={() => moveGroup(item.name, 'down')}>
                  <ArrowDown size={16} />
                </button>
                <button className="iconButton danger" title="删除策略组" onClick={() => deleteGroup(item.name)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={`规则维护 (${model.rules.length})`} icon={<Globe2 size={18} />}>
          <div className="formTip">普通规则用构建器生成；`RULE-SET` 会从 rule-provider 下拉选择。只有特殊高级规则才需要手写完整字符串。</div>
          <div className="ruleBuilder">
            <select title={describeRuleType(ruleBuilder.type)} value={ruleBuilder.type} onChange={(event) => setRuleBuilder({ ...ruleBuilder, type: event.target.value })}>
              {['DOMAIN-SUFFIX', 'DOMAIN', 'DOMAIN-KEYWORD', 'GEOSITE', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'RULE-SET', 'PROCESS-NAME', 'MATCH'].map((item) => <option key={item} title={describeRuleType(item)}>{item}</option>)}
            </select>
            {ruleBuilder.type === 'RULE-SET' ? (
              <select value={ruleBuilder.payload} onChange={(event) => setRuleBuilder({ ...ruleBuilder, payload: event.target.value })}>
                <option value="">选择 rule-provider</option>
                {providerNames.map((item) => <option key={item}>{item}</option>)}
              </select>
            ) : (
              <input className={ruleBuilder.payload && !validRulePayload(ruleBuilder.type, ruleBuilder.payload) ? 'invalidInput' : ''} placeholder={rulePayloadPlaceholder(ruleBuilder.type)} value={ruleBuilder.payload} onChange={(event) => setRuleBuilder({ ...ruleBuilder, payload: event.target.value })} />
            )}
            <select title={describeTarget(ruleBuilder.target)} value={ruleBuilder.target} onChange={(event) => setRuleBuilder({ ...ruleBuilder, target: event.target.value })}>
              {[...new Set(['PROXY', 'DIRECT', 'REJECT', ...groupNames])].map((item) => <option key={item} title={describeTarget(item)}>{item}</option>)}
            </select>
            <button onClick={buildRule}>生成</button>
          </div>
          <div className="selectTip">{describeRuleType(ruleBuilder.type)} 目标：{describeTarget(ruleBuilder.target)}</div>
          <div className="toolbar">
            <input className={ruleDraft && !ruleDraftValid ? 'wideInput invalidInput' : 'wideInput'} placeholder="DOMAIN-SUFFIX,example.com,PROXY" value={ruleDraft} onChange={(event) => setRuleDraft(event.target.value)} />
            <button className="primary" onClick={addRule} disabled={!ruleDraft.trim() || !ruleDraftValid}>
              <Plus size={16} />
              新增规则
            </button>
          </div>
          {ruleDraft && !ruleDraftValid && <div className="fieldError">规则至少需要"类型,内容,目标"，MATCH 至少需要"MATCH,目标"。</div>}
          <div className="maintainList tall">
            {model.rules.map((rule, index) => (
              <RuleEditorRow
                key={`${index}-${rule}`}
                index={index}
                rule={rule}
                targets={[...new Set(['PROXY', 'DIRECT', 'REJECT', ...groupNames])]}
                ruleProviders={providerNames}
                onSave={updateRule}
                onDelete={deleteRule}
                onMove={moveRule}
              />
            ))}
          </div>
        </Panel>

        <Panel title={`规则组 Provider (${model.ruleProviders.length})`} icon={<ListTree size={18} />}>
          <div className="formTip">http 类型必须填写 URL，file 类型必须填写 path。interval 只填秒数，例如 86400。</div>
          <div className="maintainForm">
            <input className={providerDraft.name && !providerNameValid ? 'invalidInput' : ''} placeholder="资源名称，例如 private-direct" value={providerDraft.name} onChange={(event) => setProviderDraft({ ...providerDraft, name: event.target.value })} />
            {providerDraft.name && !providerNameValid && <div className="fieldError">名称不能包含逗号、冒号、方括号等 YAML 特殊字符。</div>}
            {providerNames.length > 0 && <div className="relationHint">规则里用 `RULE-SET,名称,策略组` 引用这些资源。</div>}
            <div className="formGrid2">
              <select title={describeProviderType(providerDraft.type)} value={providerDraft.type} onChange={(event) => setProviderDraft({ ...providerDraft, type: event.target.value })}>
                {['http', 'file', 'inline'].map((item) => <option key={item} title={describeProviderType(item)}>{item}</option>)}
              </select>
              <select title={describeProviderBehavior(providerDraft.behavior)} value={providerDraft.behavior} onChange={(event) => setProviderDraft({ ...providerDraft, behavior: event.target.value })}>
                {['domain', 'ipcidr', 'classical'].map((item) => <option key={item} title={describeProviderBehavior(item)}>{item}</option>)}
              </select>
            </div>
            <div className="selectTip">{describeProviderType(providerDraft.type)} {describeProviderBehavior(providerDraft.behavior)}</div>
            <input className={!providerUrlValid ? 'invalidInput' : ''} placeholder="https://example.com/rules.yaml" value={providerDraft.url || ''} onChange={(event) => setProviderDraft({ ...providerDraft, url: event.target.value })} />
            {!providerUrlValid && <div className="fieldError">http provider 需要 http/https URL。</div>}
            <input className={!providerPathValid ? 'invalidInput' : ''} placeholder="./rules/private.yaml" value={providerDraft.path || ''} onChange={(event) => setProviderDraft({ ...providerDraft, path: event.target.value })} />
            {!providerPathValid && <div className="fieldError">file provider 需要 path。</div>}
            <input className={!intervalValid ? 'invalidInput' : ''} placeholder="86400" value={providerDraft.interval || ''} onChange={(event) => setProviderDraft({ ...providerDraft, interval: event.target.value })} />
            {!intervalValid && <div className="fieldError">interval 只能填写秒数。</div>}
            <button className="primary" onClick={saveRuleProvider} disabled={!providerDraft.name.trim() || !providerNameValid || !providerUrlValid || !providerPathValid || !intervalValid}>
              <Save size={16} />
              保存资源
            </button>
          </div>
          <div className="maintainList">
            {model.ruleProviders.map((item) => (
              <div className="maintainRow" key={item.name}>
                <button onClick={() => setProviderDraft(item)}>
                  <span>{item.name}</span>
                  <small>{item.type} · {item.behavior} · {item.url || item.path || '-'}</small>
                </button>
                <button className="iconButton danger" title="删除规则组" onClick={() => deleteRuleProvider(item.name)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RuleEditorRow({
  index,
  rule,
  targets,
  ruleProviders,
  onSave,
  onDelete,
  onMove
}: {
  index: number;
  rule: string;
  targets: string[];
  ruleProviders: string[];
  onSave: (index: number, rule: string) => void;
  onDelete: (index: number) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}) {
  const [parsed, setParsed] = useState(parseConfigRule(rule));
  useEffect(() => setParsed(parseConfigRule(rule)), [rule]);
  const isMatch = parsed.type === 'MATCH';
  const isRuleSet = parsed.type === 'RULE-SET';
  const value = serializeConfigRule(parsed);
  const isValid = validRule(value);
  return (
    <div className={isValid ? 'ruleEditRow' : 'ruleEditRow invalid'}>
      <span>#{index}</span>
      <div className="ruleEditMain">
        <div className="ruleFields">
          <select title={describeRuleType(parsed.type)} value={parsed.type} onChange={(event) => setParsed({ ...parsed, type: event.target.value, payload: event.target.value === 'MATCH' ? '' : parsed.payload })}>
            {['DOMAIN-SUFFIX', 'DOMAIN', 'DOMAIN-KEYWORD', 'GEOSITE', 'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'RULE-SET', 'PROCESS-NAME', 'MATCH'].map((item) => <option key={item} title={describeRuleType(item)}>{item}</option>)}
          </select>
          {isMatch ? (
            <input value="MATCH" disabled />
          ) : isRuleSet ? (
            <select value={parsed.payload} onChange={(event) => setParsed({ ...parsed, payload: event.target.value })}>
              <option value="">选择 rule-provider</option>
              {ruleProviders.map((item) => <option key={item}>{item}</option>)}
            </select>
          ) : (
            <input className={parsed.payload && !validRulePayload(parsed.type, parsed.payload) ? 'invalidInput' : ''} value={parsed.payload} placeholder={rulePayloadPlaceholder(parsed.type)} onChange={(event) => setParsed({ ...parsed, payload: event.target.value })} />
          )}
          <select title={describeTarget(parsed.target)} value={parsed.target} onChange={(event) => setParsed({ ...parsed, target: event.target.value })}>
            <option value="">选择目标</option>
            {targets.map((item) => <option key={item} title={describeTarget(item)}>{item}</option>)}
          </select>
        </div>
        <div className="rulePreview">
          <span>{parsed.type || '-'}</span>
          {!isMatch && <span>{parsed.payload || '-'}</span>}
          <strong>{parsed.target || '-'}</strong>
        </div>
      </div>
      <div className="ruleEditActions">
        <button className="iconButton" title="保存规则" onClick={() => onSave(index, value)} disabled={!isValid}>
          <Save size={15} />
        </button>
        <button className="iconButton" title="上移规则" onClick={() => onMove(index, 'up')}>
          <ArrowUp size={15} />
        </button>
        <button className="iconButton" title="下移规则" onClick={() => onMove(index, 'down')}>
          <ArrowDown size={15} />
        </button>
        <button className="iconButton danger" title="删除规则" onClick={() => onDelete(index)}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function ChipEditor({
  label,
  tip,
  values,
  options,
  placeholder,
  onChange
}: {
  label: string;
  tip: string;
  values: string[];
  options: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = (value: string) => {
    const next = value.trim();
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
    setDraft('');
  };
  return (
    <div className="chipEditor">
      <div className="chipHeader">
        <strong>{label}</strong>
        <span>{tip}</span>
      </div>
      <div className="chipList">
        {values.map((item) => (
          <button key={item} className="chip" onClick={() => onChange(values.filter((value) => value !== item))}>
            {item}
            <CircleX size={13} />
          </button>
        ))}
        {values.length === 0 && <span className="chipEmpty">未选择</span>}
      </div>
      <div className="chipAdd">
        <select value="" onChange={(event) => add(event.target.value)}>
          <option value="">{placeholder}</option>
          {options.filter((item) => !values.includes(item)).map((item) => <option key={item} title={describeTarget(item)}>{item}</option>)}
        </select>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="手动输入高级值" />
        <button onClick={() => add(draft)} disabled={!draft.trim()}>
          <Plus size={15} />
          添加
        </button>
      </div>
    </div>
  );
}
