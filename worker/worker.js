// What's for Tea? — Claude helper (Cloudflare Worker)
//
// The app sends recipe prompts and photos here. This worker:
//   1. checks the request comes from someone signed in to the app (a Firebase sign-in token),
//   2. passes it to Claude using your Anthropic API key, which never leaves Cloudflare,
//   3. sends Claude's JSON answer back to the app.
//
// Settings (Cloudflare dashboard > your worker > Settings > Variables and secrets):
//   ANTHROPIC_API_KEY   secret, required
//   FIREBASE_PROJECT_ID text, defaults to kcal-tracker-1adb3
//   ALLOWED_EMAILS      text, optional: comma-separated emails allowed to use it
//                       (leave empty to allow anyone signed in to the app)
//   MODEL               text, optional: defaults to claude-sonnet-5-5
//
// One file, no build step, so it can be pasted straight into the Cloudflare editor.

const ALLOWED_ORIGINS = ["https://mjhails.github.io", "http://localhost:5173", "http://localhost:4173"];
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_PROMPT_CHARS = 30000;
const MAX_IMAGES = 6;
const MAX_IMAGE_BASE64 = 3_000_000; // about 2.2 MB per image after decoding

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "Use POST" });
    if (!env.ANTHROPIC_API_KEY) return reply(500, { error: "ANTHROPIC_API_KEY isn't set on the worker" });

    // 1. Who is asking?
    const projectId = env.FIREBASE_PROJECT_ID || "kcal-tracker-1adb3";
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    let user;
    try {
      user = await verifyFirebaseToken(token, projectId);
    } catch (e) {
      return reply(401, { error: "Sign in to the app first" });
    }
    const allowed = (env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(String(user.email || "").toLowerCase())) {
      return reply(403, { error: "This account isn't on the allowed list" });
    }

    // 2. What are they asking?
    let body;
    try {
      body = await request.json();
    } catch {
      return reply(400, { error: "Send JSON" });
    }
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const images = Array.isArray(body.images) ? body.images : [];
    if (!prompt || prompt.length > MAX_PROMPT_CHARS) return reply(400, { error: "Prompt missing or too long" });
    if (images.length > MAX_IMAGES) return reply(413, { error: "Too many images" });
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    for (const img of images) {
      if (!img || !okTypes.includes(img.media_type) || typeof img.data !== "string" || img.data.length > MAX_IMAGE_BASE64) {
        return reply(413, { error: "One of the images can't be used" });
      }
    }

    // 3. Ask Claude
    const content = [
      ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } })),
      { type: "text", text: prompt },
    ];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-5-5",
        max_tokens: 6000,
        system: "You return only valid JSON with no other text, no explanation and no code fences.",
        messages: [{ role: "user", content }],
      }),
    });
    if (res.status === 429) return reply(429, { error: "Claude is busy, try again in a minute" });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return reply(502, { error: "Claude request failed", status: res.status, detail: detail.slice(0, 500) });
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const result = extractJson(text);
    if (result === undefined) return reply(502, { error: "Claude's answer wasn't valid JSON" });
    return reply(200, { result });
  },
};

// Pulls the JSON out of Claude's answer, tolerating stray code fences or text.
function extractJson(text) {
  const t = String(text || "").replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(t);
  } catch {}
  const starts = [t.indexOf("["), t.indexOf("{")].filter((i) => i >= 0);
  if (!starts.length) return undefined;
  const start = Math.min(...starts);
  const end = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (end <= start) return undefined;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

// ---- Firebase sign-in token check (RS256 JWT signed by Google) ----
let jwksCache = { keys: null, until: 0 };

async function getJwks() {
  const now = Date.now();
  if (jwksCache.keys && now < jwksCache.until) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("Couldn't fetch Google's signing keys");
  const json = await res.json();
  const maxAge = /max-age=(\d+)/.exec(res.headers.get("Cache-Control") || "");
  jwksCache = { keys: json.keys || [], until: now + (maxAge ? +maxAge[1] * 1000 : 3600_000) };
  return jwksCache.keys;
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function verifyFirebaseToken(token, projectId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unexpected token type");

  const jwk = (await getJwks()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!valid) throw new Error("Bad signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error("Wrong project");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("Wrong issuer");
  if (!payload.sub) throw new Error("No user");
  if (typeof payload.exp !== "number" || payload.exp < now - 60) throw new Error("Expired");
  if (typeof payload.iat !== "number" || payload.iat > now + 300) throw new Error("Issued in the future");
  return { uid: payload.sub, email: payload.email || "" };
}
