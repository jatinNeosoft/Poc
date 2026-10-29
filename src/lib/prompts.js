import { readFile } from "node:fs/promises"
import path from "node:path"

const PROMPTS_DIR = path.join(process.cwd(), "prompts")
const cache = new Map()

/**
 * Load prompts/<lang>/<name>.md and fill {{placeholders}}.
 * Falls back to English if the language has no such file.
 */
export async function loadPrompt(lang, name, vars = {}) {
  const template = await readTemplate(lang, name)
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key]
    return value === undefined || value === null || value === "" ? "-" : String(value)
  })
}

async function readTemplate(lang, name) {
  const key = `${lang}/${name}`
  if (process.env.NODE_ENV === "production" && cache.has(key)) return cache.get(key)

  let text
  try {
    text = await readFile(path.join(PROMPTS_DIR, lang, `${name}.md`), "utf8")
  } catch (err) {
    if (err.code !== "ENOENT" || lang === "en") throw err
    text = await readFile(path.join(PROMPTS_DIR, "en", `${name}.md`), "utf8")
  }
  cache.set(key, text)
  return text
}
