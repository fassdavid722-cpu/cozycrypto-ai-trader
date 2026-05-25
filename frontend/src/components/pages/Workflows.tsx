import { useStore } from '@/store/useStore'
import TopBar from '../TopBar'
import { Play, Pause, Settings, Trash2, Clock, Zap } from 'lucide-react'

export default function Workflows() {
  const { workflows } = useStore()

  return (
    <div className="p-6 min-h-full">
      <TopBar title="Autonomous Workflows" subtitle="Manage your AI trading agents and tasks" />

      <div className="grid grid-cols-3 gap-6">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="panel-surface p-6 flex flex-col group hover:border-[rgba(255,255,255,0.15)] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[rgba(34,197,94,0.1)] flex items-center justify-center border border-[rgba(34,197,94,0.2)]">
                <Zap className="text-[#22c55e]" size={20} />
              </div>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                workflow.status === 'running' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(255,255,255,0.05)] text-[#52525b]'
              }`}>
                {workflow.status}
              </div>
            </div>

            <h3 className="text-sm font-medium text-[#fafafa] mb-1">{workflow.name}</h3>
            <p className="text-xs text-[#52525b] mb-6 line-clamp-2">{workflow.description}</p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#52525b] uppercase tracking-widest font-bold">Last Run</span>
                <span className="text-[#a1a1aa] font-mono-data">{workflow.lastRun || 'Never'}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#52525b] uppercase tracking-widest font-bold">Next Run</span>
                <span className="text-[#22c55e] font-mono-data">{workflow.nextRun || 'Scheduled'}</span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.05)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-[#a1a1aa] hover:text-[#fafafa] transition-all">
                  <Settings size={14} />
                </button>
                <button className="p-2 rounded-lg bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
              <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                workflow.status === 'running' 
                  ? 'bg-[rgba(255,255,255,0.05)] text-[#fafafa] hover:bg-[rgba(255,255,255,0.1)]' 
                  : 'bg-[#22c55e] text-white hover:bg-[#16a34a]'
              }`}>
                {workflow.status === 'running' ? <Pause size={12} /> : <Play size={12} />}
                {workflow.status === 'running' ? 'Pause' : 'Start'}
              </button>
            </div>
          </div>
        ))}

        <button className="panel-surface p-6 flex flex-col items-center justify-center gap-3 border-dashed border-[rgba(255,255,255,0.1)] hover:border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.02)] transition-all group">
          <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.02)] flex items-center justify-center border border-[rgba(255,255,255,0.05)] group-hover:border-[rgba(34,197,94,0.2)] group-hover:bg-[rgba(34,197,94,0.05)] transition-all">
            <Play className="text-[#52525b] group-hover:text-[#22c55e]" size={20} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[#fafafa]">Create New Workflow</p>
            <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold mt-1">Deploy a new AI agent</p>
          </div>
        </button>
      </div>

      <div className="mt-8 panel-surface p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock size={18} className="text-[#3b82f6]" />
          <h3 className="text-sm font-medium text-[#fafafa] uppercase tracking-widest">Workflow Activity Log</h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4 pb-4 border-b border-[rgba(255,255,255,0.05)] last:border-0 last:pb-0">
              <div className="w-2 h-2 rounded-full bg-[#22c55e] mt-1.5" />
              <div className="flex-1">
                <p className="text-xs text-[#fafafa]">
                  <span className="font-bold text-[#22c55e]">SMC Scanner</span> executed successfully for <span className="font-mono-data text-[#a1a1aa]">BTC/USDT</span>
                </p>
                <p className="text-[10px] text-[#52525b] mt-1 font-mono-data">2 minutes ago • Result: No high-confidence setup found</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
