import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"

export function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/** Returns the session, or a 401 response to return directly. Middleware also guards these routes. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return { response: jsonError("Unauthorized", 401) }
  return { session }
}

/** Parse a JSON body with a Zod schema → { data } or { response } (400 with field errors). */
export async function parseBody(req, schema) {
  let body
  try {
    body = await req.json()
  } catch {
    return { response: jsonError("Invalid JSON body") }
  }
  return validate(body, schema)
}

/** Validate an already-read value with a Zod schema → { data } or { response }. */
export function validate(body, schema) {
  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      response: jsonError("Validation failed", 400, { fieldErrors: z.flattenError(result.error).fieldErrors }),
    }
  }
  return { data: result.data }
}
