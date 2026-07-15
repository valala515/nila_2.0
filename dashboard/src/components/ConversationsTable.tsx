import { Fragment, useCallback, useEffect, useState } from 'react';
import { ListTree } from 'lucide-react';
import { fetchConversations, fetchConversationsExport, UnauthorizedError } from '../api';
import type { ConversationsFilter, ConversationSummary } from '../types';
import { ConversationFilters } from './ConversationFilters';
import { TranscriptDrawer } from './TranscriptDrawer';
import { SkeletonRows } from './Skeleton';

export interface ConversationsTableProps {
  token: string;
  onUnauthorized: () => void;
}

const PAGE_SIZE = 25;

function formatStatus(conversation: ConversationSummary): string {
  return conversation.completed ? 'Completed' : `Dropped at ${conversation.reachedPhase}`;
}

function triggerJsonDownload(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * SPEC: ConversationsTable
 * Назначение: таблица последних разговоров — свой (независимый от основных
 *   KPI) запрос и loading-состояние, чтобы тяжёлый путь не задерживал
 *   быстрый; keyset-пагинация (Back/Next по курсору, не по номеру страницы);
 *   фильтр + экспорт делегированы ConversationFilters; транскрипт по клику
 *   на строку — TranscriptDrawer.
 * Разрешённые side effects: GET /api/conversations, GET /api/conversations/export
 */
export function ConversationsTable({ token, onUnauthorized }: ConversationsTableProps) {
  const [filter, setFilter] = useState<ConversationsFilter>({});
  const [cursorHistory, setCursorHistory] = useState<Array<number | null>>([null]);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const cursor = cursorHistory[cursorHistory.length - 1] ?? null;

  const load = useCallback(async () => {
    setConversations(null);
    try {
      const page = await fetchConversations(token, filter, cursor, PAGE_SIZE);
      setConversations(page.conversations);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setConversations([]);
    }
  }, [token, filter, cursor, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleFilterChange(next: ConversationsFilter): void {
    setFilter(next);
    setCursorHistory([null]);
    setExpandedId(null);
  }

  function handleNext(): void {
    if (nextCursor === null) return;
    setCursorHistory((history) => [...history, nextCursor]);
    setExpandedId(null);
  }

  function handleBack(): void {
    setCursorHistory((history) => (history.length > 1 ? history.slice(0, -1) : history));
    setExpandedId(null);
  }

  async function handleExport(): Promise<void> {
    setExporting(true);
    try {
      const result = await fetchConversationsExport(token, filter);
      triggerJsonDownload(`nila-conversations-${result.conversations.length}.json`, result);
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized();
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">
          <ListTree size={16} /> Conversations
        </h2>
      </div>
      <ConversationFilters value={filter} onChange={handleFilterChange} onExport={() => void handleExport()} exportDisabled={exporting} />
      {conversations === null && <SkeletonRows rows={6} />}
      {conversations !== null && conversations.length === 0 && (
        <p className="state-message">No conversations match this filter yet.</p>
      )}
      {conversations !== null && conversations.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>User id</th>
              <th className="numeric">Turns</th>
              <th className="numeric">Avg answer (chars)</th>
              <th>Reached phase</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conversation) => (
              <Fragment key={conversation.sessionId}>
                <tr
                  className="conversation-row"
                  onClick={() => setExpandedId(expandedId === conversation.sessionId ? null : conversation.sessionId)}
                >
                  <td>{new Date(conversation.startedAtIso).toLocaleString()}</td>
                  <td>{conversation.userId}</td>
                  <td className="numeric">{conversation.turnCount}</td>
                  <td className="numeric">{conversation.avgAnswerChars}</td>
                  <td>{conversation.reachedPhase}</td>
                  <td>{formatStatus(conversation)}</td>
                </tr>
                {expandedId === conversation.sessionId && (
                  <tr>
                    <td colSpan={6}>
                      <TranscriptDrawer token={token} sessionId={conversation.sessionId} onUnauthorized={onUnauthorized} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      <div className="conversation-pagination">
        <button type="button" className="user-history-button" disabled={cursorHistory.length <= 1} onClick={handleBack}>
          Back
        </button>
        <button type="button" className="user-history-button" disabled={nextCursor === null} onClick={handleNext}>
          Next
        </button>
      </div>
    </section>
  );
}
