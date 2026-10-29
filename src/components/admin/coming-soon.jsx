import { Construction } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

// Placeholder for sections built in later phases
export function ComingSoon({ title, phase }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Construction className="size-8" />
          <p>This section is built in {phase}.</p>
        </CardContent>
      </Card>
    </div>
  )
}
