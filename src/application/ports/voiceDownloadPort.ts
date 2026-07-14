export interface DownloadedAudio {
  readonly buffer: Buffer;
  readonly mimeType: string;
}

export interface VoiceDownloadPort {
  download(fileId: string): Promise<DownloadedAudio>;
}
