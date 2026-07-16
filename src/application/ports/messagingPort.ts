/**
 * Порт для отправки сообщений пользователю, не зависящий от конкретного
 * транспорта (Telegram сегодня, потенциально другой канал позже).
 */
export interface QuickReply {
  /** Непрозрачный идентификатор варианта — транспорт решает, как кодировать его в свой callback-механизм. */
  readonly id: string;
  readonly label: string;
}

export interface MessagingPort {
  sendText(chatId: string, text: string): Promise<void>;
  /** Текст + набор кнопок-вариантов ответа (👍/👎, оценка опыта и т.п.) — без ожидания текстового ввода. */
  sendTextWithOptions(chatId: string, text: string, options: QuickReply[]): Promise<void>;
}
