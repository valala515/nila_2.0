import OpenAI, { toFile } from 'openai';
import type { SpeechToTextPort } from '../../application/ports/speechToTextPort.js';

export function createSpeechToText(client: OpenAI): SpeechToTextPort {
  return {
    async transcribe(audio: Buffer, mimeType: string): Promise<string> {
      const file = await toFile(audio, 'voice-message.ogg', { type: mimeType });
      const transcription = await client.audio.transcriptions.create({
        file,
        model: 'gpt-4o-transcribe',
      });
      return transcription.text;
    },
  };
}
