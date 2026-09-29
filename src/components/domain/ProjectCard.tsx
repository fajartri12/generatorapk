import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Project } from '../../lib/types'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[13px] font-semibold text-white shadow-sm" style={{ background: project.color }} aria-hidden>
          {project.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground">
            <Link to={`/app/projects/${project.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">{project.name}</Link>
          </h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted">{project.description || 'Belum ada deskripsi proyek.'}</p>
        </div>
      </div>

      <div className="mt-4 flex min-h-6 flex-wrap gap-1.5">
        {project.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
      </div>

      <div className="mt-4"><ProgressBar value={project.progress} label={`${project.name} completion`} /></div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{project.documents} dokumen · Diperbarui {project.updated}</span>
        <ArrowRight size={14} aria-hidden className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </article>
  )
}
