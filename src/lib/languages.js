import { readdirSync, readFileSync, existsSync } from "node:fs"
import path from "node:path"

const LANG_DIR = path.join(process.cwd(), "languages")
const PROMPTS_DIR = path.join(process.cwd(), "prompts")

let cached

/**
 * All languages available for interviews. A language is enabled when it has
 * languages/<code>.json AND prompts/<code>/system.md — add both files to add a language.
 */
export function getLanguages() {
  if (cached && process.env.NODE_ENV === "production") return cached

  cached = readdirSync(LANG_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(LANG_DIR, f), "utf8")))
    .filter((lang) => existsSync(path.join(PROMPTS_DIR, lang.code, "system.md")))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  return cached
}

export function getLanguage(code) {
  return getLanguages().find((l) => l.code === code) ?? null
}

/** What the browser needs (no server-only settings like the server TTS voice). */
export function publicLanguage(lang) {
  const { serverVoice: _serverVoice, ...tts } = lang.tts
  return {
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
    sttLang: lang.sttLang,
    tts,
    labels: lang.labels,
  }
}
