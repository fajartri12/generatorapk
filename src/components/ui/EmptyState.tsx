type Props = {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-3 text-sm font-medium text-primary hover:text-primary-dark">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
