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

async function readProviderAudio(response, provider) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("audio/")) {
    return {
      provider,
      contentType,
      buffer: Buffer.from(await response.arrayBuffer())
    };
  }
  if (contentType.includes("application/json")) {
    const data = await response.json();
    const audio = data.audioBase64 || data.audio || data.wavBase64 || data.mp3Base64;
    if (!audio) return null;
    return {
      provider,
      contentType: data.mimeType || data.contentType || "audio/wav",
      buffer: Buffer.from(String(audio).replace(/^data:audio\/\w+;base64,/, ""), "base64")
    };
  }
  return null;
}

function decodeAudioString(value = "") {
  const raw = String(value || "").replace(/^data:audio\/\w+;base64,/, "").trim();
  if (!raw) return Buffer.alloc(0);
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) return Buffer.from(raw, "hex");
  return Buffer.from(raw, "base64");
}

function audioContentType(format = "mp3") {
  const normalized = String(format || "mp3").toLowerCase();
  if (normalized === "wav") return "audio/wav";
  if (normalized === "pcm") return "audio/L16";
  return "audio/mpeg";
}

function readMiniMaxAudioPayload(data, format) {
  const audio = data?.data?.audio || data?.audio || data?.audioBase64 || data?.mp3Base64 || data?.wavBase64;
  if (!audio) return null;
  return {
    provider: "minimax",
    contentType: data?.mimeType || data?.contentType || audioContentType(format),
    buffer: decodeAudioString(audio)
  };
}

function cleanElevenLabsVoiceValue(value = "") {
  return String(value || "").replace(/\*/g, "").replace(/^["']|["']$/g, "").trim();
}

function looksLikeVoiceId(value = "") {
  return /^[A-Za-z0-9_-]{10,}$/.test(value);
}

function voiceNameCandidates(value = "") {
  const clean = cleanElevenLabsVoiceValue(value);
  const shortName = clean.split(/\s+-\s+/)[0]?.trim() || "";
  return [...new Set([clean, shortName].filter(Boolean).map(item => item.toLowerCase()))];
}

async function resolveElevenLabsVoiceId(apiKey, configuredVoice) {
  const voice = cleanElevenLabsVoiceValue(configuredVoice);
  if (!voice) return { voiceId: "", failure: "missing_voice" };
  if (looksLikeVoiceId(voice)) return { voiceId: voice, failure: "" };

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    method: "GET",
    headers: { "xi-api-key": apiKey }
  });
  if (!response.ok) return { voiceId: "", failure: `voice_list_${response.status}` };

  const data = await response.json();
  const voices = Array.isArray(data.voices) ? data.voices : [];
  const targets = voiceNameCandidates(voice);
  const matched = voices.find(item => targets.includes(String(item.name || "").toLowerCase()))
    || voices.find(item => targets.some(target => String(item.name || "").toLowerCase().includes(target)))
    || voices.find(item => targets.some(target => target.includes(String(item.name || "").toLowerCase())));

  return { voiceId: matched?.voice_id || "", failure: matched ? "" : "voice_not_found" };
}

function defaultMiniMaxVoiceId() {
  return String(process.env.MINIMAX_TTS_VOICE_ID || process.env.MINIMAX_VOICE_ID || process.env.MINIMAX_DEFAULT_VOICE_ID || "male-qn-qingse").trim();
}

