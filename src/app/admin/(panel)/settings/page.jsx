import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AiDefaultsForm, CurrencyForm, VoiceSettingsForm } from "@/components/admin/settings-forms"
import { PricingTable } from "@/components/admin/pricing-table"
import { getModelOptions } from "@/lib/ai/catalog"
import { getLanguages } from "@/lib/languages"
import { getAISettings, getTtsSettings, getUsdToInr } from "@/lib/settings"
import { TTS_VOICES } from "@/lib/tts/server"

export const dynamic = "force-dynamic"
export const metadata = { title: "Settings — HireVoice" }

export default async function SettingsPage() {
  const [ai, tts, usdToInr, models, pricing] = await Promise.all([
    getAISettings(),
    getTtsSettings(),
    getUsdToInr(),
    getModelOptions(),
    prisma.modelPricing.findMany({ orderBy: [{ provider: "asc" }, { model: "asc" }] }),
  ])
  const languages = getLanguages().map((l) => ({
    code: l.code,
    name: l.name,
    nativeName: l.nativeName,
    fileVoice: l.tts.serverVoice,
  }))
  // Decimal → plain values for the client component
  const rows = pricing.map((p) => ({
    ...p,
    inputPerMillionUsd: Number(p.inputPerMillionUsd),
    outputPerMillionUsd: Number(p.outputPerMillionUsd),
  }))

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Saved here, these override the values in .env.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI defaults</CardTitle>
          <CardDescription>Which AI runs interviews for jobs that don&apos;t choose their own model.</CardDescription>
        </CardHeader>
        <CardContent>
          <AiDefaultsForm value={ai} models={models} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Read-aloud voice</CardTitle>
          <CardDescription>How the AI&apos;s questions are spoken to candidates.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceSettingsForm value={tts} languages={languages} voices={TTS_VOICES} />
        </CardContent>
      </Card>

      <Card className="pb-3">
        <CardHeader>
          <CardTitle>Model pricing</CardTitle>
          <CardDescription>
            AI cost is calculated from the real token usage × these prices. Add a model here to make it selectable for jobs.
          </CardDescription>
        </CardHeader>
        <PricingTable rows={rows} defaults={ai} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>Exchange rate used to show AI cost in rupees.</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrencyForm value={usdToInr} />
        </CardContent>
      </Card>
    </div>
  )
}
