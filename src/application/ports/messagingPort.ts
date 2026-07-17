/**
 * Порт для отправки сообщений пользователю, не зависящий от конкретного
 * транспорта (Telegram сегодня, потенциально другой канал позже).
 */
export interface QuickReply {
  /** Непрозрачный идентификатор варианта — транспорт решает, как кодировать его в свой callback-механизм. */
  readonly id: string;
  readonly label: string;
}

export interface SendTextOptions {
  /** 'HTML' — Telegram-разметка (<b>/<i>/...) для текста, который сам вызывающий код собрал и заэкранировал; без этого поля текст отправляется как есть (безопасно для произвольного/LLM-текста). */
  readonly parseMode?: 'HTML';
}

export interface MessagingPort {
  sendText(chatId: string, text: string, options?: SendTextOptions): Promise<void>;
  /** Текст + набор кнопок-вариантов ответа (👍/👎, оценка опыта и т.п.) — без ожидания текстового ввода. */
  sendTextWithOptions(chatId: string, text: string, options: QuickReply[]): Promise<void>;
}
