import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { resetUserSession, deleteUserHistory, UnauthorizedError } from '../api';

export interface UserHistoryPanelProps {
  token: string;
  onUnauthorized: () => void;
}

type Status = { kind: 'idle' } | { kind: 'success'; message: string } | { kind: 'error'; message: string };

/**
 * SPEC: UserHistoryPanel
 * Назначение: тестовый инструмент — сбросить сессию пользователя (Telegram
 *   выглядит как новый чат, история остаётся в SQL) либо полностью удалить
 *   историю пользователя из SQL.
 * Входы/Выход: token + onUnauthorized (401 от API) → секция дашборда
 * Разрешённые side effects: POST /api/users/reset, POST /api/users/delete
 *   (оба через window.confirm перед вызовом — необратимость delete особенно).
 */
export function UserHistoryPanel({ token, onUnauthorized }: UserHistoryPanelProps) {
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function runAction(
    action: (token: string, userId: string) => Promise<void>,
    confirmText: string,
    successMessage: string,
  ): Promise<void> {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      setStatus({ kind: 'error', message: 'Enter a Telegram user id first.' });
      return;
    }
    if (!window.confirm(confirmText)) return;

    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      await action(token, trimmedUserId);
      setStatus({ kind: 'success', message: successMessage });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setStatus({ kind: 'error', message: 'Request failed — check the server log.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">
          <RotateCcw size={16} /> Manage user history
        </h2>
      </div>
      <p className="user-history-description">
        For testing: reset a user&apos;s session so the next Telegram message starts a fresh interview, or wipe all of
        their data from SQL.
      </p>
      <div className="user-history-controls">
        <input
          className="user-history-input"
          type="text"
          placeholder="Telegram user id"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        />
        <button
          type="button"
          className="user-history-button"
          disabled={busy}
          onClick={() =>
            void runAction(
              resetUserSession,
              "Reset this session? History stays in SQL, but the next Telegram message starts a fresh interview.",
              'Session reset — next message starts a new interview.',
            )
          }
        >
          <RotateCcw size={14} /> Reset session
        </button>
        <button
          type="button"
          className="user-history-button user-history-button-destructive"
          disabled={busy}
          onClick={() =>
            void runAction(
              deleteUserHistory,
              'Permanently delete ALL history for this user from SQL? This cannot be undone.',
              'All history deleted for this user.',
            )
          }
        >
          <Trash2 size={14} /> Delete all history
        </button>
      </div>
      {status.kind !== 'idle' && (
        <p className={status.kind === 'error' ? 'user-history-status-error' : 'user-history-status-success'}>
          {status.message}
        </p>
      )}
    </section>
  );
}
