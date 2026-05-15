import React, { useState } from 'react'
import { Eye, EyeOff, Save, Shield, Zap, Brain } from 'lucide-react'
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
    <div className="h-full overflow-y-auto space-y-4 max-w-2xl">
      <h2 className="text-white font-semibold text-lg">Settings</h2>

      {/* API Keys */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-gold" />
          <p className="text-white text-sm font-semibold">API Keys</p>
          <button onClick={() => setShow(!show)} className="ml-auto p-1 hover:text-gold text-text-muted transition-colors">
            {show ? <EyeOff size={14}/> : <Eye size={14}/>}
          </button>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Bitget API Key', key: 'bitgetKey', ph: 'bg_xxxxxxxxxxxx' },
            { label: 'Bitget Secret Key', key: 'bitgetSecret', ph: 'sk_xxxxxxxxxxxx' },
            { label: 'Bitget Passphrase', key: 'bitgetPassphrase', ph: 'your passphrase' },
            { label: 'Groq API Key (AI)', key: 'groqKey', ph: 'gsk_xxxxxxxxxxxx' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-text-secondary text-xs mb-1 block">{f.label}</label>
              <input
                type={show ? 'text' : 'password'}
                value={(keys as any)[f.key]}
                onChange={e => setKeys({ ...keys, [f.key]: e.target.value })}
                placeholder={f.ph}
                className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-gold/50 font-mono"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Risk Management */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-gold" />
          <p className="text-white text-sm font-semibold">Risk Management</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Max Trade Size (%)', key: 'maxTradePercent', min: 1, max: 100 },
            { label: 'Stop Loss (%)', key: 'stopLoss', min: 0.5, max: 20 },
            { label: 'Take Profit (%)', key: 'takeProfit', min: 0.5, max: 50 },
            { label: 'Max Open Trades', key: 'maxOpenTrades', min: 1, max: 20 },
          ].map(f => (
            <div key={f.key}>
              <label className="text-text-secondary text-xs mb-1 block">{f.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={f.min} max={f.max} step={0.5}
                  value={(risk as any)[f.key]}
                  onChange={e => setRisk({ ...risk, [f.key]: parseFloat(e.target.value) })}
                  className="flex-1 accent-gold"
                />
                <span className="text-gold font-mono text-sm w-10 text-right">{(risk as any)[f.key]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-gold/5 rounded-lg border border-gold/20">
          <p className="text-gold text-xs font-medium">⚠️ Small Account Mode Active</p>
          <p className="text-text-muted text-xs mt-1">Optimized for accounts as small as $3. AI will use micro-position sizing and compound gains slowly.</p>
        </div>
      </Card>

      {/* AI Behavior */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Brain size={16} className="text-gold" />
          <p className="text-white text-sm font-semibold">AI Behavior</p>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Self-learning mode', desc: 'AI learns from every trade and improves strategies', enabled: true },
            { label: 'Autonomous trading', desc: 'AI executes trades without confirmation', enabled: true },
            { label: 'Learn-only mode (no balance)', desc: 'When no balance, AI learns algorithm instead of trading', enabled: true },
            { label: 'Aggressive growth mode', desc: 'Maximize returns on small accounts', enabled: true },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <div className={`w-9 h-5 rounded-full border relative cursor-pointer transition-colors ${item.enabled ? 'bg-gold border-gold' : 'bg-bg-border border-bg-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <div>
                <p className="text-white text-xs font-medium">{item.label}</p>
                <p className="text-text-muted text-[10px]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <button onClick={save}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${saved ? 'bg-green-trade text-black' : 'bg-gold text-black hover:bg-gold-dim'}`}>
        <Save size={14} className="inline mr-2" />
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
