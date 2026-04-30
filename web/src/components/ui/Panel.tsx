import React, { ReactNode } from 'react';

type PanelProps = {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  onboardingId?: string;
};

export function Panel({ title, icon, children, className = '', onboardingId }: PanelProps) {
  return (
    <section className={`panel ${className}`} data-onboarding={onboardingId}>
      {title && (
        <div className="panelHeader">
          {icon && <span className="panelIcon">{icon}</span>}
          <h2>{title}</h2>
        </div>
      )}
      <div className="panelContent">{children}</div>
    </section>
  );
}

type PanelRowProps = {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
};

export function PanelRow({ label, value, children }: PanelRowProps) {
  return (
    <div className="panelRow">
      <span className="panelLabel">{label}</span>
      <span className="panelValue">{value || children}</span>
    </div>
  );
}
