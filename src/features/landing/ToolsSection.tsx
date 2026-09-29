import { Reveal } from '../../components/ui/Reveal'
import { TOOL_CATALOG } from '../../lib/tools'
import type { ToolCategory } from '../../lib/tools'

const groups: { label: string; key: ToolCategory }[] = [
  { label: 'Product', key: 'Product' },
  { label: 'Engineering', key: 'Engineering' },
  { label: 'Design', key: 'Design' },
  { label: 'Development', key: 'Development' },
]

export function ToolsSection() {
  return (
    <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:px-6">
      <Reveal from="left">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-primary">Alur dokumen</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {TOOL_CATALOG.length} generator, empat kelompok kerja
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Sembilan di antaranya berjalan berurutan sebagai pipeline. Sisanya bisa dijalankan kapan saja begitu
            konteks proyek terisi.
          </p>
        </div>
      </Reveal>
      <div className="mt-12 space-y-12">
        {groups.map(({ label, key }, groupIndex) => {
          const items = TOOL_CATALOG.filter((t) => t.category === key)
          if (!items.length) return null
          return (
            <Reveal key={key} delay={groupIndex * 90}>
              <div>
                <h3 className="text-sm font-semibold text-slate-400">{label}</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((tool) => (
                    <div
                      key={tool.name}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-blue-900/5"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm text-primary-dark" aria-hidden>
                        {tool.icon}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">{tool.name}</h4>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{tool.description}</p>
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          {tool.documentType ? 'Tersedia di workspace' : 'Belum tersedia'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}