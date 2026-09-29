import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  History,
  ListTree,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  User,
  WrapText,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { Markdown, markdownHeadings } from '../../components/ui/Markdown'
import { useDocument, useProject } from '../../lib/hooks'
import { deleteDocument, updateDocument, type ApiDocumentVersion } from '../../lib/api'
import { DOC_STAGE_ORDER, docMeta, formatDateTime, generatorName, StatusPill } from '../../lib/documentMeta'

/** Human label for who produced a revision. */
const AUTHOR_LABEL: Record<string, string> = { ai: 'AI', user: 'Anda', system: 'Sistem' }

const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

/** Copy text to the clipboard, with a fallback for insecure contexts. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  }
}

function VersionItem({ version, active, onSelect }: { version: ApiDocumentVersion; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={`group flex w-full gap-3 rounded-xl border p-3 text-left transition ${
          active ? 'border-primary/40 bg-blue-50/70 shadow-sm' : 'border-transparent hover:border-border hover:bg-slate-50'
        }`}
      >
        <span
          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
            active ? 'gradient-brand text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
          }`}
        >
          v{version.version}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[13px] font-semibold ${active ? 'text-primary-dark' : 'text-foreground'}`}>
            {active ? 'Sedang dibuka' : `Versi ${version.version}`}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1">
              <User className="size-3" aria-hidden />
              {AUTHOR_LABEL[version.author] ?? version.author}
            </span>
            <span aria-hidden>·</span>
            <span>{formatDateTime(version.created_at)}</span>
          </span>
          {version.change_note && <span className="mt-1.5 block text-[11px] italic leading-4 text-slate-500">“{version.change_note}”</span>}
        </span>
      </button>
    </li>
  )
}

export function DocumentPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: document, isLoading, isError, refetch } = useDocument(id)
  const { data: project } = useProject(document?.project_id ?? NaN)

  const versions = useMemo(() => document?.versions ?? [], [document])
  const [versionId, setVersionId] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [wrap, setWrap] = useState(true)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const seeded = useRef<number | null>(null)

  const selected = useMemo(() => versions.find((version) => version.id === versionId) ?? versions[0], [versions, versionId])
  const meta = docMeta(document?.type ?? '')
  const stage = DOC_STAGE_ORDER.indexOf((document?.type ?? '') as (typeof DOC_STAGE_ORDER)[number])
  const generator = generatorName(document?.type ?? '')

  // Seed the editor once per version. Doing this during render would write
  // state on every pass; the ref keeps a refetch from clobbering unsaved edits.
  useEffect(() => {
    if (!selected || seeded.current === selected.id) return
    seeded.current = selected.id
    setContent(selected.content)
    setNote('')
  }, [selected])

  function selectVersion(version: ApiDocumentVersion) {
    setVersionId(version.id)
    seeded.current = null
  }

  const dirty = selected ? content !== selected.content : false
  const headings = useMemo(() => (mode === 'preview' ? markdownHeadings(content) : []), [mode, content])

  async function save() {
    if (!document) return
    setSaving(true)
    try {
      await updateDocument(document.id, { content, change_note: note.trim() || undefined })
      seeded.current = null
      setNote('')
      const result = await refetch()
      const latest = result.data?.versions?.at(0)
      if (latest) setVersionId(latest.id)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!document) return
    setDeleting(true)
    try {
      await deleteDocument(document.id)
      navigate(`/app/projects/${document.project_id}`)
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  function download() {
    if (!document) return
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = Object.assign(window.document.createElement('a'), { href: url, download: `${document.type}.md` })
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copy() {
    if (await copyText(content)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-[560px] animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    )
  }

  if (isError || !document) {
    return (
      <EmptyState
        title="Dokumen tidak ditemukan"
        body="Dokumen mungkin sudah dihapus, atau tautannya tidak lagi valid."
        actionLabel="Coba lagi"
        onAction={() => refetch()}
      />
    )
  }

  const chars = content.length
  const words = wordCount(content)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden p-0">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.accent}`} aria-hidden />
        <div className="p-5 pt-6">
          <Link
            to={`/app/projects/${document.project_id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {project?.name ?? 'Kembali ke proyek'}
          </Link>

          <div className="mt-4 flex flex-wrap items-start gap-4">
            <span className={`grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-bold ${meta.chip} ${meta.text}`} aria-hidden>
              {meta.initials}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{document.title}</h1>
                <StatusPill status={document.status} />
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                <span className="font-semibold text-slate-600">{meta.category}</span>
                <span aria-hidden>·</span>
                <span className="font-mono text-[12px] uppercase">{document.type}</span>
                <span aria-hidden>·</span>
                <span>versi aktif v{document.current_version}</span>
              </p>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600">{meta.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={download}>
                <Download className="size-4" aria-hidden />
                Unduh .md
              </Button>
              <Button variant="ghost" size="sm" className="text-danger hover:bg-red-50 hover:text-danger" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="size-4" aria-hidden />
                Hapus
              </Button>
            </div>
          </div>

          {/* Pipeline position and provenance */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ListTree className="size-3.5" aria-hidden />
              {stage >= 0 ? (
                <>
                  Langkah <strong className="font-semibold text-foreground">{stage + 1}</strong> dari {DOC_STAGE_ORDER.length}
                </>
              ) : (
                'Dokumen tambahan'
              )}
            </span>
            {generator && (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5" aria-hidden />
                Dibuat oleh {generator}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <History className="size-3.5" aria-hidden />
              {versions.length} versi tersimpan
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* ── Version rail ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="size-4 text-muted" aria-hidden />
              Riwayat versi
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">Setiap penyimpanan membuat versi baru. Pilih untuk membandingkan.</p>
            <ol className="mt-3 space-y-1.5">
              {versions.map((version) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  active={version.id === selected?.id}
                  onSelect={() => selectVersion(version)}
                />
              ))}
            </ol>
          </Card>

          {/* Table of contents, preview mode only. */}
          {headings.length > 0 && (
            <Card className="hidden p-4 lg:block">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListTree className="size-4 text-muted" aria-hidden />
                Daftar isi
              </h2>
              <nav className="mt-3 max-h-[320px] space-y-0.5 overflow-y-auto">
                {headings.map((heading) => (
                  <button
                    key={heading.id}
                    type="button"
                    onClick={() => window.document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="block w-full truncate rounded-md py-1 pr-2 text-left text-[12px] text-slate-600 transition hover:bg-slate-50 hover:text-primary"
                    style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                    title={heading.text}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            </Card>
          )}
        </div>

        {/* ── Editor / preview ─────────────────────────────────────────── */}
        <Card className="flex min-h-[620px] flex-col p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {([
                { key: 'preview', label: 'Pratinjau', icon: Eye },
                { key: 'edit', label: 'Edit', icon: Pencil },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  aria-pressed={mode === key}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                    mode === key ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            {mode === 'edit' && (
              <button
                type="button"
                onClick={() => setWrap((value) => !value)}
                aria-pressed={wrap}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                  wrap ? 'bg-slate-100 text-foreground' : 'text-muted hover:text-foreground'
                }`}
                title="Aktifkan atau matikan pembungkusan baris"
              >
                <WrapText className="size-3.5" aria-hidden />
                Bungkus
              </button>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              {dirty && <span className="font-medium text-warning">Belum disimpan</span>}
              <span>{words.toLocaleString('id-ID')} kata</span>
              <span aria-hidden>·</span>
              <span>{chars.toLocaleString('id-ID')} karakter</span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition hover:bg-slate-100 hover:text-foreground"
              >
                {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>

          {/* Body */}
          {mode === 'preview' ? (
            <div className="flex-1 overflow-y-auto px-6 py-5 lg:px-8">
              {content.trim() ? (
                <Markdown source={content} />
              ) : (
                <p className="py-16 text-center text-sm text-muted">Dokumen ini masih kosong. Beralih ke mode Edit untuk mengisinya.</p>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              spellCheck={false}
              className={`min-h-[420px] flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-6 text-slate-800 outline-none ${
                wrap ? 'whitespace-pre-wrap' : 'overflow-x-auto whitespace-pre'
              }`}
              aria-label="Isi dokumen dalam format Markdown"
            />
          )}

          {/* Footer: change note and save */}
          <div className="border-t border-border bg-slate-50/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="change-note" className="sr-only">
                  Catatan perubahan
                </label>
                <input
                  id="change-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Catatan perubahan (opsional) - mis. perbaiki bagian autentikasi"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <Button onClick={save} disabled={saving || (!dirty && !note.trim())}>
                <Save className="size-4" aria-hidden />
                {saving ? 'Menyimpan…' : 'Simpan sebagai versi baru'}
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
              <Clock className="size-3" aria-hidden />
              {selected ? (
                <>
                  Versi v{selected.version} · {AUTHOR_LABEL[selected.author] ?? selected.author} · {formatDateTime(selected.created_at)}
                </>
              ) : (
                'Belum ada versi tersimpan'
              )}
            </p>
          </div>
        </Card>
      </div>

      {/* Breadcrumb trail back to the project */}
      <p className="flex items-center gap-1.5 px-1 text-[12px] text-muted">
        <Link to="/app/documents" className="transition hover:text-primary">Dokumen</Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link to={`/app/projects/${document.project_id}`} className="transition hover:text-primary">
          {project?.name ?? `Proyek #${document.project_id}`}
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="truncate text-slate-500">{document.title}</span>
      </p>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} labelledBy="delete-document-title">
        <div className="p-5">
          <h2 id="delete-document-title" className="text-base font-semibold text-foreground">Hapus dokumen ini?</h2>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            <strong className="font-semibold text-slate-700">{document.title}</strong> beserta {versions.length} versinya akan dihapus permanen.
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={remove} disabled={deleting}>
              <Trash2 className="size-4" aria-hidden />
              {deleting ? 'Menghapus…' : 'Ya, hapus'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
