/**
 * Порт для отправки сообщений пользователю, не зависящий от конкретного
 * транспорта (Telegram сегодня, потенциально другой канал позже).
 */
export interface MessagingPort {
  sendText(chatId: string, text: string): Promise<void>;
}
