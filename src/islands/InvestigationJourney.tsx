import { useEffect, useRef, useState } from 'react';
import InvestigationExperience from './InvestigationExperience';
import { useReducedMotion } from './diagram/hooks';

const chapters = [
  { title: 'Everything looks fine.', label: 'Observe', text: 'Requests are flowing and statements are short. One reprice job has held a transaction open for 38 s — nobody needs its rows yet.', scene: 0 },
  { title: 'Checkout starts to wait.', label: 'Correlate', text: 'Checkout requests queue behind the job’s row locks, and inventory-svc queues behind them. Every waiter leads back to PID 4127.', scene: 2 },
  { title: 'The rule fires.', label: 'Investigate', text: 'The chain outlasted the threshold, so incident #42 opens: the root session, its query and every waiting session, together.', scene: 4 },
  { title: 'Fixed. Still on record.', label: 'Preserve', text: 'The chain clears, but the snapshots, sessions and timeline stay — so the post-mortem starts from facts, not memory.', scene: 5 },
];

export default function InvestigationJourney() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [chapter, setChapter] = useState(0);
  const [following, setFollowing] = useState(true);
  const [guidedScene, setGuidedScene] = useState<number | undefined>(0);
  const [revision, setRevision] = useState(0);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = matchMedia('(min-width: 1200px) and (min-height: 800px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!root.current || !wide || !following || reduced) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting);
      if (!visible.length) return;
      const index = Number((visible[0].target as HTMLElement).dataset.chapter);
      setChapter(index);
      setGuidedScene(chapters[index].scene);
    }, { rootMargin: '-35% 0px -45% 0px', threshold: 0 });
    root.current.querySelectorAll('[data-chapter]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [wide, following, reduced]);
  const choose = (index: number) => {
    setFollowing(false);
    setChapter(index);
    setGuidedScene(chapters[index].scene);
    setRevision(value => value + 1);
  };
  return <div ref={root} className="investigation-journey" data-chapter-active={chapter} data-guided={wide && following && !reduced}>
    <div className="journey-controls">
      <span>ONE INCIDENT. FOUR PERSPECTIVES.</span>
      {wide && !reduced && <button type="button" aria-pressed={following} onClick={() => setFollowing(value => !value)}>{following ? 'Pause scroll story' : 'Follow scroll story'} <span aria-hidden>{following ? 'Ⅱ' : '↓'}</span></button>}
    </div>
    <div className="journey-layout">
      <div className="journey-chapters" aria-label="Investigation chapters">
        {chapters.map((item, i) => <article key={item.label} data-chapter={i} className={i === chapter ? 'is-current' : ''}>
          <button type="button" onClick={() => choose(i)} aria-pressed={chapter === i}><span>0{i + 1}</span>{item.label}</button>
          <h3>{item.title}</h3><p>{item.text}</p>
        </article>)}
      </div>
      <div className="journey-workspace">
        <div className="journey-mobile-tabs" role="group" aria-label="Story chapters">
          {chapters.map((item, i) => <button key={item.label} type="button" aria-pressed={chapter === i} onClick={() => choose(i)}><span>0{i + 1}</span>{item.label}</button>)}
        </div>
        <p className="journey-mobile-copy">{chapters[chapter].text}</p>
        <div onPointerDownCapture={() => setFollowing(false)} onKeyDownCapture={() => setFollowing(false)}>
          <InvestigationExperience guidedScene={guidedScene} guidedRevision={revision} />
        </div>
        <div className="journey-progress" aria-hidden="true">{chapters.map((item, i) => <span key={item.label} className={i <= chapter ? 'is-complete' : ''} />)}</div>
      </div>
    </div>
  </div>;
}
