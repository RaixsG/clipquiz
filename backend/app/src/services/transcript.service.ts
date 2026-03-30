import TranscriptClient from "youtube-transcript-api";
import { YoutubeTranscript } from "youtube-transcript";
import { Innertube } from "youtubei.js";
import OpenAI from "openai";
import { createWriteStream, createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import {
  buildCaptionTrackUrl,
  captionTextIsUsable,
  fetchYoutubePlayerResponse,
  getCaptionTracks,
  getYoutubeMetaFromPlayerResponse,
  parseCaptionXml,
  parseCaptionJson3,
} from "../utils/youtube";

export interface TranscriptResult {
  title: string;
  durationSeconds: number;
  transcript: string;
}

const TRANSCRIPT_STEP_TIMEOUT_MS = 15000;

const transcriptClient = new TranscriptClient();
const transcriptClientReady = transcriptClient.ready;
const innerTubeClientPromise = Innertube.create({
  generate_session_locally: true,
});
const groqSttClient = env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

const logTranscript = (...args: unknown[]) => {
  console.log("[ClipQuiz][Transcript]", ...args);
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const normalizeTranscriptApiText = (transcript: any): string => {
  const tracks = Array.isArray(transcript?.tracks) ? transcript.tracks : [];
  const preferredTrack =
    tracks.find(
      (track: any) =>
        Array.isArray(track?.transcript) &&
        track.transcript.some((segment: any) => segment?.text?.trim()),
    ) ?? tracks[0];

  const segments = Array.isArray(preferredTrack?.transcript)
    ? preferredTrack.transcript
    : [];

  return segments
    .map((segment: any) => String(segment?.text ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const tryTranscriptApi = async (videoId: string): Promise<string> => {
  logTranscript("Trying youtube-transcript package", { videoId });

  const languages = ["en", "es", "auto"];

  for (const lang of languages) {
    try {
      logTranscript(`Trying language: ${lang}`, { videoId });
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang,
      });

      if (!transcript || transcript.length === 0) {
        logTranscript(`Empty transcript for lang: ${lang}`, { videoId });
        continue;
      }

      const normalized = transcript
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (normalized.length < 20) {
        logTranscript(`Transcript too short for lang: ${lang}`, {
          videoId,
          length: normalized.length,
        });
        continue;
      }

      logTranscript("youtube-transcript success", {
        videoId,
        lang,
        segments: transcript.length,
        textLength: normalized.length,
      });
      return normalized;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      logTranscript(`youtube-transcript failed for lang ${lang}`, {
        videoId,
        message,
      });
    }
  }

  logTranscript("youtube-transcript exhausted all languages", { videoId });
  return "";
};

const tryTranscriptApiLegacy = async (videoId: string): Promise<string> => {
  logTranscript("Trying transcript API (legacy)", { videoId });

  try {
    await transcriptClientReady;
    const transcript = await transcriptClient.getTranscript(videoId);
    const tracks = Array.isArray(transcript?.tracks)
      ? transcript.tracks.length
      : 0;
    const normalized = normalizeTranscriptApiText(transcript);
    logTranscript("Transcript API success", {
      videoId,
      tracks,
      textLength: normalized.length,
    });
    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logTranscript("Transcript API failed", { videoId, message });
    return "";
  }
};

const normalizeYoutubeJsText = (transcriptInfo: any): string => {
  const segments =
    transcriptInfo?.transcript?.content?.body?.initial_segments ??
    transcriptInfo?.transcript?.content?.body?.segments ??
    [];

  if (!Array.isArray(segments)) {
    return "";
  }

  return segments
    .map((segment: any) => {
      const snippetText = segment?.snippet?.text;
      const directText = segment?.text;

      if (typeof snippetText === "string") return snippetText;
      if (snippetText && typeof snippetText.toString === "function") {
        return snippetText.toString();
      }

      if (typeof directText === "string") return directText;
      if (directText && typeof directText.toString === "function") {
        return directText.toString();
      }

      return "";
    })
    .map((text: string) => text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const tryYoutubeJsTranscript = async (videoId: string): Promise<string> => {
  logTranscript("Trying youtubei.js transcript", { videoId });

  try {
    const yt = await innerTubeClientPromise;
    const info = await yt.getInfo(videoId);
    const transcriptInfo = await info.getTranscript();
    const normalized = normalizeYoutubeJsText(transcriptInfo);

    logTranscript("youtubei.js transcript success", {
      videoId,
      textLength: normalized.length,
    });

    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logTranscript("youtubei.js transcript failed", { videoId, message });
    return "";
  }
};

const tryCaptionFallback = async (playerResponse: any): Promise<string> => {
  const captionTracks = getCaptionTracks(playerResponse);
  if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
    logTranscript("No caption tracks available for fallback");
    return "";
  }

  logTranscript("Trying caption fallback", { tracks: captionTracks.length });

  const candidateTracks = [...captionTracks].sort((left, right) => {
    const score = (track: any) => {
      if (track?.languageCode?.startsWith("es")) return 0;
      if (track?.languageCode?.startsWith("en")) return 1;
      if (track?.kind === "asr") return 2;
      return 3;
    };

    return score(left) - score(right);
  });

  for (const track of candidateTracks) {
    if (!track?.baseUrl) continue;

    logTranscript("Trying caption track", {
      languageCode: track.languageCode ?? "unknown",
      kind: track.kind ?? "unknown",
    });

    const xmlUrl = buildCaptionTrackUrl(track.baseUrl, "xml");
    const json3Url = buildCaptionTrackUrl(track.baseUrl, "json3");

    const xmlResponse = await fetch(xmlUrl);
    logTranscript("XML caption response", {
      ok: xmlResponse.ok,
      status: xmlResponse.status,
    });
    if (xmlResponse.ok) {
      const xml = await xmlResponse.text();
      const transcript = parseCaptionXml(xml);
      logTranscript("XML caption parsed", { textLength: transcript.length });
      if (captionTextIsUsable(transcript)) {
        logTranscript("Caption fallback winner", { source: "xml" });
        return transcript;
      }
    }

    const json3Response = await fetch(json3Url);
    logTranscript("JSON3 caption response", {
      ok: json3Response.ok,
      status: json3Response.status,
    });
    if (json3Response.ok) {
      const json3 = await json3Response.text();
      const transcript = parseCaptionJson3(json3);
      logTranscript("JSON3 caption parsed", { textLength: transcript.length });
      if (captionTextIsUsable(transcript)) {
        logTranscript("Caption fallback winner", { source: "json3" });
        return transcript;
      }
    }
  }

  logTranscript("Caption fallback exhausted without usable text");

  return "";
};

const downloadAudioToTempFile = async (videoId: string): Promise<string> => {
  const outputPath = join(
    tmpdir(),
    `clipquiz-${videoId}-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`,
  );

  const yt = await innerTubeClientPromise;
  const info: any = await yt.getInfo(videoId);
  const audioStream: any = await info.download({
    type: "audio",
    quality: "best",
  });

  if (!audioStream) {
    throw new AppError(
      "AUDIO_DOWNLOAD_FAILED",
      "No pudimos descargar el audio del video para transcribir.",
      422,
    );
  }

  if (typeof audioStream.pipe === "function") {
    await pipeline(audioStream, createWriteStream(outputPath));
  } else {
    const nodeReadable = Readable.fromWeb(audioStream as any);
    await pipeline(nodeReadable, createWriteStream(outputPath));
  }

  return outputPath;
};

const tryGroqAudioTranscription = async (videoId: string): Promise<string> => {
  if (!groqSttClient) {
    logTranscript("Groq STT skipped: GROQ_API_KEY not configured", { videoId });
    return "";
  }

  logTranscript("Trying Groq audio transcription fallback", {
    videoId,
    model: env.GROQ_STT_MODEL,
  });

  let audioPath = "";

  try {
    audioPath = await downloadAudioToTempFile(videoId);
    logTranscript("Audio download complete", { videoId, audioPath });

    const response = await groqSttClient.audio.transcriptions.create({
      model: env.GROQ_STT_MODEL,
      file: createReadStream(audioPath),
      response_format: "text",
    });

    const transcript = String(response ?? "")
      .replace(/\s+/g, " ")
      .trim();

    logTranscript("Groq audio transcription success", {
      videoId,
      textLength: transcript.length,
    });

    return transcript;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logTranscript("Groq audio transcription failed", { videoId, message });
    return "";
  } finally {
    if (audioPath) {
      await rm(audioPath, { force: true }).catch(() => undefined);
    }
  }
};

export const getVideoTranscript = async (
  videoId: string,
): Promise<TranscriptResult> => {
  logTranscript("Starting transcript extraction", { videoId });
  const playerResponse = await fetchYoutubePlayerResponse(videoId);
  const metadata = getYoutubeMetaFromPlayerResponse(playerResponse);

  let transcript = await withTimeout(
    tryTranscriptApi(videoId),
    TRANSCRIPT_STEP_TIMEOUT_MS,
    "youtube-transcript",
  ).catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    logTranscript("youtube-transcript timed out", { videoId, message });
    return "";
  });
  let source:
    | "youtube-transcript"
    | "transcript-api"
    | "youtubei"
    | "fallback"
    | "none" = "youtube-transcript";

  if (!captionTextIsUsable(transcript)) {
    logTranscript(
      "youtube-transcript result not usable, switching to transcript API legacy",
      {
        textLength: transcript.length,
      },
    );
    transcript = await withTimeout(
      tryTranscriptApiLegacy(videoId),
      TRANSCRIPT_STEP_TIMEOUT_MS,
      "transcript-api-legacy",
    ).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      logTranscript("transcript API legacy timed out", { videoId, message });
      return "";
    });
    source = "transcript-api";
  }

  if (!captionTextIsUsable(transcript)) {
    logTranscript(
      "Transcript API legacy result not usable, switching to youtubei.js",
      {
        textLength: transcript.length,
      },
    );
    transcript = await withTimeout(
      tryYoutubeJsTranscript(videoId),
      TRANSCRIPT_STEP_TIMEOUT_MS,
      "youtubei-transcript",
    ).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      logTranscript("youtubei transcript timed out", { videoId, message });
      return "";
    });
    source = "youtubei";
  }

  if (!captionTextIsUsable(transcript)) {
    logTranscript(
      "youtubei.js result not usable, switching to caption fallback",
      {
        textLength: transcript.length,
      },
    );
    transcript = await withTimeout(
      tryCaptionFallback(playerResponse),
      TRANSCRIPT_STEP_TIMEOUT_MS,
      "caption-fallback",
    ).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      logTranscript("caption fallback timed out", { videoId, message });
      return "";
    });
    source = "fallback";
  }

  if (!captionTextIsUsable(transcript)) {
    logTranscript(
      "Caption fallback not usable, switching to audio transcription fallback",
      {
        textLength: transcript.length,
      },
    );
    transcript = await withTimeout(
      tryGroqAudioTranscription(videoId),
      60000,
      "audio-transcription-fallback",
    ).catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      logTranscript("audio transcription fallback timed out", { videoId, message });
      return "";
    });
    source = "fallback";
  }

  if (!captionTextIsUsable(transcript)) {
    source = "none";
    logTranscript("Transcript extraction failed", {
      videoId,
      source,
      textLength: transcript.length,
    });
    throw new AppError(
      "NO_USABLE_TRANSCRIPT",
      "No pudimos extraer una transcripcion util de este video.",
      422,
    );
  }

  logTranscript("Transcript extraction success", {
    videoId,
    source,
    textLength: transcript.length,
    title: metadata.title,
  });

  return {
    title: metadata.title,
    durationSeconds: metadata.durationSeconds,
    transcript,
  };
};
