import { createHash, createSign } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { getStorage } from "@/lib/storage"
import { recordUsage } from "@/lib/cost"
import { AIConfigError } from "@/lib/ai"

// Google Cloud Text-to-Speech, Chirp 3 HD voices (natural en-IN / hi-IN accents).
// Billed per character: ModelPricing row GOOGLE / "tts-google-chirp3-hd" holds $ per 1M characters.
const PRICING_MODEL = "tts-google-chirp3-hd"
const API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

/** Chirp 3 HD voice names (same set for every language), checked 2026-10-29. */
export const TTS_VOICES = {
  female: ["Achernar", "Aoede", "Autonoe", "Callirrhoe", "Despina", "Erinome", "Gacrux", "Kore", "Laomedeia", "Leda", "Pulcherrima", "Sulafat", "Vindemiatrix", "Zephyr"],
  male: ["Achird", "Algenib", "Algieba", "Alnilam", "Charon", "Enceladus", "Fenrir", "Iapetus", "Orus", "Puck", "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Umbriel", "Zubenelgenubi"],
}
export const ALL_TTS_VOICES = [...TTS_VOICES.female, ...TTS_VOICES.male]

const b64url = (data) => Buffer.from(data).toString("base64url")
let cachedToken = null // { token, expiresAt } for the service account

/** OAuth access token from a service-account JSON key (signed JWT → token), reused until near expiry. */
async function serviceAccountToken(file) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token

  let sa
  try {
    sa = JSON.parse(readFileSync(path.resolve(process.cwd(), file), "utf8"))
  } catch {
    throw new AIConfigError(`Cannot read the Google service-account file "${file}" (GOOGLE_APPLICATION_CREDENTIALS)`)
  }
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token"
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: tokenUri, iat: now, exp: now + 3600 })
  )}`
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  })
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`)
  const { access_token, expires_in } = await res.json()
  cachedToken = { token: access_token, expiresAt: Date.now() + expires_in * 1000 }
  return access_token
}

/** Request URL + headers: service-account JSON file if set, else the API key. */
async function googleAuth() {
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (file) return { url: API_URL, headers: { Authorization: `Bearer ${await serviceAccountToken(file)}` } }

  const apiKey = process.env.GOOGLE_TTS_API_KEY?.trim()
  if (apiKey) return { url: `${API_URL}?key=${encodeURIComponent(apiKey)}`, headers: {} }

  throw new AIConfigError("Set GOOGLE_APPLICATION_CREDENTIALS (service-account JSON file) or GOOGLE_TTS_API_KEY for the server voice")
}

/** MP3 for the text, cached on disk by voice + text so repeats cost nothing. */
export async function synthesizeSpeech({ text, languageCode, voice, interviewId, jobId }) {
  const voiceName = `${languageCode}-Chirp3-HD-${voice}` // e.g. en-IN-Chirp3-HD-Aoede
  const storage = getStorage()
  const hash = createHash("sha256").update(`google|${voiceName}|${text}`).digest("hex").slice(0, 32)
  const key = `tts/${hash}.mp3`

  if (await storage.stat(key)) return { key, cached: true }

  const auth = await googleAuth()
  const res = await fetch(auth.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth.headers },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: "MP3" },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Google TTS failed (${res.status}): ${detail.slice(0, 300)}`)
  }
  const { audioContent } = await res.json()
  await storage.save(key, Buffer.from(audioContent, "base64"), "audio/mpeg")

  await recordUsage({
    provider: "GOOGLE",
    model: PRICING_MODEL,
    purpose: "TTS",
    interviewId,
    jobId,
    inputTokens: [...text].length, // characters, matching the per-character price
    outputTokens: 0,
  })
  return { key, cached: false }
}
