import { Suspense } from "react"
import { BriefcaseBusiness } from "lucide-react"
import { LoginForm } from "@/components/admin/login-form"

export const metadata = { title: "Admin login — HireVoice" }

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <h1 className="text-xl font-semibold">HireVoice Admin</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage jobs and candidates</p>
        </div>
        {/* useSearchParams in the form needs a Suspense boundary */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