function buildDiagnostics() {
  const configuredMiniMaxVoice = String(process.env.MINIMAX_TTS_VOICE_ID || process.env.MINIMAX_VOICE_ID || "").trim();
  const defaultMiniMaxVoice = defaultMiniMaxVoiceId();
  return {
    preferredProvider: String(process.env.TTS_PROVIDER || "").trim(),
    minimax: {
      hasApiKey: Boolean(String(process.env.MINIMAX_API_KEY || "").trim()),
      hasGroupId: Boolean(String(process.env.MINIMAX_GROUP_ID || "").trim()),
      hasVoice: Boolean(configuredMiniMaxVoice),
      usesDefaultVoice: !configuredMiniMaxVoice && Boolean(defaultMiniMaxVoice),
      model: process.env.MINIMAX_TTS_MODEL || process.env.MINIMAX_MODEL_ID || "speech-02-hd",
      failure: ""
    },
    elevenLabs: {
      hasApiKey: Boolean(String(process.env.ELEVENLABS_API_KEY || "").trim()),
      hasVoice: Boolean(String(process.env.ELEVENLABS_VOICE_ID || "").trim()),
      modelId: process.env.ELEVENLABS_MODEL_ID || "",
      failure: ""
    },
    openAiCompatible: {
      hasApiKey: Boolean(String(process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY || "").trim()),
      model: process.env.OPENAI_TTS_MODEL || process.env.TTS_MODEL || "",
      failure: ""
    },
    external: {
      hasEndpoint: Boolean(String(process.env.OPEN_SOURCE_TTS_ENDPOINT || process.env.PIPER_TTS_ENDPOINT || process.env.TTS_ENDPOINT || "").trim()),
      failure: ""
    }
  };
}

async function fetchMiniMaxTts(text, body = {}, diagnostics) {
  const apiKey = String(process.env.MINIMAX_API_KEY || "").trim();
  const groupId = String(process.env.MINIMAX_GROUP_ID || "").trim();
  const voiceId = defaultMiniMaxVoiceId();

  if (!apiKey || !voiceId) {
    diagnostics.minimax.failure = !apiKey ? "missing_api_key" : "missing_default_voice";
    return null;
  }

  const baseUrl = trimTrailingSlash(process.env.MINIMAX_TTS_BASE_URL || "https://api.minimaxi.com/v1");
  const format = process.env.MINIMAX_TTS_FORMAT || "mp3";
  const speed = clampNumber(body.rate || process.env.MINIMAX_TTS_SPEED, 0.86, 0.5, 2);
  const volume = clampNumber(process.env.MINIMAX_TTS_VOLUME, 1, 0.1, 10);
  const pitch = clampNumber(process.env.MINIMAX_TTS_PITCH, 0, -12, 12);
  const endpoint = new URL(`${baseUrl}/t2a_v2`);
  if (groupId) endpoint.searchParams.set("GroupId", groupId);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.MINIMAX_TTS_MODEL || process.env.MINIMAX_MODEL_ID || "speech-02-hd",
      text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed,
        vol: volume,
        pitch
      },
      audio_setting: {
        sample_rate: numberOrDefault(process.env.MINIMAX_TTS_SAMPLE_RATE, 32000),
        bitrate: numberOrDefault(process.env.MINIMAX_TTS_BITRATE, 128000),
        format,
        channel: numberOrDefault(process.env.MINIMAX_TTS_CHANNEL, 1)
      }
    })
  });

  if (!response.ok) {
    diagnostics.minimax.failure = `request_${response.status}`;
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("audio/")) {
    return {
      provider: "minimax",
      contentType,
      buffer: Buffer.from(await response.arrayBuffer())
    };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    diagnostics.minimax.failure = "invalid_json";
    return null;
  }

  const statusCode = data?.base_resp?.status_code;
  if (typeof statusCode === "number" && statusCode !== 0) {
    diagnostics.minimax.failure = `api_${statusCode}`;
    return null;
  }

  const audio = readMiniMaxAudioPayload(data, format);
  if (!audio?.buffer?.length) diagnostics.minimax.failure = "no_audio";
  return audio;
}

