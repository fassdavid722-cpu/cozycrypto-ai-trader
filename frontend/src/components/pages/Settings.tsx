import { useState, useEffect } from 'react'
import TopBar from '../TopBar'
import { Save, Shield, Bell, Key, Bot, Cpu } from 'lucide-react'

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general')
  const [isSaving, setIsSaving] = useState(false)

  const sections = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'ai', label: 'AI Settings', icon: Bot },
    { id: 'risk', label: 'Risk Management', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Key },
  ]

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1000)
  }

  return (
    <div className="p-6 min-h-full">
      <TopBar title="Settings" subtitle="Configure your AI trading system" />

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                activeSection === section.id
                  ? 'bg-[#1f1f1f] text-[#fafafa] border border-[rgba(255,255,255,0.15)]'
                  : 'text-[#52525b] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.02)]'
              }`}
            >
              <section.icon size={18} />
              <span className="font-medium">{section.label}</span>
            </button>
          ))}
        </div>

        <div className="col-span-3 space-y-6">
          <div className="panel-surface p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-[#fafafa] uppercase tracking-widest">General Settings</h3>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#22c55e] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#16a34a] transition-all"
              >
                <Save size={14} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">Trading Mode</label>
                <select className="w-full bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-xs text-[#fafafa] outline-none focus:border-[rgba(34,197,94,0.3)]">
                  <option>Autonomous</option>
                  <option>Semi-Autonomous</option>
                  <option>Manual</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">Base Currency</label>
                <select className="w-full bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-xs text-[#fafafa] outline-none focus:border-[rgba(34,197,94,0.3)]">
                  <option>USDT</option>
                  <option>USDC</option>
                  <option>BTC</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">Preferred Exchange</label>
                <select className="w-full bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-xs text-[#fafafa] outline-none focus:border-[rgba(34,197,94,0.3)]">
                  <option>Bitget</option>
                  <option>Binance</option>
                  <option>Bybit</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-[#52525b] uppercase tracking-widest font-bold">Timezone</label>
                <select className="w-full bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-xs text-[#fafafa] outline-none focus:border-[rgba(34,197,94,0.3)]">
                  <option>UTC (GMT+0)</option>
                  <option>EST (GMT-5)</option>
                  <option>PST (GMT-8)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="panel-surface p-6">
            <h3 className="text-sm font-medium text-[#fafafa] uppercase tracking-widest mb-6">AI Status</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(34,197,94,0.1)] flex items-center justify-center">
                    <Bot className="text-[#22c55e]" size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#fafafa]">Autonomous Mode</p>
                    <p className="text-[10px] text-[#52525b]">AI will analyze and trade</p>
                  </div>
                </div>
                <div className="w-10 h-5 bg-[#22c55e] rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[rgba(59,130,246,0.1)] flex items-center justify-center">
                    <Cpu className="text-[#3b82f6]" size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#fafafa]">Learning Mode</p>
                    <p className="text-[10px] text-[#52525b]">AI will adapt to market</p>
                  </div>
                </div>
                <div className="w-10 h-5 bg-[#3b82f6] rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
