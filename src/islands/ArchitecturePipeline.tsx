import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Layers,
  Network,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import {
  OVERVIEW_EDGES,
  OVERVIEW_GROUPS,
  overviewDetails,
} from "./data/overview";
import { NODES } from "./data/internal";
import { DiagramDefs, DiagramEdge, DiagramNode } from "./diagram/primitives";
import { route } from "./diagram/geometry";
import { icon } from "./diagram/icons";
import { useInView, useReducedMotion } from "./diagram/hooks";
import { DetailsPanel } from "./diagram/ui";
const DeepDive = lazy(() => import("./InternalArchitecture"));
const nodeById = new Map(NODES.map((n) => [n.id, n]));
const groupById = new Map(OVERVIEW_GROUPS.map((g) => [g.id, g]));

export default function ArchitecturePipeline() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [depth, setDepth] = useState<"overview" | "deep">("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, "0px");
  const reduced = useReducedMotion();
  const connected = new Set(
    OVERVIEW_EDGES.filter(
      (e) => e.from === selected || e.to === selected,
    ).flatMap((e) => [e.from, e.to]),
  );
  const sel = OVERVIEW_GROUPS.find((g) => g.id === selected);
  return (
    <div className="pipeline-explorer" ref={ref}>
      <div className="pipeline-levels">
        <div role="group" aria-label="Architecture detail level">
          <button
            type="button"
            disabled={!ready}
            aria-pressed={depth === "overview"}
            onClick={() => setDepth("overview")}
          >
            <Layers size={15} aria-hidden />
            Overview
          </button>
          <button
            type="button"
            disabled={!ready}
            aria-pressed={depth === "deep"}
            onClick={() => setDepth("deep")}
          >
            <Network size={15} aria-hidden />
            Deep Dive
          </button>
        </div>
        <p>
          {depth === "overview"
            ? "Six responsibilities. One connected system."
            : "Collectors, processing, storage, access, and delivery in detail."}
        </p>
      </div>
      {depth === "deep" ? (
        <Suspense
          fallback={
            <p className="pipeline-loading" role="status">
              Loading the component explorer…
            </p>
          }
        >
          <DeepDive />
        </Suspense>
      ) : (
        <div className="pipeline-overview surface-dark">
          <div className="pipeline-canvas-header">
            <span>LOCKLENS / SYSTEM OVERVIEW</span>
            <div>
              {!reduced && (
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={
                    playing ? "Pause overview flow" : "Play overview flow"
                  }
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
                  {playing ? "Pause" : "Play flow"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setSelected(null);
                }}
                aria-label="Reset overview"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <div className="pipeline-overview-layout">
            <svg
              viewBox="0 0 1000 420"
              className="diagram-svg pipeline-overview-svg"
              role="group"
              aria-label="Simplified architecture from the detailed component model"
            >
              <DiagramDefs id="overview" />
              <text x="24" y="30" fill="#879fbd" fontSize="9" letterSpacing="1">
                OBSERVE
              </text>
              <text
                x="526"
                y="30"
                fill="#879fbd"
                fontSize="9"
                letterSpacing="1"
              >
                UNDERSTAND & DELIVER
              </text>
              <text
                x="275"
                y="250"
                fill="#879fbd"
                fontSize="9"
                letterSpacing="1"
              >
                PRESERVE & EXPLORE
              </text>
              {OVERVIEW_EDGES.map((e) => {
                const active =
                  !selected || e.from === selected || e.to === selected;
                return (
                  <DiagramEdge
                    key={e.id}
                    defsId="overview"
                    route={route(
                      groupById.get(e.from)!.rect,
                      groupById.get(e.to)!.rect,
                    )}
                    kind={e.kind}
                    state={active ? "active" : "dim"}
                    animate={playing && inView && !reduced}
                    speed={4}
                    particles={1}
                  />
                );
              })}
              {OVERVIEW_GROUPS.map((g) => (
                <DiagramNode
                  key={g.id}
                  id={g.id}
                  defsId="overview"
                  rect={g.rect}
                  title={g.title}
                  subtitle={g.subtitle}
                  icon={icon(g.icon)}
                  compact
                  tone="cyan"
                  selected={selected === g.id}
                  state={
                    selected && !connected.has(g.id) && selected !== g.id
                      ? "dim"
                      : "normal"
                  }
                  onSelect={(id) => setSelected((s) => (s === id ? null : id))}
                />
              ))}
            </svg>
            <div
              className="pipeline-overview-mobile"
              aria-label="Architecture components"
            >
              {OVERVIEW_GROUPS.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  aria-pressed={selected === g.id}
                  onClick={() => setSelected((s) => (s === g.id ? null : g.id))}
                >
                  <strong>{g.title}</strong>
                  <small>{g.subtitle}</small>
                  <ArrowUpRight size={15} aria-hidden />
                </button>
              ))}
            </div>
            {sel && (
              <aside
                className="pipeline-selection"
                aria-label={`${sel.title} overview details`}
              >
                <DetailsPanel
                  title={sel.title}
                  details={overviewDetails(sel.id)}
                  onClose={() => setSelected(null)}
                />
                <p className="pipeline-member-label">Included components</p>
                <ul>
                  {sel.members
                    .map((id) => nodeById.get(id))
                    .filter(Boolean)
                    .map((n) => (
                      <li key={n!.id}>{n!.title}</li>
                    ))}
                </ul>
                <button
                  type="button"
                  className="pipeline-deeper"
                  onClick={() => setDepth("deep")}
                >
                  Explore in Deep Dive <ArrowUpRight size={14} />
                </button>
              </aside>
            )}
          </div>
          <p className="pipeline-footnote">
            Select a component to follow its connections. This overview groups
            the same components and relationships used in Deep Dive.
          </p>
        </div>
      )}
    </div>
  );
}