async function fetchElevenLabsTts(text, diagnostics) {
  const apiKey = process.env.ELEVENLABS_API_KEY || "";
  if (!apiKey) {
    diagnostics.elevenLabs.failure = "missing_api_key";
    return null;
  }

  const resolved = await resolveElevenLabsVoiceId(apiKey, process.env.ELEVENLABS_VOICE_ID || "");
  if (!resolved.voiceId) {
    diagnostics.elevenLabs.failure = resolved.failure || "missing_voice";
    return null;
  }
  const voiceId = resolved.voiceId;

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
  const requestAudio = model => fetch(
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
        model_id: model,
        voice_settings: {
          stability: clampNumber(process.env.ELEVENLABS_STABILITY, 0.45, 0, 1),
          similarity_boost: clampNumber(process.env.ELEVENLABS_SIMILARITY_BOOST, 0.8, 0, 1),
          style: clampNumber(process.env.ELEVENLABS_STYLE, 0, 0, 1),
          use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST !== "false"
        }
      })
    }
  );

  let response = await requestAudio(modelId);
  if (!response.ok && modelId !== "eleven_multilingual_v2") {
    diagnostics.elevenLabs.failure = `request_${response.status}_fallback_model`;
    response = await requestAudio("eleven_multilingual_v2");
  }

  if (!response.ok) {
    diagnostics.elevenLabs.failure = `request_${response.status}`;
    return null;
  }
  const audio = await readProviderAudio(response, "elevenlabs");
  if (!audio) diagnostics.elevenLabs.failure = "no_audio";
  return audio;
}

async function fetchOpenAiCompatibleTts(text, body = {}, diagnostics) {
  const model = process.env.OPENAI_TTS_MODEL || process.env.TTS_MODEL || "";
  const apiKey = process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!model || !apiKey) {
    diagnostics.openAiCompatible.failure = !model ? "missing_model" : "missing_api_key";
    return null;
  }

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

  if (!response.ok) {
    diagnostics.openAiCompatible.failure = `request_${response.status}`;
    return null;
  }
  const audio = await readProviderAudio(response, "openai-compatible");
  if (!audio) diagnostics.openAiCompatible.failure = "no_audio";
  return audio;
}

async function fetchExternalTts(text, body = {}, diagnostics) {
  const endpoint = process.env.OPEN_SOURCE_TTS_ENDPOINT || process.env.PIPER_TTS_ENDPOINT || process.env.TTS_ENDPOINT;
  if (!endpoint) {
    diagnostics.external.failure = "missing_endpoint";
    return null;
  }

  const headers = { "Content-Type": "application/json" };
  const apiKey = process.env.OPEN_SOURCE_TTS_API_KEY || process.env.PIPER_TTS_API_KEY || "";
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildPayload(text, body))
  });

  if (!response.ok) {
    diagnostics.external.failure = `request_${response.status}`;
    return null;
  }
  const audio = await readProviderAudio(response, "external");
  if (!audio) diagnostics.external.failure = "no_audio";
  return audio;
}

module.exports = async function tts(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const body = await parseBody(req);
    const text = cleanText(body.text);
    if (!text) return sendJson(res, 400, { error: "Missing text" });

    const diagnostics = buildDiagnostics();
    const preferredProvider = String(process.env.TTS_PROVIDER || "").toLowerCase().trim();
    const miniMaxAudio = await fetchMiniMaxTts(text, body, diagnostics);
    const audio = miniMaxAudio || (
      preferredProvider === "minimax"
        ? null
        : await fetchElevenLabsTts(text, diagnostics)
          || await fetchOpenAiCompatibleTts(text, body, diagnostics)
          || await fetchExternalTts(text, body, diagnostics)
    );
    if (!audio?.buffer?.length) {
      return sendJson(res, 501, {
        error: "TTS provider is not configured",
        detail: "Set MINIMAX_API_KEY for MiniMax TTS. MINIMAX_TTS_VOICE_ID is optional and falls back to the default voice.",
        diagnostics
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", audio.contentType);
    res.setHeader("X-TTS-Provider", audio.provider || "unknown");
    res.setHeader("Cache-Control", "no-store");
    res.end(audio.buffer);
  } catch (error) {
    return sendJson(res, 500, { error: "TTS request failed", detail: error.message });
  }
};
