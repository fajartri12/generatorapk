import { useEffect, useRef, useState, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Delay in ms before the reveal starts (used to stagger cards). */
  delay?: number
  /** Direction the element travels from. */
  from?: 'up' | 'left' | 'right' | 'none'
  className?: string
}

/**
 * Scroll-reveal wrapper. Fades + slides content in the first time it enters the
 * viewport. Respects `prefers-reduced-motion` by rendering statically.
 *
 * Purpose (R-19): guides the eye down the page section by section instead of
 * showing everything at once, matching the declared MOTION 3 dial.
 */
export function Reveal({ children, delay = 0, from = 'up', className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Start visible when the user asked for reduced motion, so we never animate.
  const [shown, setShown] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const hidden = from === 'up' ? 'translate-y-6' : from === 'left' ? '-translate-x-6' : from === 'right' ? 'translate-x-6' : ''

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out will-change-transform ${
        shown ? 'translate-x-0 translate-y-0 opacity-100' : `${hidden} opacity-0`
      } ${className}`}
    >
      {children}
    </div>
  )
}
