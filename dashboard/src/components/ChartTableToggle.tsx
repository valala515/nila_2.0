import { BarChart3, Table2 } from 'lucide-react';

export type ViewMode = 'chart' | 'table';

export interface ChartTableToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

// Дефолт — chart, table по запросу (см. ресёрч дашборд-UX в plan-файле этой фичи).
export function ChartTableToggle({ value, onChange }: ChartTableToggleProps) {
  return (
    <div className="segmented" role="group" aria-label="View as chart or table">
      <button type="button" aria-pressed={value === 'chart'} onClick={() => onChange('chart')}>
        <BarChart3 size={14} /> Chart
      </button>
      <button type="button" aria-pressed={value === 'table'} onClick={() => onChange('table')}>
        <Table2 size={14} /> Table
      </button>
    </div>
  );
}
