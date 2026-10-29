import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env")
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Upsert so re-running the seed also resets the admin password to the .env value
  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: "Admin" },
  })
  console.log(`Admin user ready: ${email}`)

  // USD per 1M tokens, standard tier. Checked 2026-10-29 against
  // Anthropic's model table and developers.openai.com/api/docs/pricing.
  // Only creates missing rows — prices edited later in Settings are not overwritten.
  const pricing = [
    ["CLAUDE", "claude-opus-5-5", 4.0, 20.0],
    ["CLAUDE", "claude-sonnet-5-5", 2.0, 10.0],
    ["CLAUDE", "claude-haiku-5-5", 0.1, 0.5],
    ["OPENAI", "gpt-6-astra", 10.0, 50.0],
    ["OPENAI", "gpt-6.1-sol", 2.0, 10.0],
    ["OPENAI", "gpt-6.1-terra", 1.0, 5.0],
    ["OPENAI", "gpt-6-luna", 0.1, 0.5],
  ]
  for (const [provider, model, inputPerMillionUsd, outputPerMillionUsd] of pricing) {
    await prisma.modelPricing.upsert({
      where: { provider_model: { provider, model } },
      update: {},
      create: { provider, model, inputPerMillionUsd, outputPerMillionUsd },
    })
  }
  console.log(`Model pricing rows ready: ${pricing.length}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
