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

module.exports = async function tts(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const endpoint = process.env.OPEN_SOURCE_TTS_ENDPOINT || process.env.PIPER_TTS_ENDPOINT || process.env.TTS_ENDPOINT;
  if (!endpoint) {
    return sendJson(res, 501, {
      error: "Open source TTS endpoint is not configured",
      detail: "Set OPEN_SOURCE_TTS_ENDPOINT to a Piper/MeloTTS compatible service."
    });
  }

  try {
    const body = await parseBody(req);
    const text = cleanText(body.text);
    if (!text) return sendJson(res, 400, { error: "Missing text" });

    const headers = { "Content-Type": "application/json" };
    const apiKey = process.env.OPEN_SOURCE_TTS_API_KEY || process.env.PIPER_TTS_API_KEY || "";
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(buildPayload(text, body))
    });

    if (!providerResponse.ok) {
      return sendJson(res, 502, {
        error: "TTS provider failed",
        status: providerResponse.status
      });
    }

    const audio = await readProviderAudio(providerResponse);
    if (!audio?.buffer?.length) return sendJson(res, 502, { error: "TTS provider did not return audio" });

    res.statusCode = 200;
    res.setHeader("Content-Type", audio.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.end(audio.buffer);
  } catch (error) {
    return sendJson(res, 500, { error: "TTS request failed", detail: error.message });
  }
};
