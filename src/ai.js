// Talks to the Cloudflare Worker, which holds the Anthropic API key and
// passes requests on to Claude. The worker only answers people who are
// signed in to this app, so the key can't be used by anyone else.
import { auth } from "./firebase.js";
import { AI_URL } from "./config.js";

export const aiEnabled = !!AI_URL;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// Sends a prompt (and optional images) and resolves with the JSON Claude
// returned. Rejects with {code} so the app can show a friendly message.
export async function aiJson(prompt, { images = [], signal } = {}) {
  if (!AI_URL) throw { code: "not_granted" };
  const user = auth.currentUser;
  if (!user) throw { code: "not_granted" };
  const token = await user.getIdToken();
  const imgs = [];
  for (const b of images) imgs.push({ media_type: b.type || "image/jpeg", data: await blobToBase64(b) });
  let res;
  try {
    res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ prompt, images: imgs }),
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw { code: "cancelled" };
    throw { code: "network" };
  }
  if (res.status === 429) throw { code: "rate_limited" };
  if (res.status === 401 || res.status === 403) throw { code: "not_granted" };
  if (res.status === 413) throw { code: "image_rejected" };
  if (!res.ok) throw { code: "failed" };
  const out = await res.json().catch(() => null);
  if (!out || out.result === undefined) throw { code: "failed" };
  return out.result;
}
