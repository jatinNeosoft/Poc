import { Badge } from "@/components/ui/badge"

export function JobStatusBadge({ status }) {
  return status === "OPEN" ? (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Open</Badge>
  ) : (
    <Badge variant="secondary">Closed</Badge>
  )
}
