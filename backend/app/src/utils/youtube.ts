import { AppError } from "./errors";

export interface ParsedYoutubeUrl {
  videoId: string;
}

export interface YoutubeVideoMeta {
  title: string;
  durationSeconds: number;
}

export interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
}

const WATCH_PAGE_URL = "https://www.youtube.com/watch";

const decodeHtml = (text: string): string =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const extractJsonObject = (source: string, marker: string): string => {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new AppError(
      "YOUTUBE_PARSE_ERROR",
      "No se pudo leer la metadata del video de YouTube.",
      422
    );
  }

  const start = source.indexOf("{", markerIndex);
  if (start < 0) {
    throw new AppError(
      "YOUTUBE_PARSE_ERROR",
      "No se pudo leer la metadata del video de YouTube.",
      422
    );
  }

  let inString = false;
  let escape = false;
  let depth = 0;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new AppError(
    "YOUTUBE_PARSE_ERROR",
    "No se pudo interpretar la metadata del video.",
    422
  );
};

export const parseYoutubeUrl = (urlInput: string): ParsedYoutubeUrl => {
  let url: URL;
  try {
    url = new URL(urlInput.trim());
  } catch {
    throw new AppError(
      "INVALID_YOUTUBE_URL",
      "Ingresa una URL valida de YouTube.",
      400
    );
  }

  let videoId = "";

  if (url.hostname === "youtu.be") {
    videoId = url.pathname.replace("/", "").trim();
  } else if (
    url.hostname.includes("youtube.com") ||
    url.hostname.includes("youtube-nocookie.com")
  ) {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") ?? "";
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] ?? "";
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2] ?? "";
    }
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new AppError(
      "INVALID_YOUTUBE_URL",
      "No encontramos un video valido en ese enlace.",
      400
    );
  }

  return { videoId };
};

export const fetchYoutubePlayerResponse = async (videoId: string): Promise<any> => {
  const watchUrl = new URL(WATCH_PAGE_URL);
  watchUrl.searchParams.set("v", videoId);
  watchUrl.searchParams.set("hl", "es");

  const response = await fetch(watchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new AppError(
      "YOUTUBE_FETCH_ERROR",
      "No pudimos cargar el video desde YouTube.",
      502
    );
  }

  const html = await response.text();
  const jsonText = extractJsonObject(html, "ytInitialPlayerResponse");

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new AppError(
      "YOUTUBE_PARSE_ERROR",
      "No pudimos interpretar la respuesta del video.",
      422
    );
  }
};

export const getYoutubeMetaFromPlayerResponse = (
  playerResponse: any
): YoutubeVideoMeta => {
  const details = playerResponse?.videoDetails;
  const title = decodeHtml(details?.title ?? "Video de YouTube");
  const durationSeconds = Number(details?.lengthSeconds ?? 0);

  if (!durationSeconds || !Number.isFinite(durationSeconds)) {
    throw new AppError(
      "YOUTUBE_DURATION_ERROR",
      "No pudimos validar la duracion del video.",
      422
    );
  }

  return {
    title,
    durationSeconds,
  };
};

export const getCaptionTrackBaseUrl = (playerResponse: any): string => {
  const tracks = getCaptionTracks(playerResponse);

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new AppError(
      "NO_SUBTITLES",
      "Este video no tiene subtitulos disponibles para generar el quiz.",
      422
    );
  }

  const preferred =
    tracks.find((track: CaptionTrack) => track?.languageCode?.startsWith("es")) ??
    tracks.find((track: CaptionTrack) => track?.languageCode?.startsWith("en")) ??
    tracks.find((track: CaptionTrack) => track?.kind === "asr") ??
    tracks[0];

  const baseUrl = preferred?.baseUrl;
  if (!baseUrl) {
    throw new AppError(
      "NO_SUBTITLES",
      "No pudimos leer los subtitulos del video.",
      422
    );
  }

  return baseUrl;
};

export const getCaptionTracks = (playerResponse: any): CaptionTrack[] =>
  playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

export const buildCaptionTrackUrl = (
  baseUrl: string,
  format: "xml" | "json3" = "xml"
): string => {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", format);
  return url.toString();
};

export const parseCaptionXml = (xml: string): string => {
  const lines: string[] = [];
  const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;

  let match = regex.exec(xml);
  while (match) {
    const raw = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (raw.length > 0) {
      lines.push(decodeHtml(raw));
    }
    match = regex.exec(xml);
  }

  const transcript = lines.join(" ").replace(/\s+/g, " ").trim();

  return transcript;
};

export const parseCaptionJson3 = (json: string): string => {
  let payload: any;

  try {
    payload = JSON.parse(json);
  } catch {
    return "";
  }

  const events = Array.isArray(payload?.events) ? payload.events : [];
  const lines: string[] = [];

  for (const event of events) {
    const segments = Array.isArray(event?.segs) ? event.segs : [];
    const text = segments
      .map((segment: any) => String(segment?.utf8 ?? ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      lines.push(decodeHtml(text));
    }
  }

  return lines.join(" ").replace(/\s+/g, " ").trim();
};

export const captionTextIsUsable = (transcript: string): boolean =>
  transcript.replace(/\s+/g, " ").trim().length >= 20;
