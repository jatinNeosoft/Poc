"use client"

import { useEffect } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

// Opens the print dialog once on load; the button is hidden on paper
export function PrintButton() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400) // let the QR image paint first
    return () => clearTimeout(t)
  }, [])

  return (
    <Button size="lg" className="print:hidden" onClick={() => window.print()}>
      <Printer />
      Print
    </Button>
  )
}
