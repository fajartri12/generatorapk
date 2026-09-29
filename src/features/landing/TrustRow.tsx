import { Reveal } from '../../components/ui/Reveal'

const stack = ['Laravel', 'React', 'Next.js', 'Tailwind CSS', 'PostgreSQL', 'Figma', 'Node.js', 'MySQL']

/**
 * Marquee band. The scroll implies "this list keeps going", which is the point:
 * the generators are stack-agnostic, so a fixed short row would underclaim.
 * Duplicated list + 50% translate is the standard seamless-marquee technique.
 */
export function TrustRow() {
  const loop = [...stack, ...stack]

  return (
    <Reveal from="none">
      <section className="border-y border-border bg-surface py-8">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <p className="text-center text-sm text-muted">
            Generator mengikuti stack yang Anda tulis di konteks proyek. Tidak ada stack yang dipaksakan.
          </p>
        </div>
        <div className="group relative mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <ul className="flex w-max animate-marquee items-center gap-12 group-hover:[animation-play-state:paused]">
            {loop.map((name, i) => (
              <li
                key={`${name}-${i}`}
                aria-hidden={i >= stack.length}
                className="text-lg font-semibold text-slate-300 transition hover:text-primary"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Reveal>
  )
}