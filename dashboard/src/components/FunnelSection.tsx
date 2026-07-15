import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { TrendingDown } from 'lucide-react';
import { ChartTableToggle, type ViewMode } from './ChartTableToggle';
import type { FunnelStep } from '../types';

export interface FunnelSectionProps {
  funnelByTurn: FunnelStep[];
  funnelByField: FunnelStep[];
}

type Dimension = 'turn' | 'field';

const BAR_COLOR = 'var(--series-1)';

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const height = Math.max(steps.length * 36, 120);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={[...steps]} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--gridline)" />
        <XAxis type="number" stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
        <YAxis type="category" dataKey="label" stroke="var(--text-muted)" fontSize={12} width={160} />
        <Tooltip
          formatter={(_value, _name, item) => {
            const step = item.payload as FunnelStep;
            return [`${step.reachedCount} reached · ${Math.round(step.dropOffRate * 100)}% drop-off`, step.label];
          }}
          contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', fontSize: 12 }}
        />
        <Bar dataKey="reachedCount" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FunnelTable({ steps }: { steps: FunnelStep[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Step</th>
          <th className="numeric">Reached</th>
          <th className="numeric">Drop-off</th>
          <th className="numeric">Drop-off %</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step) => (
          <tr key={step.key}>
            <td>{step.label}</td>
            <td className="numeric">{step.reachedCount}</td>
            <td className="numeric">{step.dropOffCount}</td>
            <td className="numeric">{Math.round(step.dropOffRate * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * SPEC: FunnelSection
 * Назначение: показать, на каком шаге интервью уходят пользователи — с
 *   переключением "по ходу / по полю" и "chart / table".
 * Входы/Выход: funnelByTurn + funnelByField → секция дашборда
 * Разрешённые side effects: нет (чистый UI, локальный state переключателей)
 */
export function FunnelSection({ funnelByTurn, funnelByField }: FunnelSectionProps) {
  const [dimension, setDimension] = useState<Dimension>('turn');
  const [view, setView] = useState<ViewMode>('chart');
  const steps = dimension === 'turn' ? funnelByTurn : funnelByField;

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">
          <TrendingDown size={16} /> Drop-off funnel
        </h2>
        <div className="section-controls">
          <div className="segmented" role="group" aria-label="Funnel dimension">
            <button type="button" aria-pressed={dimension === 'turn'} onClick={() => setDimension('turn')}>
              By turn
            </button>
            <button type="button" aria-pressed={dimension === 'field'} onClick={() => setDimension('field')}>
              By question
            </button>
          </div>
          <ChartTableToggle value={view} onChange={setView} />
        </div>
      </div>
      {steps.length === 0 && <p className="state-message">No interview turns recorded yet in this window.</p>}
      {steps.length > 0 && (view === 'chart' ? <FunnelChart steps={steps} /> : <FunnelTable steps={steps} />)}
    </section>
  );
}
