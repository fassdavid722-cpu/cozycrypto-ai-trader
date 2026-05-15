import React from 'react'
import { Play, Pause, Plus, Zap, BarChart2, Globe, Scale } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Card from '@/components/ui/Card'

const workflowTemplates = [
  { name: 'Market Scanner', desc: 'Scans top 50 coins for opportunities every 5 min', icon: BarChart2, color: 'text-gold' },
  { name: 'Signal Bot', desc: 'RSI + MACD + Volume confluence signals', icon: Zap, color: 'text-blue-ai' },
  { name: 'News Sentiment', desc: 'Monitors crypto news and social sentiment', icon: Globe, color: 'text-green-trade' },
  { name: 'Portfolio Rebalancer', desc: 'Auto-rebalances based on your target allocation', icon: Scale, color: 'text-purple-400' },
]

export default function Workflows() {
  const { workflows, setWorkflows } = useStore()

  const toggle = (id: string) => {
    setWorkflows(workflows.map(w =>
      w.id === id ? { ...w, status: w.status === 'running' ? 'paused' : 'running' } : w
    ))
  }

  return (
    <div className="h-full overflow-y-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">Workflows</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-gold text-black rounded-lg text-xs font-semibold hover:bg-gold-dim transition-colors">
          <Plus size={14} /> New Workflow
        </button>
      </div>

      {/* Active */}
      <div>
        <p className="text-text-muted text-xs uppercase tracking-wider mb-3">Active ({workflows.filter(w=>w.status==='running').length})</p>
        <div className="space-y-2">
          {workflows.map(wf => (
            <Card key={wf.id} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                <BarChart2 size={16} className="text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{wf.name}</p>
                <p className="text-text-muted text-xs">{wf.description}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded font-medium ${
                wf.status === 'running' ? 'bg-green-trade/20 text-green-trade' :
                wf.status === 'scheduled' ? 'bg-blue-ai/20 text-blue-ai' :
                'bg-bg-border text-text-muted'
              }`}>{wf.status}</span>
              <button onClick={() => toggle(wf.id)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                {wf.status === 'running' ? <Pause size={14} className="text-text-secondary" /> : <Play size={14} className="text-green-trade" />}
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div>
        <p className="text-text-muted text-xs uppercase tracking-wider mb-3">Templates</p>
        <div className="grid grid-cols-2 gap-3">
          {workflowTemplates.map(t => (
            <Card key={t.name} className="cursor-pointer hover:border-gold/30 transition-colors" onClick={() => {}}>
              <div className="flex items-center gap-2 mb-2">
                <t.icon size={16} className={t.color} />
                <span className="text-white text-sm font-medium">{t.name}</span>
              </div>
              <p className="text-text-muted text-xs">{t.desc}</p>
              <button className="mt-3 w-full py-1.5 bg-gold/10 hover:bg-gold/20 text-gold text-xs rounded-lg transition-colors font-medium">
                + Add Workflow
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
