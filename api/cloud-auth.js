import {
  bearerToken,
  createSession,
  createUser,
  findUserByEmail,
  nativeCloudConfigured,
  normalizeEmail,
  publicUser,
  validEmail,
  validPassword,
  verifyPassword,
  verifyToken
} from "../lib/cloud-native.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

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

  const body = requestBody(req);
  const action = String(body.action || "");
  try {
    if (action === "signup") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      if (!validEmail(email)) return sendJson(res, 400, { message: "请输入有效邮箱" });
      if (!validPassword(password)) return sendJson(res, 400, { message: "密码需为6至128位" });
      if (await findUserByEmail(email)) return sendJson(res, 409, { message: "该邮箱已经注册，请直接登录" });
      try {
        const user = await createUser(email, password);
        return sendJson(res, 200, createSession(publicUser(user)));
      } catch (error) {
        if (/already|exist|overwrite|409/i.test(String(error?.message || error))) {
          return sendJson(res, 409, { message: "该邮箱已经注册，请直接登录" });
        }
        throw error;
      }
    }

    if (action === "signin") {
      const email = normalizeEmail(body.email);
      const user = validEmail(email) ? await findUserByEmail(email, 3) : null;
      if (!user || !verifyPassword(String(body.password || ""), user.password)) {
        return sendJson(res, 401, { message: "邮箱或密码不正确" });
      }
      return sendJson(res, 200, createSession(publicUser(user)));
    }

    if (action === "refresh") {
      const payload = verifyToken(body.refresh_token, "refresh");
      if (!payload) return sendJson(res, 401, { message: "登录已过期，请重新登录" });
      const user = await findUserByEmail(payload.email, 2);
      if (!user || user.id !== payload.sub) return sendJson(res, 401, { message: "登录已过期，请重新登录" });
      return sendJson(res, 200, createSession(publicUser(user)));
    }

    if (action === "user") {
      const payload = verifyToken(bearerToken(req), "access");
      if (!payload) return sendJson(res, 401, { message: "登录已过期，请重新登录" });
      return sendJson(res, 200, { id: payload.sub, email: payload.email });
    }

    if (action === "logout") return sendJson(res, 200, { ok: true });
    return sendJson(res, 400, { message: "Unsupported cloud auth action" });
  } catch {
    return sendJson(res, 500, { message: "云同步服务暂时不可用，请稍后重试" });
  }
}
