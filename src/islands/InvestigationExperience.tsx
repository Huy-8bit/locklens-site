import { useEffect, useId, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  Database,
  FileCheck,
  Activity,
} from "lucide-react";
import { SCENES, SAMPLES } from "./data/incident";
import { useInView, useReducedMotion } from "./diagram/hooks";

const titles = [
  "Activity",
  "First wait",
  "Blocking chain",
  "Detection",
  "Investigation",
  "Recovery",
];
const positions: Record<number, { x: number; y: number }> = {
  4127: { x: 28, y: 38 },
  4133: { x: 250, y: 38 },
  4139: { x: 472, y: 38 },
  4142: { x: 250, y: 150 },
};
const pids = Object.keys(positions).map(Number);
const chartPath = SAMPLES.map(
  (s, i) =>
    `${i ? "L" : "M"}${((s.t / SAMPLES.at(-1)!.t) * 620).toFixed(1)},${(82 - s.blocked * 22).toFixed(1)}`,
).join(" ");

export default function InvestigationExperience({ guidedScene, guidedRevision }: { guidedScene?: number; guidedRevision?: number } = {}) {
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, "0px");
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const uid = useId().replace(/:/g, "");
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    if (!playing || !inView || !pageVisible || reduced) return;
    if (step === SCENES.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((s) => s + 1), 4400);
    return () => clearTimeout(timer);
  }, [playing, step, inView, pageVisible, reduced]);
  useEffect(() => {
    if (guidedScene === undefined) return;
    setPlaying(false);
    setStep(guidedScene);
  }, [guidedScene, guidedRevision]);
  const scene = SCENES[step];
  const sample = SAMPLES[scene.sampleIndex];
  const selected = scene.sessions.filter((s) => pids.includes(s.pid));
  const next = () => {
    setPlaying(false);
    setStep((s) => Math.min(SCENES.length - 1, s + 1));
  };
  return (
    <div ref={root} className="investigation-experience" data-scene={step}>
      <div className="experience-topbar">
        <span>
          <Database size={15} aria-hidden /> orders-db <i>/</i> Investigation
          workspace
        </span>
        <span className="simulation-label">
          SIMULATION · NO LIVE CONNECTION
        </span>
      </div>
      <div className="experience-layout">
        <div className="experience-main">
          <div className="experience-metrics">
            <div>
              <span>Blocked sessions</span>
              <strong>
                {sample.blocked.toString().padStart(2, "0")}
                <small>sessions</small>
              </strong>
            </div>
            <div>
              <span>Longest lock wait</span>
              <strong>
                {sample.maxWait}
                <small>seconds</small>
              </strong>
            </div>
            <div>
              <span>Observation</span>
              <strong className="experience-time">{scene.time}</strong>
            </div>
          </div>
          <div className="experience-chart">
            <div className="micro-label">
              <Activity size={12} aria-hidden /> BLOCKED SESSIONS / SAMPLED
              ACTIVITY
            </div>
            <svg
              viewBox="0 0 620 110"
              role="img"
              aria-label={`${sample.blocked} blocked sessions at ${scene.time}`}
            >
              <defs>
                <clipPath id={`${uid}-reveal`}>
                  <rect
                    width="620"
                    height="110"
                    style={{
                      transform: `scaleX(${sample.t / SAMPLES.at(-1)!.t})`,
                      transformOrigin: "0 0",
                      transition: reduced
                        ? "none"
                        : "transform 900ms cubic-bezier(.22,1,.36,1)",
                    }}
                  />
                </clipPath>
                <linearGradient id={`${uid}-area`} x2="0" y2="1">
                  <stop stopColor="#00c8f8" stopOpacity=".25" />
                  <stop offset="1" stopColor="#00c8f8" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[16, 38, 60, 82].map((y) => (
                <path
                  key={y}
                  d={`M0 ${y}H620`}
                  stroke="#25334a"
                  strokeDasharray="3 6"
                />
              ))}
              <g clipPath={`url(#${uid}-reveal)`}>
                <path
                  d={`${chartPath}L620 100H0Z`}
                  fill={`url(#${uid}-area)`}
                />
                <path
                  d={chartPath}
                  fill="none"
                  stroke="#00c8f8"
                  strokeWidth="2"
                />
              </g>
              <text x="0" y="106">
                14:01:20
              </text>
              <text x="620" y="106" textAnchor="end">
                14:04:04
              </text>
            </svg>
          </div>
          <div className="experience-graph">
            <div className="micro-label">
              BLOCKER → WAITER · REPORTED BY POSTGRESQL
            </div>
            <svg
              viewBox="0 0 680 235"
              role="img"
              aria-label={
                step >= 2 && step < 5
                  ? "Root blocker 4127 blocks 4133 and 4142; 4133 blocks 4139"
                  : step === 1
                    ? "4127 blocks 4133"
                    : "No blocking relationships in this observation"
              }
            >
              <defs>
                <marker
                  id={`${uid}-arrow`}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M0 0L8 4L0 8Z" fill="#f1b46a" />
                </marker>
              </defs>
              {[
                { from: 4127, to: 4133 },
                { from: 4133, to: 4139 },
                { from: 4127, to: 4142 },
              ].map(({ from, to }) => {
                const a = positions[from],
                  b = positions[to],
                  on = selected.some(
                    (s) => s.pid === to && s.blockedBy === from,
                  );
                return (
                  <path
                    key={to}
                    className="experience-edge"
                    d={`M${a.x + 176} ${a.y + 31}C${a.x + 205} ${a.y + 31},${b.x - 30} ${b.y + 31},${b.x - 5} ${b.y + 31}`}
                    fill="none"
                    stroke="#f1b46a"
                    strokeWidth="1.5"
                    markerEnd={`url(#${uid}-arrow)`}
                    pathLength="1"
                    style={{
                      strokeDasharray: 1,
                      strokeDashoffset: on ? 0 : 1,
                      opacity: on ? 1 : 0,
                      transition: reduced
                        ? "none"
                        : "stroke-dashoffset 700ms ease, opacity 350ms",
                    }}
                  />
                );
              })}
              {selected.map((s) => {
                const p = positions[s.pid],
                  rootBlocker = s.pid === 4127 && sample.blocked > 0;
                return (
                  <g
                    key={s.pid}
                    style={{ transform: `translate(${p.x}px, ${p.y + (step === 0 ? (s.pid % 2 ? 18 : -16) : 0)}px)`, transition: reduced ? "none" : "transform 900ms cubic-bezier(.22,1,.36,1)" }}
                    className={rootBlocker ? "experience-root" : ""}
                  >
                    <rect
                      width="176"
                      height="64"
                      rx="8"
                      fill="#101c2f"
                      stroke={
                        rootBlocker
                          ? "#f1b46a"
                          : s.state === "waiting"
                            ? "#69513a"
                            : "#2b3b55"
                      }
                    />
                    <circle
                      cx="15"
                      cy="20"
                      r="3"
                      fill={
                        rootBlocker
                          ? "#f1b46a"
                          : s.state === "waiting"
                            ? "#efab71"
                            : "#49c9b5"
                      }
                    />
                    <text x="27" y="24" className="node-title">
                      PID {s.pid}
                    </text>
                    <text x="14" y="45">
                      {rootBlocker ? "Root blocker" : s.app}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="experience-mobile-graph">
            <strong>
              {sample.blocked
                ? "Root blocker · PID 4127"
                : "No blocking detected"}
            </strong>
            {selected
              .filter((s) => s.blockedBy)
              .map((s) => (
                <p key={s.pid}>
                  PID {s.blockedBy} <span>→</span> PID {s.pid}{" "}
                  <small>{s.detail}</small>
                </p>
              ))}
          </div>
        </div>
        <aside
          className="experience-evidence"
          aria-label="Investigation evidence"
        >
          <div className="micro-label">
            <FileCheck size={14} aria-hidden /> EVIDENCE
          </div>
          <div
            className={`evidence-status ${scene.incident ? "recorded" : ""}`}
          >
            <span />
            {scene.incident
              ? `Incident #42 · ${scene.incident.state}`
              : "Observing activity"}
          </div>
          <h3>{scene.title}</h3>
          <p>{scene.narration}</p>
          <div className="evidence-query">
            <span>ROOT SESSION / REPRICE-JOB</span>
            <code>
              UPDATE inventory
              <br />
              SET price = price * $1
              <br />
              WHERE category = $2
            </code>
          </div>
          <div
            className="evidence-preserved"
            style={{ opacity: scene.incident ? 1 : 0.35 }}
          >
            <FileCheck size={18} aria-hidden />
            <span>
              {scene.incident
                ? "Snapshots, sessions and timeline preserved."
                : "Evidence is captured when a rule triggers."}
            </span>
          </div>
        </aside>
      </div>
      <div className="experience-controls">
        <div
          className="scene-buttons"
          role="group"
          aria-label="Investigation scenes"
        >
          {titles.map((title, i) => (
            <button
              type="button"
              key={title}
              aria-pressed={i === step}
              onClick={() => {
                setPlaying(false);
                setStep(i);
              }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {title}
            </button>
          ))}
        </div>
        <div className="scene-playback">
          {!reduced && (
            <button
              type="button"
              onClick={() => {
                if (step === 5) setStep(0);
                setPlaying((p) => !p);
              }}
              aria-label={
                playing ? "Pause investigation" : "Play investigation"
              }
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
          )}
          <button
            type="button"
            aria-label="Next investigation scene"
            onClick={next}
            disabled={step === 5}
          >
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            aria-label="Reset investigation"
            onClick={() => {
              setPlaying(false);
              setStep(0);
            }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
      <p className="scene-announcement" aria-live="polite">
        Scene {step + 1} of {SCENES.length} · {titles[step]} · {scene.time}
      </p>
    </div>
  );
}
