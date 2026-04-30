import React from 'react';
import { BookOpen, Globe2, ListTree, Settings2 } from 'lucide-react';
import { Panel } from '../ui';
import { setPageGlobal } from '../ui';
import type { Page } from '../../types';

export function RoutingGuide({ setPage }: { setPage: (page: Page) => void }) {
  return (
    <div className="stack">
      <section className="guideHero">
        <div>
          <span>新手路线</span>
          <h2>先理解一条连接怎么被 mihomo 处理</h2>
          <p>不用先背 YAML。你只要记住：规则决定去哪里，策略组决定怎么选节点，资源负责提供节点或规则集。</p>
        </div>
        <button className="primary" onClick={() => setPage('maintenance')}>
          <Settings2 size={16} />
          打开配置维护
        </button>
      </section>

      <div className="routeFlow">
        <div>
          <strong>1. 连接进来</strong>
          <span>浏览器、系统或 TUN 把请求交给 mihomo。</span>
        </div>
        <div>
          <strong>2. 从上到下匹配规则</strong>
          <span>例如 DOMAIN-SUFFIX,google.com,PROXY 命中后就去 PROXY。</span>
        </div>
        <div>
          <strong>3. 进入策略组</strong>
          <span>PROXY 可以手选节点，也可以引用订阅资源自动拿节点。</span>
        </div>
        <div>
          <strong>4. 最终落到节点</strong>
          <span>连接真正从某个 Trojan、Vmess、Hysteria 等节点出去。</span>
        </div>
      </div>

      <div className="guideGrid">
        <Panel title="我应该先配什么？" icon={<BookOpen size={18} />}>
          <div className="guideSteps">
            <div>
              <strong>第一步：订阅管理</strong>
              <p>把订阅接进来，它会生成 proxy-provider。资源是"节点仓库"，不是实际分流规则。</p>
              <button onClick={() => setPage('subscriptions')}>去订阅管理</button>
            </div>
            <div>
              <strong>第二步：策略组</strong>
              <p>创建或编辑 PROXY / AUTO / AI 这类策略组，把 provider 或固定节点放进去。规则只需要指向策略组。</p>
              <button onClick={() => setPage('maintenance')}>编辑策略组</button>
            </div>
            <div>
              <strong>第三步：规则</strong>
              <p>规则的目标写 PROXY、DIRECT、REJECT 或你建的策略组。越具体的规则放越前，MATCH 放最后兜底。</p>
              <button onClick={() => setPage('maintenance')}>编辑规则</button>
            </div>
          </div>
        </Panel>

        <Panel title="常见配置怎么理解？" icon={<ListTree size={18} />}>
          <div className="conceptList">
            <div>
              <strong>proxy-provider</strong>
              <span>远程订阅或本地节点文件。它只提供节点，不决定流量走向。</span>
            </div>
            <div>
              <strong>proxy-groups</strong>
              <span>策略组。规则命中后会进入这里，再由手选、测速、fallback 等方式决定具体节点。</span>
            </div>
            <div>
              <strong>rules</strong>
              <span>分流规则。从上到下匹配，命中第一条就停止。目标通常是策略组。</span>
            </div>
            <div>
              <strong>rule-provider</strong>
              <span>规则集仓库。配合 RULE-SET 使用，适合大量域名/IP 规则。</span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="直接照着做的例子" icon={<Globe2 size={18} />}>
        <div className="recipeGrid">
          <div>
            <strong>让 Google 走代理</strong>
            <code>DOMAIN-SUFFIX,google.com,PROXY</code>
            <span>目标 PROXY 是策略组，不一定是单个节点。</span>
          </div>
          <div>
            <strong>让国内 IP 直连</strong>
            <code>GEOIP,CN,DIRECT</code>
            <span>DIRECT 是内置目标，表示不经过代理。</span>
          </div>
          <div>
            <strong>兜底走代理</strong>
            <code>MATCH,PROXY</code>
            <span>放在最后，没命中的连接全部交给 PROXY。</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
