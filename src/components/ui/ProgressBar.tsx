type Props = {
  value: number
  label?: string
  /** Bar height. `lg` is for hero/summary surfaces, `sm` for dense rows. */
  size?: 'sm' | 'md' | 'lg'
  /** Hide the trailing percentage when the surrounding UI already states it. */
  showValue?: boolean
  /** Green once the bar reaches 100%, so "finished" reads at a glance. */
  tone?: 'brand' | 'auto'
  className?: string
}

const SIZES = { sm: 'h-1', md: 'h-1.5', lg: 'h-2.5' } as const

export function ProgressBar({ value, label, size = 'md', showValue = true, tone = 'brand', className = '' }: Props) {
  const safe = Math.min(100, Math.max(0, Math.round(value)))
  const complete = safe >= 100 && tone === 'auto'
  const fill = complete ? 'bg-emerald-500' : 'gradient-brand'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`relative flex-1 overflow-hidden rounded-full bg-slate-100 ${SIZES[size]}`}
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Project completion'}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${fill}`}
          style={{ width: `${safe}%` }}
        />
      </div>
      {showValue && <span className="w-9 shrink-0 text-right text-xs font-semibold text-muted tabular-nums">{safe}%</span>}
    </div>
  )
}
