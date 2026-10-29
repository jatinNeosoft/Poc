import { randomBytes } from "node:crypto"

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789" // no look-alike characters (l/1, o/0, i)

function randomSuffix(length = 6) {
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

/** "Delivery Driver (Pune)" → "delivery-driver-pune-k7m2qx". The slug never changes after creation. */
export function makeJobSlug(title) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
  return base ? `${base}-${randomSuffix()}` : `job-${randomSuffix()}`
}
