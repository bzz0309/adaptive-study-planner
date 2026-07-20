import {
  bearerToken,
  nativeCloudConfigured,
  readPrivateJson,
  statePathForUser,
  verifyToken,
  writePrivateJson
} from "../lib/cloud-native.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const MAX_STATE_BYTES = 900_000;

function sendJson(res, status, payload) {
  res.statusCode = status;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

function requestBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(String(req.body || "{}")); }
  catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { message: "Method not allowed" });
  if (!nativeCloudConfigured()) return sendJson(res, 503, { message: "云同步服务尚未配置完成" });
  const session = verifyToken(bearerToken(req), "access");
  if (!session) return sendJson(res, 401, { message: "登录已过期，请重新登录" });

  const body = requestBody(req);
  const pathname = statePathForUser(session.sub);
  try {
    if (body.action === "load") {
      const stored = await readPrivateJson(pathname, 3);
      return sendJson(res, 200, stored ? [{ data: stored.data, updated_at: stored.updatedAt }] : []);
    }
    if (body.action === "save") {
      if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        return sendJson(res, 400, { message: "学习数据格式不正确" });
      }
      const serialized = JSON.stringify(body.data);
      if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
        return sendJson(res, 413, { message: "学习数据过大，暂时无法同步" });
      }
      const updatedAt = new Date().toISOString();
      await writePrivateJson(pathname, { data: body.data, updatedAt }, true);
      return sendJson(res, 200, { updated_at: updatedAt });
    }
    return sendJson(res, 400, { message: "Unsupported cloud state action" });
  } catch {
    return sendJson(res, 500, { message: "学习进度暂时无法同步，请稍后重试" });
  }
}
