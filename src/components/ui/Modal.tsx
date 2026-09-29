import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  /** Set false for non-dismissible flows (e.g. a run that must finish or be cancelled). */
  dismissible?: boolean
  labelledBy?: string
  children: ReactNode
  className?: string
}

/**
 * Centered overlay dialog. Rendered in a portal so it escapes any `overflow`
 * or stacking context, traps Tab inside the panel while open, and closes on
 * Escape or backdrop click (unless `dismissible` is false).
 */
export function Modal({ open, onClose, dismissible = true, labelledBy, children, className = '' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape to close + keep Tab focus inside the panel while it is open.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the panel so screen readers and Tab land inside it.
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus], button, a[href]')?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, dismissible, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm motion-safe:animate-[md-fade_180ms_ease-out]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // max-h keeps a tall dialog (e.g. one showing a proof image) inside the
        // viewport; without it the centered grid clips the top and bottom and
        // there is no way to reach the title or the submit button.
        className={`relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface shadow-2xl motion-safe:animate-[md-pop_220ms_cubic-bezier(0.22,1,0.36,1)] ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
