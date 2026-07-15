import { useEffect, useState } from 'react';
import { fetchTranscript, UnauthorizedError } from '../api';
import type { TranscriptEntry } from '../types';
import { SkeletonRows } from './Skeleton';

export interface TranscriptDrawerProps {
  token: string;
  sessionId: number;
  onUnauthorized: () => void;
}

/**
 * SPEC: TranscriptDrawer
 * Назначение: показать полный обмен (вопросы бота + ответы пользователя) для
 *   одного разговора — лениво, только когда строка развёрнута, не заранее.
 * Разрешённые side effects: GET /api/conversations/:id/transcript
 */
export function TranscriptDrawer({ token, sessionId, onUnauthorized }: TranscriptDrawerProps) {
  const [entries, setEntries] = useState<TranscriptEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    fetchTranscript(token, sessionId)
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }
        setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, sessionId, onUnauthorized]);

  if (entries === null) return <SkeletonRows rows={3} />;
  if (entries.length === 0) return <p className="state-message">No messages recorded for this conversation.</p>;

  return (
    <div className="transcript">
      {entries.map((entry, index) => (
        <div className={`transcript-entry transcript-entry-${entry.role}`} key={index}>
          <span className="transcript-role">{entry.role === 'assistant' ? 'Nila' : 'User'}</span>
          <p className="transcript-text">{entry.text}</p>
        </div>
      ))}
    </div>
  );
}
