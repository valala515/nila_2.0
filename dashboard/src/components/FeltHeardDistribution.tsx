import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Ear } from 'lucide-react';
import { ChartTableToggle, type ViewMode } from './ChartTableToggle';

export interface FeltHeardDistributionProps {
  distribution: Record<number, number>;
  responseCount: number;
}

const SCORES = [1, 2, 3, 4, 5];

type ScoreRow = { score: string; count: number };

function FeltHeardChart({ rows }: { rows: ScoreRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={rows} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis dataKey="score" stroke="var(--text-muted)" fontSize={12} />
        <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
        <Tooltip contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border)', fontSize: 12 }} />
        <Bar dataKey="count" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FeltHeardTable({ rows }: { rows: ScoreRow[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Score</th>
          <th className="numeric">Responses</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.score}>
            <td>{row.score}</td>
            <td className="numeric">{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FeltHeardDistribution({ distribution, responseCount }: FeltHeardDistributionProps) {
  const [view, setView] = useState<ViewMode>('chart');
  const rows = SCORES.map((score) => ({ score: `${score}`, count: distribution[score] ?? 0 }));

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">
          <Ear size={16} /> Felt heard — score distribution
        </h2>
        <ChartTableToggle value={view} onChange={setView} />
      </div>
      {responseCount === 0 && <p className="state-message">No felt-heard responses yet in this window.</p>}
      {responseCount > 0 && (view === 'chart' ? <FeltHeardChart rows={rows} /> : <FeltHeardTable rows={rows} />)}
    </section>
  );
}
