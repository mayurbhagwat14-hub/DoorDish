import { Loader2 } from "lucide-react"

export default function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-[#FF5A1F]/10 rounded-full" />
        <div className="absolute inset-0 border-4 border-t-[#FF5A1F] rounded-full animate-spin" />
      </div>
    </div>
  )
}
