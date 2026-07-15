export interface AnalyticsEventPort {
  // properties — только категориальные/числовые поля, без raw text пользователя (CLAUDE.md §5).
  record(name: string, userId: string, properties: Record<string, unknown>): Promise<void>;
}
