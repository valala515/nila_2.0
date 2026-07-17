import { Bot, InlineKeyboard } from 'grammy';
import type { MessagingPort, QuickReply, SendTextOptions } from '../../application/ports/messagingPort.js';
import type { VoiceDownloadPort } from '../../application/ports/voiceDownloadPort.js';

export function createTelegramBot(token: string): Bot {
  return new Bot(token);
}

function buildInlineKeyboard(options: QuickReply[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const option of options) keyboard.text(option.label, option.id);
  return keyboard;
}

export function createMessagingPort(bot: Bot): MessagingPort {
  return {
    async sendText(chatId: string, text: string, options?: SendTextOptions): Promise<void> {
      await bot.api.sendMessage(chatId, text, options?.parseMode ? { parse_mode: options.parseMode } : undefined);
    },
    async sendTextWithOptions(chatId: string, text: string, options: QuickReply[]): Promise<void> {
      await bot.api.sendMessage(chatId, text, { reply_markup: buildInlineKeyboard(options) });
    },
  };
}

export function createVoiceDownloadPort(bot: Bot): VoiceDownloadPort {
  return {
    async download(fileId: string) {
      const file = await bot.api.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return { buffer: Buffer.from(arrayBuffer), mimeType: 'audio/ogg' };
    },
  };
}
