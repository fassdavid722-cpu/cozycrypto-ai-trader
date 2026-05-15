import React from 'react'

interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export default function Logo({ size = 36, showText = true, className = '' }: LogoProps) {
  const s = size
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* CozyCrypto Logo: C with candlestick in center */}
      <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer circle bg */}
        <circle cx="18" cy="18" r="17" fill="#16161E" stroke="#F4C542" strokeWidth="1.5"/>
        {/* Bold C letter */}
        <path
          d="M24 10.5C22 8.5 19.5 7.5 17 7.5C11.2 7.5 6.5 12.2 6.5 18C6.5 23.8 11.2 28.5 17 28.5C19.5 28.5 22 27.5 24 25.5"
          stroke="#F4C542" strokeWidth="2.5" strokeLinecap="round" fill="none"
        />
        {/* Candlestick 1 - bullish (green) */}
        <line x1="19" y1="10" x2="19" y2="26" stroke="#00D4A1" strokeWidth="1" strokeDasharray="1 1"/>
        <rect x="17" y="13" width="4" height="7" rx="0.5" fill="#00D4A1"/>
        {/* Candlestick 2 - bearish (red) */}
        <line x1="24" y1="12" x2="24" y2="25" stroke="#FF4757" strokeWidth="1" strokeDasharray="1 1"/>
        <rect x="22" y="15" width="4" height="6" rx="0.5" fill="#FF4757"/>
        {/* Wicks */}
        <line x1="19" y1="10" x2="19" y2="13" stroke="#00D4A1" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="19" y1="20" x2="19" y2="26" stroke="#00D4A1" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="12" x2="24" y2="15" stroke="#FF4757" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="21" x2="24" y2="25" stroke="#FF4757" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-white font-bold text-sm tracking-wide">CozyCrypto</span>
          <span className="text-text-secondary text-[9px] tracking-widest uppercase">AI Trader</span>
        </div>
      )}
    </div>
  )
}
