import { NextResponse } from "next/server"
import { getClientState } from "@/lib/interview/engine"
import { authorizeInterview } from "@/lib/interview/http"

// Resume: current state + transcript for this device's saved token
export async function GET(req, { params }) {
  const { id } = await params
  const { response } = await authorizeInterview(req, id)
  if (response) return response
  return NextResponse.json({ state: await getClientState(id) })
}
