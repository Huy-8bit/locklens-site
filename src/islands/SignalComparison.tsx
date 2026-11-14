import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Database,
  GitBranch,
  Search,
  Archive,
  ArrowUpRight,
} from "lucide-react";
import { siteUrl } from "./diagram/ui";

const signals = [
  {
    title: "Database activity",
    value: "Lock waits rising",
    context: "Same target. Same time window.",
    Icon: Activity,
  },
  {
    title: "Sessions & queries",
    value: "UPDATE inventory …",
    context: "Statement linked to the session.",
    Icon: Database,
  },
  {
    title: "Blocking relationships",
    value: "4127 → 4133 → 4139",
    context: "Root blocker and waiting sessions.",
    Icon: GitBranch,
  },
  {
    title: "Incident context",
    value: "A timeline to reconstruct",
    context: "Snapshots and timeline preserved.",
    Icon: Archive,
  },
];
/** Autoplay timing (ms): first switch after the block comes into view, then how long each state holds. */
const FIRST_SWITCH = 1200;
const HOLD_CONNECTED = 6000;
const HOLD_SCATTERED = 3200;

export default function SignalComparison() {
  const [connected, setConnected] = useState(false);
  // Plays on its own until the reader picks a state; then the buttons are in control.
  const [autoplay, setAutoplay] = useState(true);
  const [cycle, setCycle] = useState<{ key: number; ms: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  useEffect(() => {
    const el = rootRef.current;
    if (!autoplay || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: number | undefined;
    let visible = false;
    let key = 0;
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      setCycle({ key: ++key, ms });
      timer = window.setTimeout(() => {
        if (!visible) return;
        if (document.documentElement.classList.contains("motion-paused")) {
          schedule(1000);
          return;
        }
        const next = !connectedRef.current;
        setConnected(next);
        if (reduce) {
          setCycle(null);
          return;
        }
        schedule(next ? HOLD_CONNECTED : HOLD_SCATTERED);
      }, ms);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        window.clearTimeout(timer);
        if (visible && !(reduce && connectedRef.current)) schedule(connectedRef.current ? HOLD_CONNECTED : FIRST_SWITCH);
        else setCycle(null);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [autoplay]);

  const choose = (value: boolean) => {
    setAutoplay(false);
    setCycle(null);
    setConnected(value);
  };

  return (
    <div ref={rootRef} className={`signal-comparison ${connected ? "is-connected" : ""}`} data-autoplay={autoplay}>
      <div className="comparison-toolbar">
        <div
          className="pill-switch"
          role="group"
          aria-label="Compare investigation workflows"
        >
          <button
            type="button"
            aria-pressed={!connected}
            onClick={() => choose(false)}
          >
            Without LockLens
          </button>
          <button
            type="button"
            aria-pressed={connected}
            onClick={() => choose(true)}
          >
            With LockLens
          </button>
        </div>
        {cycle && (
          <span
            key={cycle.key}
            className="comparison-timer"
            style={{ animationDuration: `${cycle.ms}ms` }}
            aria-hidden="true"
          />
        )}
        <span className="micro-label">ILLUSTRATIVE WORKFLOW</span>
      </div>
      <div
        className="comparison-stage"
        aria-label={
          connected
            ? "Connected investigation context"
            : "Separate database observations"
        }
      >
        <svg
          className="comparison-wires"
          viewBox="0 0 1000 410"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M250 115H370Q400 115 400 155V205H600V155Q600 115 630 115H750 M250 305H370Q400 305 400 265V205 M600 205V265Q600 305 630 305H750" />
        </svg>
        <div className="comparison-hub">
          <Search size={25} aria-hidden />
          <strong>LockLens</strong>
          <span>One investigation</span>
        </div>
        {signals.map(({ title, value, context, Icon }, i) => (
          <div key={title} className={`signal-fragment fragment-${i}`}>
            <div>
              <Icon size={18} aria-hidden />
              <span>{title}</span>
            </div>
            <strong>
              {i === 3 && connected ? "Evidence captured" : value}
            </strong>
            <p>
              {connected
                ? context
                : [
                    "A metric without its context.",
                    "A query to investigate manually.",
                    "Relationships to piece together.",
                    "Evidence scattered across tools.",
                  ][i]}
            </p>
          </div>
        ))}
      </div>
      <div className="comparison-summary" aria-live="polite">
        <p>
          {connected
            ? "The same signals. A connected investigation."
            : "The signals exist. The connections take work."}
        </p>
        <a href={siteUrl("/docs/features/incidents/")}>
          Follow the evidence <ArrowUpRight size={16} aria-hidden />
        </a>
      </div>
    </div>
  );
}
