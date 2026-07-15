export interface SpeechToTextContext {
  readonly userId: string;
  readonly audioDurationSec: number;
}

export interface SpeechToTextPort {
  transcribe(audio: Buffer, mimeType: string, context: SpeechToTextContext): Promise<string>;
}
