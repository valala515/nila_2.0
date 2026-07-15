import { Lock } from 'lucide-react';

interface ComingSoonMetric {
  title: string;
  unlocksIn: string;
}

// Tier 2 (см. план фичи) — метрики, для которых фича-источник ещё не построена.
const COMING_SOON_METRICS: ComingSoonMetric[] = [
  { title: 'Profile feels like me', unlocksIn: 'Sprint 2–3 (Profile Synthesizer)' },
  { title: 'Future You feels like me', unlocksIn: 'Sprint 3 (avatar reveal)' },
  { title: '48h reply rate', unlocksIn: 'Sprint 4 (48h loop)' },
];

export function ComingSoonSection() {
  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">
          <Lock size={16} /> Coming soon
        </h2>
      </div>
      <div className="coming-soon-row">
        {COMING_SOON_METRICS.map((metric) => (
          <div className="coming-soon-card" key={metric.title}>
            <div className="coming-soon-card-title">
              <Lock size={14} />
              {metric.title}
            </div>
            <div className="coming-soon-card-note">Unlocks in {metric.unlocksIn}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
