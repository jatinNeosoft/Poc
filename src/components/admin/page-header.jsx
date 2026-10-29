"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NAV_ITEMS } from "@/components/admin/app-sidebar"

// Top bar of the admin panel: sidebar toggle + current section name
export function PageHeader() {
  const pathname = usePathname()
  const current =
    NAV_ITEMS.filter((item) => item.href !== "/admin").find((item) => pathname.startsWith(item.href)) ??
    NAV_ITEMS[0]

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-sm font-medium">{current.title}</h1>
    </header>
  )
}
