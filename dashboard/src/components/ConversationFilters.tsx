import { Download } from 'lucide-react';
import type { ConversationsFilter, InterviewPhase } from '../types';

export interface ConversationFiltersProps {
  value: ConversationsFilter;
  onChange: (filter: ConversationsFilter) => void;
  onExport: () => void;
  exportDisabled: boolean;
}

const PHASES: InterviewPhase[] = ['intro', 'impact', 'history', 'support', 'readiness', 'synthesis'];

function withUserId(value: ConversationsFilter, userId: string): ConversationsFilter {
  const next = { ...value };
  delete next.userId;
  return userId ? { ...next, userId } : next;
}

function withReachedPhase(value: ConversationsFilter, raw: string): ConversationsFilter {
  const next = { ...value };
  delete next.reachedPhase;
  return raw ? { ...next, reachedPhase: raw as InterviewPhase } : next;
}

function withCompleted(value: ConversationsFilter, raw: string): ConversationsFilter {
  const next = { ...value };
  delete next.completed;
  if (raw === 'true') return { ...next, completed: true };
  if (raw === 'false') return { ...next, completed: false };
  return next;
}

export function ConversationFilters({ value, onChange, onExport, exportDisabled }: ConversationFiltersProps) {
  return (
    <div className="conversation-filters">
      <input
        className="user-history-input"
        type="text"
        placeholder="Filter by Telegram user id"
        value={value.userId ?? ''}
        onChange={(event) => onChange(withUserId(value, event.target.value))}
      />
      <select
        className="window-select"
        value={value.reachedPhase ?? ''}
        onChange={(event) => onChange(withReachedPhase(value, event.target.value))}
      >
        <option value="">Any phase reached</option>
        {PHASES.map((phase) => (
          <option key={phase} value={phase}>
            {phase}
          </option>
        ))}
      </select>
      <select
        className="window-select"
        value={value.completed === undefined ? '' : String(value.completed)}
        onChange={(event) => onChange(withCompleted(value, event.target.value))}
      >
        <option value="">Completed or dropped</option>
        <option value="true">Completed only</option>
        <option value="false">Dropped only</option>
      </select>
      <button type="button" className="user-history-button" onClick={onExport} disabled={exportDisabled}>
        <Download size={14} /> Export
      </button>
    </div>
  );
}
