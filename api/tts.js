const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function sendJson(res, status, payload) {
  res.statusCode = status;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const parseText = (text = "") => {
    const raw = String(text || "").trim();
    if (!raw) return {};
    try { return JSON.parse(raw); } catch {}
    return {};
  };
  if (Buffer.isBuffer(req.body)) return parseText(req.body.toString("utf8"));
  if (typeof req.body === "string") return parseText(req.body);
  if (typeof req.on !== "function") return {};
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", resolve);
    req.on("error", reject);
  });
  return parseText(Buffer.concat(chunks).toString("utf8"));
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function buildPayload(text, body = {}) {
  return {
    text,
    language: body.language || "ko-KR",
    voice: process.env.OPEN_SOURCE_TTS_VOICE || process.env.PIPER_TTS_VOICE || "ko_KR",
    speaker: process.env.OPEN_SOURCE_TTS_SPEAKER || process.env.PIPER_TTS_SPEAKER || "",
    rate: Number(body.rate || 0.86)
  };
}

function trimTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, fallback, min, max) {
  const parsed = numberOrDefault(value, fallback);
  return Math.max(min, Math.min(max, parsed));
}

async function readProviderAudio(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("audio/")) {
    return {
      contentType,
      buffer: Buffer.from(await response.arrayBuffer())
    };
  }
  if (contentType.includes("application/json")) {
    const data = await response.json();
    const audio = data.audioBase64 || data.audio || data.wavBase64 || data.mp3Base64;
    if (!audio) return null;
    return {
      contentType: data.mimeType || data.contentType || "audio/wav",
      buffer: Buffer.from(String(audio).replace(/^data:audio\/\w+;base64,/, ""), "base64")
    };
  }
  return null;
}

async function fetchElevenLabsTts(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY || "";
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "";
  if (!apiKey || !voiceId) return null;

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: clampNumber(process.env.ELEVENLABS_STABILITY, 0.45, 0, 1),
          similarity_boost: clampNumber(process.env.ELEVENLABS_SIMILARITY_BOOST, 0.8, 0, 1),
          style: clampNumber(process.env.ELEVENLABS_STYLE, 0, 0, 1),
          use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST !== "false"
        }
      })
    }
  );

  if (!response.ok) return null;
  return await readProviderAudio(response);
}

async function fetchOpenAiCompatibleTts(text, body = {}) {
  const model = process.env.OPENAI_TTS_MODEL || process.env.TTS_MODEL || "";
  const apiKey = process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!model || !apiKey) return null;

  const baseUrl = trimTrailingSlash(
    process.env.OPENAI_TTS_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  );
  const voice = process.env.OPENAI_TTS_VOICE || process.env.TTS_VOICE || "alloy";
  const speed = Math.max(0.25, Math.min(4, numberOrDefault(body.rate, 0.9)));

  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: process.env.OPENAI_TTS_FORMAT || "mp3",
      speed
    })
  });

  if (!response.ok) return null;
  return await readProviderAudio(response);
}

async function fetchExternalTts(text, body = {}) {
  const endpoint = process.env.OPEN_SOURCE_TTS_ENDPOINT || process.env.PIPER_TTS_ENDPOINT || process.env.TTS_ENDPOINT;
  if (!endpoint) return null;

  const headers = { "Content-Type": "application/json" };
  const apiKey = process.env.OPEN_SOURCE_TTS_API_KEY || process.env.PIPER_TTS_API_KEY || "";
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildPayload(text, body))
  });

  if (!response.ok) return null;
  return await readProviderAudio(response);
}

module.exports = async function tts(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const body = await parseBody(req);
    const text = cleanText(body.text);
    if (!text) return sendJson(res, 400, { error: "Missing text" });

    const audio = await fetchElevenLabsTts(text) || await fetchOpenAiCompatibleTts(text, body) || await fetchExternalTts(text, body);
    if (!audio?.buffer?.length) {
      return sendJson(res, 501, {
        error: "TTS provider is not configured",
        detail: "Set ELEVENLABS_API_KEY with ELEVENLABS_VOICE_ID, OPENAI_TTS_MODEL with OPENAI_API_KEY, or set OPEN_SOURCE_TTS_ENDPOINT."
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", audio.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.end(audio.buffer);
  } catch (error) {
    return sendJson(res, 500, { error: "TTS request failed", detail: error.message });
  }
};
