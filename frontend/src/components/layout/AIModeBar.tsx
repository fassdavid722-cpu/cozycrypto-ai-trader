import React from 'react'
import { MessageSquare, LineChart, Zap, Wrench, BookOpen, Sparkles, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'

const modes = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'analyze', label: 'Analyze', icon: LineChart },
  { id: 'automate', label: 'Automate', icon: Zap },
  { id: 'build', label: 'Build', icon: Wrench },
  { id: 'research', label: 'Research', icon: BookOpen },
] as const

export default function AIModeBar() {
  const { aiMode, setAiMode, isThinking } = useStore()

  return (
    <div className="h-10 bg-bg-secondary border-t border-bg-border flex items-center px-4 gap-1 shrink-0">
      {/* AI Mode toggle */}
      <button className="flex items-center gap-1.5 px-3 py-1 bg-gold/10 border border-gold/20 rounded-md mr-3">
        <Sparkles size={11} className="text-gold" />
        <span className="text-gold text-[10px] font-semibold uppercase tracking-wider">Cozanet AI Mode</span>
        <ChevronRight size={10} className="text-gold" />
      </button>

      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setAiMode(id)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] transition-all ${
            aiMode === id
              ? 'bg-white/10 text-white font-medium'
              : 'text-text-secondary hover:text-white hover:bg-white/5'
          }`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}

      {/* AI Thinking status */}
      {isThinking && (
        <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-blue-ai/10 rounded-md border border-blue-ai/20">
          <Sparkles size={11} className="text-blue-ai animate-spin" />
          <span className="text-blue-ai text-[10px] font-mono">AI THINKING...</span>
          <ChevronRight size={10} className="text-blue-ai" />
        </div>
      )}
    </div>
  )
}
