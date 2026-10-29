import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export const authOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12 hours
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        const admin = await prisma.admin.findUnique({ where: { email } })
        if (!admin) return null

        const ok = await bcrypt.compare(password, admin.passwordHash)
        if (!ok) return null

        return { id: admin.id, email: admin.email, name: admin.name }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.adminId = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.adminId
      return session
    },
  },
}
