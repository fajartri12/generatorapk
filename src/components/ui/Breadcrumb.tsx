import { Link, useLocation } from 'react-router-dom'

type Crumb = { label: string; to?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {item.to && item.to !== pathname ? (
              <Link to={item.to} className="hover:text-foreground">{item.label}</Link>
            ) : (
              <span className={i === items.length - 1 ? 'font-medium text-foreground' : ''} aria-current={i === items.length - 1 ? 'page' : undefined}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
