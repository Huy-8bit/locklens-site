import { useState } from "react";
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
export default function SignalComparison() {
  const [connected, setConnected] = useState(false);
  return (
    <div className={`signal-comparison ${connected ? "is-connected" : ""}`}>
      <div className="comparison-toolbar">
        <div
          className="pill-switch"
          role="group"
          aria-label="Compare investigation workflows"
        >
          <button
            type="button"
            aria-pressed={!connected}
            onClick={() => setConnected(false)}
          >
            Without LockLens
          </button>
          <button
            type="button"
            aria-pressed={connected}
            onClick={() => setConnected(true)}
          >
            With LockLens
          </button>
        </div>
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
