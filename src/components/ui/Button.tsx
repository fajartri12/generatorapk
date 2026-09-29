import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
}

const variants = {
  primary: 'gradient-brand text-white hover:opacity-90',
  secondary: 'bg-surface text-foreground border border-border hover:border-primary hover:text-primary',
  ghost: 'text-muted hover:text-foreground hover:bg-slate-100',
  danger: 'bg-danger text-white hover:opacity-90',
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: Props) {
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm'
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${sizing} ${variants[variant]} ${className}`}
    />
  )
}
