import { Bell, Search } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle: string
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-medium text-[#fafafa] tracking-tight">{title}</h1>
        <p className="text-sm text-[#a1a1aa] mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {/* AI Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs font-medium text-[#22c55e]">AI Online</span>
        </div>
        {/* Search */}
        <button className="p-2 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[rgba(255,255,255,0.15)] transition-all">
          <Search size={18} />
        </button>
        {/* Notifications */}
        <button className="relative p-2 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[rgba(255,255,255,0.15)] transition-all">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ef4444]" />
        </button>
      </div>
    </div>
  )
}
