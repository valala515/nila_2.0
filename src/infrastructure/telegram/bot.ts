import { Bot } from 'grammy';
import type { MessagingPort } from '../../application/ports/messagingPort.js';
import type { VoiceDownloadPort } from '../../application/ports/voiceDownloadPort.js';

export function createTelegramBot(token: string): Bot {
  return new Bot(token);
}

export function createMessagingPort(bot: Bot): MessagingPort {
  return {
    async sendText(chatId: string, text: string): Promise<void> {
      await bot.api.sendMessage(chatId, text);
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
