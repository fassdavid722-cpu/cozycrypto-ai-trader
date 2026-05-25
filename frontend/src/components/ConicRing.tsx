interface ConicRingProps {
  score: number
  label: string
  size?: number
}

export default function ConicRing({ score, label, size = 120 }: ConicRingProps) {
  const gradientDeg = (score / 100) * 360

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="conic-ring"
        style={{ width: size, height: size }}
      >
        <div
          className="conic-fill"
          style={{
            background: `conic-gradient(from 180deg, rgba(34,197,94,0.8) 0deg, rgba(34,197,94,0.6) ${gradientDeg * 0.5}deg, rgba(23,23,23,0.2) ${gradientDeg}deg, rgba(23,23,23,1) 360deg)`,
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-[#fafafa] font-mono-data">{score}/100</span>
          <span className="text-[10px] text-[#22c55e] font-medium">{label}</span>
        </div>
      </div>
    </div>
  )
}
