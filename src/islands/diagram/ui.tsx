import { BookOpen, ExternalLink, Maximize, Pause, Play, RotateCcw, SkipBack, SkipForward, X, ZoomIn, ZoomOut, Repeat } from 'lucide-react';
import type { Stepper, ZoomPan } from './hooks';
import type { NodeDetails } from '../data/internal';

const base = () => (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
export const siteUrl = (p: string) => (p.startsWith('http') ? p : `${base()}${p}`);
const GH = 'https://github.com/Huy-8bit/locklens/tree/main/';

export function StepControls({ stepper, labels }: { stepper: Stepper; labels?: { play?: string } }) {
  const { step, playing, count } = stepper;
  const atEnd = step >= count - 1;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Animation controls">
      <button type="button" className="ctrl is-active !text-fg" onClick={stepper.toggle} aria-label={playing ? 'Pause' : atEnd ? 'Replay' : labels?.play ?? 'Play'}>
        {playing ? <Pause size={14} aria-hidden /> : atEnd ? <Repeat size={14} aria-hidden /> : <Play size={14} aria-hidden />}
        <span>{playing ? 'Pause' : atEnd ? 'Replay' : step < 0 ? (labels?.play ?? 'Play') : 'Resume'}</span>
      </button>
      <button type="button" className="ctrl" onClick={stepper.prev} disabled={step < 0} aria-label="Previous step">
        <SkipBack size={14} aria-hidden />
      </button>
      <button type="button" className="ctrl" onClick={stepper.next} disabled={atEnd} aria-label="Next step">
        <SkipForward size={14} aria-hidden />
      </button>
      <button type="button" className="ctrl" onClick={stepper.replay} aria-label="Replay from the start">
        <Repeat size={14} aria-hidden />
        <span className="hidden sm:inline">Replay</span>
      </button>
      <button type="button" className="ctrl" onClick={stepper.reset} disabled={step < 0 && !playing} aria-label="Reset">
        <RotateCcw size={14} aria-hidden />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}

export function ZoomControls({ zp }: { zp: ZoomPan }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Zoom">
      <button type="button" className="ctrl" onClick={zp.zoomOut} disabled={zp.scale <= 1.001} aria-label="Zoom out">
        <ZoomOut size={14} aria-hidden />
      </button>
      <span className="w-11 text-center font-mono text-[0.7rem] text-fg-subtle" aria-live="polite">
        {Math.round(zp.scale * 100)}%
      </span>
      <button type="button" className="ctrl" onClick={zp.zoomIn} disabled={zp.scale >= 3.1} aria-label="Zoom in">
        <ZoomIn size={14} aria-hidden />
      </button>
      <button type="button" className="ctrl" onClick={zp.fit} aria-label="Fit diagram">
        <Maximize size={14} aria-hidden />
        <span className="hidden sm:inline">Fit</span>
      </button>
    </div>
  );
}

export function StepTabs({ steps, stepper, overviewLabel = 'Overview' }: { steps: { id: string; title: string }[]; stepper: Stepper; overviewLabel?: string }) {
  return (
    <ol className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Steps">
      <li>
        <button type="button" onClick={() => stepper.goTo(-1)} className={`ctrl whitespace-nowrap ${stepper.step === -1 ? 'is-active' : ''}`} aria-current={stepper.step === -1 ? 'step' : undefined}>
          {overviewLabel}
        </button>
      </li>
      {steps.map((s, i) => (
        <li key={s.id}>
          <button type="button" onClick={() => stepper.goTo(i)} className={`ctrl whitespace-nowrap ${stepper.step === i ? 'is-active' : ''}`} aria-current={stepper.step === i ? 'step' : undefined}>
            <span className={`grid size-4 place-items-center rounded-full font-mono text-[0.62rem] ${stepper.step === i ? 'bg-accent text-ink-950' : i < stepper.step ? 'bg-accent/25 text-accent' : 'bg-ink-700 text-fg-subtle'}`}>{i + 1}</span>
            {s.title}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function DetailsPanel({ title, subtitle, details, onClose, illustrative }: { title: string; subtitle?: string; details: NodeDetails; onClose?: () => void; illustrative?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-accent">{details.kind}</p>
          <h3 className="mt-1 text-base font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 font-mono text-xs text-fg-subtle">{subtitle}</p>}
        </div>
        {onClose && (
          <button type="button" className="ctrl ml-auto shrink-0" onClick={onClose} aria-label="Close details">
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      {illustrative && <p className="rounded-lg border border-line bg-ink-800/60 px-3 py-2 text-xs text-fg-muted">Illustrative example — not part of LockLens.</p>}
      <p className="text-sm leading-relaxed text-fg-muted">{details.purpose}</p>
      {details.data && details.data.length > 0 && (
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Details</p>
          <ul className="mt-2 space-y-1.5 text-[0.82rem] leading-relaxed text-fg-muted">
            {details.data.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {details.source && (
        <p className="text-[0.82rem] leading-relaxed text-fg-muted">
          <span className="font-medium text-fg">Source: </span>
          {details.source}
        </p>
      )}
      {details.schedule && (
        <p className="text-[0.82rem] leading-relaxed text-fg-muted">
          <span className="font-medium text-fg">Schedule: </span>
          {details.schedule}
        </p>
      )}
      {details.note && <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[0.8rem] leading-relaxed text-amber-900/85">{details.note}</p>}
      {details.refs && details.refs.length > 0 && (
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Implementation</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {details.refs.map((r) => (
              <li key={r}>
                <a className="chip font-mono hover:text-fg" href={GH + r} target="_blank" rel="noopener noreferrer">
                  {r.replace('backend/internal/', '')}
                  <ExternalLink size={10} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {(details.docs ?? []).map((d) => (
          <a key={d.href + d.label} href={siteUrl(d.href)} className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/[0.07] px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/60">
            <BookOpen size={12} aria-hidden />
            {d.label}
          </a>
        ))}
      </div>
    </div>
  );
}
