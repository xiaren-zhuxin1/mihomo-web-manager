import React from 'react';

export function Panel({ title, icon, children }: { title: string | React.ReactNode; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panelTitle">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SectionNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="sectionNote">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
