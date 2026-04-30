import React from 'react';
import type { Page } from '../../types';

export let setPageGlobal: (page: Page) => void = () => {};

export function initSetPage(fn: (page: Page) => void) {
  setPageGlobal = fn;
}

export function FlowHint({ upstream, downstream }: { upstream?: { label: string; page: Page }; downstream?: { label: string; page: Page } }) {
  return (
    <div className="flowHint">
      {upstream && (
        <button className="flowLink upstream" onClick={() => setPageGlobal(upstream.page)}>
          <span style={{ fontSize: 14 }}>↑</span>
          上游：{upstream.label}
        </button>
      )}
      {downstream && (
        <button className="flowLink downstream" onClick={() => setPageGlobal(downstream.page)}>
          下游：{downstream.label}
          <span style={{ fontSize: 14 }}>↓</span>
        </button>
      )}
    </div>
  );
}
