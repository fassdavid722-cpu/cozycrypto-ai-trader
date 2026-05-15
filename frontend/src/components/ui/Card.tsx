import React from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: 'gold' | 'green' | 'red' | 'none'
  onClick?: () => void
}

export default function Card({ children, className, glow = 'none', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-bg-card border border-bg-border rounded-xl p-4',
        glow === 'gold' && 'glow-gold border-gold/20',
        glow === 'green' && 'glow-green border-green-trade/20',
        glow === 'red' && 'glow-red border-red-trade/20',
        onClick && 'cursor-pointer hover:border-white/10 transition-colors',
        className
      )}
    >
      {children}
    </div>
  )
}
