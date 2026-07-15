export interface SkeletonRowsProps {
  rows?: number;
}

/** Плейсхолдер на время загрузки тяжёлых секций (таблица разговоров) — не блокирует остальной дашборд. */
export function SkeletonRows({ rows = 5 }: SkeletonRowsProps) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index} />
      ))}
    </div>
  );
}
