import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/admin/app-sidebar"
import { PageHeader } from "@/components/admin/page-header"

export default async function AdminPanelLayout({ children }) {
  // Middleware already guards /admin; this is a second check on the server
  const session = await getServerSession(authOptions)
  if (!session) redirect("/admin/login")

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <PageHeader />
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
