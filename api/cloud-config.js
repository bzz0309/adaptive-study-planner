const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function normalizeSupabaseUrl(value = "") {
  return String(value)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(?:rest|auth|storage)\/v1$/i, "");
}

export default function handler(req, res) {
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method && req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ enabled: false }));
    return;
  }

  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  const nativeEnabled = Boolean(
    String(process.env.BLOB_READ_WRITE_TOKEN || "").trim()
    && String(process.env.CLOUD_SESSION_SECRET || "").trim()
  );

  res.statusCode = 200;
  res.end(JSON.stringify({
    enabled: nativeEnabled || Boolean(url && anonKey),
    provider: nativeEnabled ? "native" : "supabase",
    url: nativeEnabled ? "" : (url || ""),
    anonKey: nativeEnabled ? "" : (anonKey || "")
  }));
}
