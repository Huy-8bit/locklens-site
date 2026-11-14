# LockLens website design

The supplied UI concepts guide the current visual direction: a light editorial hero, cobalt accents, oversized black typography and an original spatial PostgreSQL illustration. Dark product and architecture sections provide deliberate contrast. Navigation, documentation and deployment workbenches use quiet light surfaces. Inter and JetBrains Mono remain locally bundled. No animation library was added.

## Shared foundations

- `src/styles/global.css`: semantic colors, light/dark surface scopes, typography, radius and motion tokens, controls and focus states.
- `src/styles/landing.css`: hero, signal comparison, investigation workspace, editorial product sections and screenshot showcase.
- `src/styles/architecture.css`: architecture navigation, topology workbench and pipeline overview.
- `src/styles/docs.css`: reading measure, sidebar, tables, syntax blocks and responsive navigation. Search and Markdown generation remain intact.

`SignalSculpture.astro` contains the original SVG illustration: translucent planes, a database volume, and signal categories. It is labelled conceptual and does not replace the actual topology model. Its entrance is staged and its signal motion is finite and pausable.

Motion uses the shared soft easing, short control transitions and longer scene transitions. SVG/CSS handles visual changes; React manages meaningful state. Decorative animation is finite or pausable. Intersection observers and document visibility suspend expensive animation. Reduced motion retains static diagrams and manual investigation steps.

## Product evidence

`InvestigationExperience` reuses `data/incident.ts`, including the sessions, rules, timestamps and sampled blocking values used by the existing architecture simulation. Session nodes persist while relationships, charts and evidence change. This is explicitly a simulation; no live database, latency benchmark or automatic remediation is implied. The screenshot showcase uses the existing repository screenshots.

`data/overview.ts` projects the detailed architecture model into six responsibilities. Every detailed node belongs to a group, and every displayed cross-group relationship retains its underlying edge IDs. Tests verify this mapping. Deep Dive loads on demand and retains the existing component explorer. Production topology retains all four deployment scenarios, flow filters, cluster focus, lease takeover, zoom and node details. Small screens use selectable component lists rather than scaled desktop canvases.

## Verification

```sh
npm run check
npm run lint
npm run build
npm run test:links
npm run test:e2e

BASE_PATH=/locklens-site/ SITE_URL=https://huy-8bit.github.io npm run build
BASE_PATH=/locklens-site/ npm run test:links
BASE_PATH=/locklens-site/ npx playwright test tests/base-path.spec.ts --project=desktop
```

Build again without `BASE_PATH` before running the regular suite. The prefixed smoke test checks navigation, lazy Deep Dive loading, Pagefind results and failed local requests. The regular suite covers docs, copy, search, tables, diagrams, keyboard controls, reduced motion, 375px mobile, 768px tablet and 1024px laptop layouts. The CPU-throttled test checks that investigation playback suspends offscreen and resumes correctly.

The original vector sculpture and generated social image are rendered and inspected. Native browser preview currently fails with `noWindowsAvailable`, so the latest concept pass cannot receive a complete manual browser screenshot review. Automated architecture and responsive checks run independently. Mobile and CPU-throttling checks are emulations, not physical-device or 60 FPS certification.
