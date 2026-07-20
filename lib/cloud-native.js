import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import { get, put } from "@vercel/blob";

const ACCESS_TOKEN_SECONDS = 60 * 60 * 24 * 30;
const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 180;

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}

function sessionSecret() {
  return String(process.env.CLOUD_SESSION_SECRET || "").trim();
}

export function nativeCloudConfigured() {
  return Boolean(blobToken() && sessionSecret());
}

export function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function validEmail(value = "") {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validPassword(value = "") {
  const password = String(value || "");
  return password.length >= 6 && password.length <= 128;
}

function digest(value = "") {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function userPathForEmail(email) {
  return `cloud/users/${digest(normalizeEmail(email))}.json`;
}

export function statePathForUser(userId) {
  return `cloud/state/${digest(String(userId || ""))}.json`;
}

function safeEqualHex(left = "", right = "") {
  try {
    const a = Buffer.from(String(left), "hex");
    const b = Buffer.from(String(right), "hex");
    return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createPasswordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { algorithm: "scrypt", salt, hash };
}

export function verifyPassword(password, record = {}) {
  if (record.algorithm !== "scrypt" || !record.salt || !record.hash) return false;
  const candidate = scryptSync(String(password), String(record.salt), 64).toString("hex");
  return safeEqualHex(candidate, record.hash);
}

function signEncodedPayload(encodedPayload) {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

function issueToken(user, type, expiresIn) {
  const payload = {
    sub: user.id,
    email: user.email,
    type,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signEncodedPayload(encoded)}`;
}

export function verifyToken(token = "", expectedType = "access") {
  if (!nativeCloudConfigured()) return null;
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;
  const expected = signEncodedPayload(encoded);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.type !== expectedType || !payload.sub || !payload.email || Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSession(user) {
  const safeUser = { id: user.id, email: user.email };
  return {
    access_token: issueToken(safeUser, "access", ACCESS_TOKEN_SECONDS),
    refresh_token: issueToken(safeUser, "refresh", REFRESH_TOKEN_SECONDS),
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
    user: safeUser
  };
}

async function streamText(stream) {
  if (!stream) return "";
  return new Response(stream).text();
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function readPrivateJson(pathname, retries = 0) {
  if (!nativeCloudConfigured()) return null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await get(pathname, { access: "private", token: blobToken() });
      if (result?.statusCode === 200) {
        const text = await streamText(result.stream);
        return text ? JSON.parse(text) : null;
      }
    } catch (error) {
      if (!/not.?found|404/i.test(String(error?.message || error))) throw error;
    }
    if (attempt < retries) await wait(250 * (2 ** attempt));
  }
  return null;
}

export async function writePrivateJson(pathname, value, allowOverwrite = true) {
  if (!nativeCloudConfigured()) throw new Error("Native cloud is not configured");
  return put(pathname, JSON.stringify(value), {
    access: "private",
    token: blobToken(),
    addRandomSuffix: false,
    allowOverwrite,
    contentType: "application/json",
    cacheControlMaxAge: 0
  });
}

export async function findUserByEmail(email, retries = 0) {
  return readPrivateJson(userPathForEmail(email), retries);
}

export async function createUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const user = {
    id: randomUUID(),
    email: normalizedEmail,
    password: createPasswordRecord(password),
    createdAt: new Date().toISOString()
  };
  await writePrivateJson(userPathForEmail(normalizedEmail), user, false);
  return user;
}

export function publicUser(user = {}) {
  return { id: user.id, email: user.email };
}

export function bearerToken(req) {
  const authorization = String(req.headers?.authorization || "");
  return authorization.replace(/^Bearer\s+/i, "").trim();
}
