import React, { useEffect, useState } from 'react';
import { Cable, Plus, RefreshCw, Trash2, Edit, ExternalLink } from 'lucide-react';
import { Panel } from '../ui';
import { PageGuide } from '../guide';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { formatBytes, formatExpire, usagePercent, readError, validName, validURL } from '../../utils/helpers';
import type { Subscription } from '../../types';

export function Subscriptions() {
  const { setBusy, showToast, showConfirm } = useApp();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const data = await api.get<Subscription[]>('/api/subscriptions');
      setSubs(data || []);
      setError('');
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const addSub = async () => {
    if (!validName(addName)) {
      showToast('error', '订阅名称无效');
      return;
    }
    if (!validURL(addUrl)) {
      showToast('error', '订阅 URL 无效');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/subscriptions', { name: addName, url: addUrl });
      showToast('success', '订阅添加成功');
      setShowAdd(false);
      setAddName('');
      setAddUrl('');
      await load();
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const refreshSub = async (name: string) => {
    setBusy(true);
    try {
      await api.post(`/api/subscriptions/${encodeURIComponent(name)}/refresh`);
      showToast('success', '订阅更新成功');
      await load();
    } catch (err) {
      showToast('error', readError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteSub = (name: string) => {
    showConfirm(
      '确认删除',
      `确定要删除订阅 "${name}" 吗？`,
      async () => {
        setBusy(true);
        try {
          await api.delete(`/api/subscriptions/${encodeURIComponent(name)}`);
          showToast('success', '订阅已删除');
          await load();
        } catch (err) {
          showToast('error', readError(err));
        } finally {
          setBusy(false);
        }
      },
      'danger',
      '删除'
    );
  };

  return (
    <div className="stack">
      <PageGuide page="subscriptions" />
      
      <Panel title="订阅管理" icon={<Cable size={18} />}>
        <div className="subToolbar">
          <button className="primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            添加订阅
          </button>
          <button onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        {error && <p className="inlineError">{error}</p>}

        {showAdd && (
          <div className="addSubForm">
            <input
              placeholder="订阅名称"
              value={addName}
              onChange={e => setAddName(e.target.value)}
            />
            <input
              placeholder="订阅 URL"
              value={addUrl}
              onChange={e => setAddUrl(e.target.value)}
              style={{ flex: 2 }}
            />
            <button className="primary" onClick={addSub}>添加</button>
            <button onClick={() => setShowAdd(false)}>取消</button>
          </div>
        )}

        <div className="subList">
          {subs.map(sub => {
            const used = (sub.upload || 0) + (sub.download || 0);
            const total = sub.trafficTotal || 0;
            const percent = usagePercent(used, total);
            
            return (
              <div key={sub.name} className="subCard">
                <div className="subHeader">
                  <strong>{sub.name}</strong>
                  <div className="subActions">
                    <button onClick={() => refreshSub(sub.name)} title="更新">
                      <RefreshCw size={14} />
                    </button>
                    <button onClick={() => deleteSub(sub.name)} title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="subUrl">
                  <span>{sub.url}</span>
                  <a href={sub.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={12} />
                  </a>
                </div>
                
                {total > 0 && (
                  <div className="subTraffic">
                    <div className="trafficBar">
                      <div className="used" style={{ width: `${percent}%` }} />
                    </div>
                    <span>{formatBytes(used)} / {formatBytes(total)}</span>
                  </div>
                )}
                
                {sub.expire && (
                  <div className="subExpire">
                    过期时间: {formatExpire(sub.expire)}
                  </div>
                )}
                
                {sub.error && <p className="subError">{sub.error}</p>}
              </div>
            );
          })}
          {subs.length === 0 && <p className="empty">暂无订阅</p>}
        </div>
      </Panel>
    </div>
  );
}
