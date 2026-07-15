import type { ReactNode } from 'react';

export interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}

export function KpiCard({ icon, label, value, sub }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        {icon}
        <span>{label}</span>
      </div>
      <div className="kpi-card-value">{value}</div>
      {sub && <div className="kpi-card-sub">{sub}</div>}
    </div>
  );
}
