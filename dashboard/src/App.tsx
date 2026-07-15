import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Ear, DollarSign, UserCheck } from 'lucide-react';
import { fetchDashboardMetrics, getStoredToken, storeToken, clearStoredToken, UnauthorizedError } from './api';
import type { DashboardMetrics } from './types';
import { KpiCard } from './components/KpiCard';
import { FunnelSection } from './components/FunnelSection';
import { FeltHeardDistribution } from './components/FeltHeardDistribution';
import { ComingSoonSection } from './components/ComingSoonSection';
import { TokenGate } from './components/TokenGate';
import { UserHistoryPanel } from './components/UserHistoryPanel';
import { ConversationsTable } from './components/ConversationsTable';

const WINDOW_OPTIONS = [7, 30, 90] as const;

function formatPercent(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)}%`;
}

function formatUsd(amount: number | null): string {
  return amount === null ? '—' : `$${amount.toFixed(3)}`;
}

interface DashboardBodyProps {
  loading: boolean;
  metrics: DashboardMetrics | null;
  sinceDays: number;
}

function DashboardBody({ loading, metrics, sinceDays }: DashboardBodyProps) {
  if (loading && !metrics) return <p className="state-message">Loading metrics…</p>;
  if (!metrics) return <p className="state-message">Could not load metrics.</p>;

  return (
    <>
      <div className="kpi-row">
        <KpiCard
          icon={<CheckCircle2 size={16} />}
          label="Interview completion"
          value={formatPercent(metrics.interviewCompletion.completionRate)}
          sub={`${metrics.interviewCompletion.completedCount} of ${metrics.interviewCompletion.startedCount} started`}
        />
        <KpiCard
          icon={<Ear size={16} />}
          label="Felt heard score"
          value={metrics.feltHeard.averageScore === null ? '—' : `${metrics.feltHeard.averageScore.toFixed(1)} / 5`}
          sub={`${metrics.feltHeard.responseCount} responses`}
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Cost per completed session"
          value={formatUsd(metrics.costPerCompletedSession.costPerCompletedSessionUsd)}
          sub={`$${metrics.costPerCompletedSession.totalCostUsd.toFixed(2)} total spend`}
        />
        <KpiCard
          icon={<UserCheck size={16} />}
          label="Completed sessions"
          value={String(metrics.interviewCompletion.completedCount)}
          sub={`in the last ${sinceDays} days`}
        />
      </div>

      <FunnelSection funnelByTurn={metrics.funnelByTurn} funnelByField={metrics.funnelByField} />
      <FeltHeardDistribution distribution={metrics.feltHeard.distribution} responseCount={metrics.feltHeard.responseCount} />
      <ComingSoonSection />
    </>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [authError, setAuthError] = useState(false);
  const [sinceDays, setSinceDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (activeToken: string) => {
      setLoading(true);
      try {
        const data = await fetchDashboardMetrics(activeToken, sinceDays);
        setMetrics(data);
        setAuthError(false);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          clearStoredToken();
          setToken(null);
          setAuthError(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [sinceDays],
  );

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  function handleTokenSubmit(submitted: string): void {
    storeToken(submitted);
    setToken(submitted);
  }

  function handleUnauthorized(): void {
    clearStoredToken();
    setToken(null);
    setAuthError(true);
  }

  if (!token) return <TokenGate error={authError} onSubmit={handleTokenSubmit} />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Interview analytics</h1>
        <select
          className="window-select"
          value={sinceDays}
          onChange={(event) => setSinceDays(Number(event.target.value))}
        >
          {WINDOW_OPTIONS.map((days) => (
            <option key={days} value={days}>
              Last {days} days
            </option>
          ))}
        </select>
      </div>

      <DashboardBody loading={loading} metrics={metrics} sinceDays={sinceDays} />
      <ConversationsTable token={token} onUnauthorized={handleUnauthorized} />
      <UserHistoryPanel token={token} onUnauthorized={handleUnauthorized} />
    </div>
  );
}
