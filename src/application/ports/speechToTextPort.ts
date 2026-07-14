export interface SpeechToTextPort {
  transcribe(audio: Buffer, mimeType: string): Promise<string>;
}
