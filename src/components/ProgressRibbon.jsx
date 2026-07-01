export default function ProgressRibbon({ label, progress }) {
  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)))
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-baseline justify-between text-xs uppercase tracking-[0.2em] text-mist">
        <span>{label}</span>
        <span className="tabular-nums text-gold-bright">{percent}%</span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
