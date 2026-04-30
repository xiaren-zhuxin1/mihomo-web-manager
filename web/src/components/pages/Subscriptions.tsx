import React, { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Cable, FileCode2, ListTree, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Panel, Metric, FlowHint } from '../ui';
import { api } from '../../services/api';
import { readError, formatBytes, formatExpire, formatDate, formatUsage, usagePercent, validURL, validDate } from '../../utils/helpers';
import type { Subscription } from '../../types';

export function Subscriptions({ setBusy }: { setBusy: (busy: boolean) => void }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newURL, setNewURL] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const managed = useMemo(() => subscriptions.filter((item) => item.managed), [subscriptions]);
  const configProviders = useMemo(() => subscriptions.filter((item) => !item.managed), [subscriptions]);
  const broken = useMemo(() => subscriptions.filter((item) => !item.exists || item.error), [subscriptions]);

  const load = async () => {
    setBusy(true);
    try {
      const data = await api<{ subscriptions: Subscription[] }>('/api/subscriptions');
      setSubscriptions(data.subscriptions || []);
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

  const createSubscription = async () => {
    setBusy(true);
    try {
      await api('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ name: newName, url: newURL })
      });
      setNewName('');
      setNewURL('');
      setMessage('订阅已创建');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const updateSubscription = async (id: string) => {
    setBusy(true);
    try {
      await api(`/api/subscriptions/${id}/update`, { method: 'POST', body: '{}' });
      setMessage('订阅更新完成');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const saveSubscription = async (id: string, patch: { name: string; url: string }) => {
    setBusy(true);
    try {
      await api(`/api/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setMessage('订阅已保存');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteSubscription = async (id: string) => {
    if (!window.confirm('删除该订阅？会从配置中移除对应 proxy-provider。')) return;
    setBusy(true);
    try {
      await api(`/api/subscriptions/${id}`, { method: 'DELETE' });
      setMessage('订阅已删除');
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <FlowHint downstream={{ label: '代理策略 - 节点选择', page: 'proxies' }} />
      {message && <p className="message">{message}</p>}
      {error && <p className="inlineError">{error}</p>}
      <Panel title="新增订阅" icon={<Plus size={18} />}>
        <div className="subscriptionAdd">
          <input placeholder="订阅名称" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <input placeholder="订阅链接" value={newURL} onChange={(event) => setNewURL(event.target.value)} />
          <button className="primary" onClick={createSubscription} disabled={!newURL.trim()}>
            <Plus size={16} />
            新建
          </button>
        </div>
      </Panel>

      <div className="grid">
        <Panel title="Manager 接管订阅" icon={<Cable size={18} />}>
          <SubscriptionGrid items={managed} empty="还没有由 Manager 接管的订阅" onUpdate={updateSubscription} onSave={saveSubscription} onDelete={deleteSubscription} />
        </Panel>
        <Panel title="配置引用资源" icon={<ListTree size={18} />}>
          <SubscriptionGrid items={configProviders} empty="配置里没有额外 proxy-provider" onUpdate={updateSubscription} onSave={saveSubscription} onDelete={deleteSubscription} />
        </Panel>
      </div>

      {broken.length > 0 && (
        <Panel title="诊断" icon={<AlertTriangle size={18} />}>
          <div className="diagnosticList">
            {broken.map((item) => (
              <div className="diagnostic" key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.error || `provider 文件不存在：${item.path || item.providerName}`}</span>
                {!item.managed && !item.exists && (
                  <button className="danger compactButton" onClick={() => deleteSubscription(item.id)}>
                    <Trash2 size={16} />
                    从配置移除引用
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function SubscriptionGrid({
  items,
  empty,
  onUpdate,
  onSave,
  onDelete
}: {
  items: Subscription[];
  empty: string;
  onUpdate: (id: string) => void;
  onSave: (id: string, patch: { name: string; url: string }) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="subscriptionGrid">
      {items.map((item) => <SubscriptionCard key={item.id} item={item} onUpdate={onUpdate} onSave={onSave} onDelete={onDelete} />)}
      {items.length === 0 && <p className="empty">{empty}</p>}
    </div>
  );
}

function SubscriptionCard({
  item,
  onUpdate,
  onSave,
  onDelete
}: {
  item: Subscription;
  onUpdate: (id: string) => void;
  onSave: (id: string, patch: { name: string; url: string }) => void;
  onDelete?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [url, setURL] = useState(item.url);
  useEffect(() => {
    setName(item.name);
    setURL(item.url);
  }, [item.name, item.url]);
  const canEdit = item.managed;
  const status = item.error ? '失败' : item.lastStatus === 'updated' ? '已更新' : validDate(item.updatedAt) ? '已更新' : '未刷新';
  return (
    <div className={item.exists ? 'subscriptionCard' : 'subscriptionCard warning'}>
      <div className="subHead">
        <div>
          <strong>{item.name}</strong>
          <span>{item.managed ? 'Manager' : 'Config'} · {item.type || 'provider'} · {item.providerName}</span>
        </div>
        <div className="subActions">
          {canEdit && (
            <button className="iconButton" title="编辑订阅" onClick={() => setEditing((value) => !value)}>
              <FileCode2 size={16} />
            </button>
          )}
          <button className="iconButton" title="刷新订阅" onClick={() => onUpdate(item.id)} disabled={!item.exists}>
            <RefreshCw size={16} />
          </button>
          {onDelete && item.managed && (
            <button className="iconButton" title="删除订阅" onClick={() => onDelete(item.id)}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="subscriptionEdit">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="订阅名称" />
          <input className={url && !validURL(url) ? 'invalidInput' : ''} value={url} onChange={(event) => setURL(event.target.value)} placeholder="https://example.com/sub" />
          <button className="primary" onClick={() => { onSave(item.id, { name, url }); setEditing(false); }} disabled={!validURL(url)}>
            <Save size={16} />
            保存
          </button>
        </div>
      ) : (
        <p className="subUrl">{item.url || item.path || 'mihomo provider'}</p>
      )}
      {!item.exists && <p className="inlineError">配置引用的 provider 文件不存在，无法刷新。</p>}
      <div className="subscriptionStats">
        <Metric label="节点数" value={String(item.nodeCount || 0)} />
        <Metric label="状态" value={status} />
        <Metric label="更新时间" value={validDate(item.updatedAt) ? formatDate(item.updatedAt!) : '-'} />
      </div>
      <div className="usageBar">
        <span style={{ width: `${usagePercent(item)}%` }} />
      </div>
      <div className="subMeta">
        <span>{formatUsage(item)}</span>
        <span>{item.expire ? `到期：${formatExpire(item.expire)}` : '无到期信息'}</span>
      </div>
      {item.error ? <p className="inlineError">{item.error}</p> : null}
    </div>
  );
}
