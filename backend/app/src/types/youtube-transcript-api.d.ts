declare module "youtube-transcript-api" {
  class TranscriptClient {
    ready: Promise<void>;

    constructor();

    getTranscript(videoId: string, options?: unknown): Promise<any>;

    bulkGetTranscript(videoIds: string[], options?: unknown): Promise<any[]>;
  }

  export default TranscriptClient;
}