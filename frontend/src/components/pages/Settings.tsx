import React, { useState } from 'react'
import { Eye, EyeOff, Save, Shield, Zap, Brain, Info, CheckCircle2 } from 'lucide-react'
import Card from '@/components/ui/Card'

export default function Settings() {
  const [show, setShow] = useState(false)
  const [keys, setKeys] = useState({ bitgetKey: '', bitgetSecret: '', bitgetPassphrase: '', groqKey: '' })
  const [risk, setRisk] = useState({ maxTradePercent: 10, stopLoss: 2, takeProfit: 4, maxOpenTrades: 3 })
  const [saved, setSaved] = useState(false)

  const save = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys, risk })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
  }

  return (
    <div className="h-full overflow-y-auto pb-10">
      <div className="max-w-3xl mx-auto space-y-8 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Settings</h2>
            <p className="text-text-muted text-sm mt-1">Configure your trading parameters and AI behavior.</p>
          </div>
          <button 
            onClick={save}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
              saved 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-gold text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]'
            }`}
          >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? 'Changes Saved' : 'Save Configuration'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: API & Risk */}
          <div className="md:col-span-7 space-y-6">
            {/* API Keys Card */}
            <Card className="overflow-hidden border-bg-border/40 bg-bg-secondary/30 backdrop-blur-sm">
              <div className="p-5 border-b border-bg-border/40 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gold/10 border border-gold/20">
                    <Shield size={18} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">API Authentication</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5">Secure Connection</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShow(!show)} 
                  className="p-2 hover:bg-white/5 rounded-lg text-text-muted transition-colors"
                  title={show ? "Hide Keys" : "Show Keys"}
                >
                  {show ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { label: 'Bitget API Key', key: 'bitgetKey', ph: 'bg_xxxxxxxxxxxx' },
                  { label: 'Bitget Secret Key', key: 'bitgetSecret', ph: 'sk_xxxxxxxxxxxx' },
                  { label: 'Bitget Passphrase', key: 'bitgetPassphrase', ph: 'Your passphrase' },
                  { label: 'Groq API Key (AI)', key: 'groqKey', ph: 'gsk_xxxxxxxxxxxx' },
                ].map(f => (
                  <div key={f.key} className="group">
                    <label className="text-text-secondary text-[11px] font-medium mb-1.5 block group-focus-within:text-gold transition-colors">
                      {f.label}
                    </label>
                    <input
                      type={show ? 'text' : 'password'}
                      value={(keys as any)[f.key]}
                      onChange={e => setKeys({ ...keys, [f.key]: e.target.value })}
                      placeholder={f.ph}
                      className="w-full bg-black/20 border border-bg-border/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all font-mono"
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Risk Management Card */}
            <Card className="overflow-hidden border-bg-border/40 bg-bg-secondary/30 backdrop-blur-sm">
              <div className="p-5 border-b border-bg-border/40 flex items-center gap-3 bg-white/5">
                <div className="p-2 rounded-lg bg-gold/10 border border-gold/20">
                  <Zap size={18} className="text-gold" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Risk Parameters</h3>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5">Capital Protection</p>
                </div>
              </div>
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { label: 'Max Trade Size', key: 'maxTradePercent', min: 1, max: 100, unit: '%' },
                    { label: 'Stop Loss', key: 'stopLoss', min: 0.5, max: 20, unit: '%' },
                    { label: 'Take Profit', key: 'takeProfit', min: 0.5, max: 50, unit: '%' },
                    { label: 'Max Open Trades', key: 'maxOpenTrades', min: 1, max: 20, unit: '' },
                  ].map(f => (
                    <div key={f.key} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-text-secondary text-[11px] font-medium">{f.label}</label>
                        <span className="text-gold font-mono text-xs bg-gold/10 px-2 py-0.5 rounded border border-gold/20">
                          {(risk as any)[f.key]}{f.unit}
                        </span>
                      </div>
                      <input
                        type="range" min={f.min} max={f.max} step={0.5}
                        value={(risk as any)[f.key]}
                        onChange={e => setRisk({ ...risk, [f.key]: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-bg-border rounded-lg appearance-none cursor-pointer accent-gold"
                      />
                    </div>
                  ))}
                </div>
                
                <div className="p-4 bg-gold/5 rounded-xl border border-gold/10 flex gap-3">
                  <Info size={16} className="text-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gold text-[11px] font-bold uppercase tracking-wider">Small Account Mode Active</p>
                    <p className="text-text-muted text-[11px] mt-1 leading-relaxed">
                      Optimized for accounts as small as $3. AI will use micro-position sizing and compound gains slowly to ensure survival.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: AI Behavior */}
          <div className="md:col-span-5">
            <Card className="overflow-hidden border-bg-border/40 bg-bg-secondary/30 backdrop-blur-sm sticky top-6">
              <div className="p-5 border-b border-bg-border/40 flex items-center gap-3 bg-white/5">
                <div className="p-2 rounded-lg bg-gold/10 border border-gold/20">
                  <Brain size={18} className="text-gold" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">AI Intelligence</h3>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5">Behavioral Logic</p>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {[
                  { label: 'Self-learning mode', desc: 'AI analyzes every trade to refine strategy', enabled: true },
                  { label: 'Autonomous trading', desc: 'Execute trades without manual approval', enabled: true },
                  { label: 'Learn-only mode', desc: 'Analyze market without placing real orders', enabled: false },
                  { label: 'Aggressive growth', desc: 'Prioritize higher R:R setups for growth', enabled: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between group p-2 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="max-w-[70%]">
                      <p className="text-white text-xs font-semibold">{item.label}</p>
                      <p className="text-text-muted text-[10px] mt-0.5 leading-tight">{item.desc}</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 ${item.enabled ? 'bg-gold' : 'bg-bg-border'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${item.enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-5 bg-black/20 border-t border-bg-border/40">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">System Status</span>
                  <span className="flex items-center gap-1.5 text-green-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Optimized
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
