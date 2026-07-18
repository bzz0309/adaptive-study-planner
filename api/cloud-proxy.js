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

function isAllowedRequest(path, method, requestHost) {
  let target;
  try { target = new URL(path, "https://cloud-proxy.invalid"); }
  catch { return false; }

  if (target.pathname === "/auth/v1/token" && method === "POST") {
    return ["password", "refresh_token"].includes(target.searchParams.get("grant_type"));
  }
  if (target.pathname === "/auth/v1/signup" && method === "POST") {
    const redirectTo = target.searchParams.get("redirect_to");
    if (!redirectTo) return true;
    try {
      const redirect = new URL(redirectTo);
      return redirect.host === requestHost || redirect.hostname.endsWith(".vercel.app");
    } catch { return false; }
  }
  if (target.pathname === "/auth/v1/user" && method === "GET") return true;
  if (target.pathname === "/auth/v1/logout" && method === "POST") return true;
  if (target.pathname !== "/rest/v1/study_state") return false;

  if (method === "GET") {
    const allowedKeys = new Set(["select", "user_id", "limit"]);
    return [...target.searchParams.keys()].every(key => allowedKeys.has(key));
  }
  return method === "POST" && target.searchParams.get("on_conflict") === "user_id";
}

export default async function handler(req, res) {
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  const baseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!baseUrl || !anonKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ message: "Cloud sync is not configured" }));
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const path = String(body.path || "");
  const method = String(body.method || "GET").toUpperCase();
  if (!isAllowedRequest(path, method, String(req.headers.host || ""))) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "Unsupported cloud request" }));
    return;
  }

  const authorization = /^Bearer\s+\S+/i.test(String(req.headers.authorization || ""))
    ? String(req.headers.authorization)
    : `Bearer ${anonKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: authorization,
        "Content-Type": "application/json",
        ...(body.prefer ? { Prefer: String(body.prefer) } : {})
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body.payload ?? {}) }),
      signal: controller.signal
    });
    const responseText = await upstream.text();
    res.statusCode = upstream.status;
    res.end(responseText || "{}");
  } catch (error) {
    res.statusCode = error?.name === "AbortError" ? 504 : 502;
    res.end(JSON.stringify({ message: "云同步服务当前不可用，请稍后再试" }));
  } finally {
    clearTimeout(timeout);
  }
}
