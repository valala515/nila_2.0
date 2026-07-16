// 'experience' — кнопки 👍/👎 оценки всего разговора (вход в synthesis);
// 'none' — обычный вопрос интервью, checkpoint-отражение, уточнение при
// contradiction — под ними кнопок нет (решение пользователя 16 июля, живой
// тест в Telegram показал, что 👍/👎 под каждым вопросом — избыточно).
export type QuickRepliesKind = 'experience' | 'none';

// Общая форма результата advanceInterview — текст ответа и какие квикреплаи
// под ним показать.
export interface InterviewReplyOutcome {
  readonly replyText: string;
  readonly quickReplies: QuickRepliesKind;
}
