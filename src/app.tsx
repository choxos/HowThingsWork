import {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {SceneHandle} from './scene/mechanism-scene.tsx';
import {applySeo, trackPageView} from './seo.ts';
import {controls, readings, startingExtras} from './studio-controls.ts';
import {useTheme} from './theme.ts';
import {
  defaultLegend,
  laterParts,
  parts as studyParts,
  topicById,
  topicsInPart,
  topics,
  upcoming,
  type Topic,
} from './topics.ts';
import Vignette from './vignettes.tsx';
import {explorations} from './content/explorations.ts';

/** Three.js is the bulk of the bundle, so the gallery never pays for it. */
const MechanismScene = lazy(() => import('./scene/mechanism-scene.tsx'));

/** Hash routing, because two routes do not justify a router. */
function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const update = () => setRoute(read());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const topic = topicById(route.replace(/^topic\//, ''));
  // The first view is already counted by the config call in index.html, so only
  // a route that has actually changed is worth an event. Comparing against the
  // previous route also keeps the development double mount from counting twice.
  const counted = useRef(route);
  useEffect(() => {
    applySeo(topic);
    if (counted.current !== route) {
      counted.current = route;
      trackPageView();
    }
  }, [route, topic]);
  return topic ? <Studio key={topic.id} topic={topic} /> : <Gallery />;
}

function Gallery() {
  return (
    <main className="gallery">
      <header className="gallery-head">
        <div>
          <p className="eyebrow">
            {studyParts.length === 1
              ? `Part ${studyParts[0].number} · ${studyParts[0].name}`
              : `${topics.length} studies across ${studyParts.length} subject areas`}
          </p>
          <h1 tabIndex={-1}>How things work</h1>
          <p className="lede">
            How can a small push lift something heavy? Why does a boat float? Pick a study, move a slider,
            and watch what changes. No physics lessons needed to start.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {studyParts.map(part => (
        <section className="part" key={part.number} aria-label={part.name}>
          {studyParts.length > 1 && (
            <header className="part-head">
              <h2>
                <span>Part {part.number}</span> {part.name}
              </h2>
              <p>{part.strapline}</p>
            </header>
          )}
          <div className="topic-grid">
            {topicsInPart(part.number).map(topic => (
              <a className="topic-card" key={topic.id} href={`#/topic/${topic.id}`}>
                <Vignette topic={topic.id} />
                <div className="topic-body">
                  <span className="topic-number">{String(topic.index).padStart(2, '0')}</span>
                  <h2>{topic.name}</h2>
                  <p className="topic-tagline">{topic.tagline}</p>
                  <p className="topic-summary">{topic.blurb}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}

      {upcoming.length > 0 && (
        <section className="topic-grid" aria-label="Still to come">
          <section className="queue">
            <h2>Still to come</h2>
            <ul>
              {upcoming.map(item => (
                <li key={item.name}>{item.name}</li>
              ))}
            </ul>
            {laterParts.length > 0 && (
              <p className="queue-foot">
                More topics to explore: {laterParts.join(', ').toLowerCase()}.
              </p>
            )}
          </section>
        </section>
      )}

      <footer className="gallery-foot">
        <p>
          Explore the principles behind everyday machines through interactive studies and explanations.
        </p>
      </footer>
    </main>
  );
}

function ThemeToggle({compact = false}: {compact?: boolean}) {
  const [theme, toggle] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className={compact ? '' : 'theme-toggle'}
      onClick={toggle}
      title={`Switch to the ${next} theme`}
      aria-label={`Switch to the ${next} theme`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      {!compact && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  );
}

function Studio({topic}: {topic: Topic}) {
  const [theme] = useTheme();
  const legend = topic.legend === 'none' ? defaultLegend : {...defaultLegend, ...topic.legend};
  const spec = controls[topic.id];
  const exploration = explorations[topic.id];
  const [value, setValue] = useState(spec.initial);
  const [variant, setVariant] = useState(spec.variants?.initial ?? '');
  const [extras, setExtras] = useState<Record<string, number>>(() => startingExtras(spec));
  const [selected, setSelected] = useState(topic.parts[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const [compactReady, setCompactReady] = useState(false);
  const [partsOpen, setPartsOpen] = useState(true);
  const [about, setAbout] = useState(false);
  const [compact, setCompact] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [labels, setLabels] = useState(true);
  const [isolated, setIsolated] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const scene = useRef<SceneHandle | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const detailPanel = useRef<HTMLElement>(null);
  const aboutHeading = useRef<HTMLHeadingElement>(null);
  const aboutTrigger = useRef<HTMLButtonElement | null>(null);
  const partsToggle = useRef<HTMLButtonElement>(null);

  const openAbout = (event: React.MouseEvent<HTMLButtonElement>) => {
    aboutTrigger.current = event.currentTarget;
    setAbout(true);
    if (compact) {
      setPartsOpen(false);
      setDetailOpen(false);
    }
  };
  const closeAbout = () => {
    setAbout(false);
    aboutTrigger.current?.focus();
  };

  useEffect(() => {
    if (about) aboutHeading.current?.focus();
  }, [about]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.fullscreenElement) return;
      if (about) {
        setAbout(false);
        aboutTrigger.current?.focus();
      } else if (detailOpen || partsOpen) {
        setDetailOpen(false);
        setPartsOpen(false);
        partsToggle.current?.focus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [about, detailOpen, partsOpen]);

  useEffect(() => {
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
    const query = window.matchMedia('(max-width: 760px), (max-height: 520px)');
    const update = () => {
      setCompact(query.matches);
      setPartsOpen(!query.matches);
      setLabels(!query.matches);
      setDetailOpen(previous => (query.matches ? false : previous));
      setCompactReady(true);
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // The dock grows with its contents, so the stage and panels are told how tall it really is.
  useEffect(() => {
    const node = dock.current;
    const shell = root.current;
    if (!node || !shell) return;
    // offsetHeight includes padding and border, which the layout below depends on.
    const measure = () => {
      const height = node.offsetHeight;
      if (height > 0) shell.style.setProperty('--dock-height', `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const part = topic.parts.find(p => p.id === selected) ?? topic.parts[0];
  const values = useMemo(() => readings(topic.id, value, variant, extras), [topic.id, value, variant, extras]);

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setDetailOpen(true);
      if (compact) {
        setPartsOpen(false);
        setAbout(false);
      }
      requestAnimationFrame(() => {
        detailPanel.current?.scrollTo({top: 0});
        if (compact) heading.current?.focus();
      });
    },
    [compact],
  );

  return (
    <div className="studio" ref={root}>
      <section className="stage" aria-label={`Interactive study of ${topic.name}`}>
        <Suspense fallback={<p className="scene-loading">Preparing the model</p>}>
        <MechanismScene
          ref={scene}
          topic={topic.id}
          theme={theme}
          parts={topic.parts}
          value={value}
          extras={extras}
          variant={variant}
          playing={playing}
          autoRotate={autoRotate}
          labels={labels}
          isolated={isolated}
          selected={selected}
          onSelect={select}
        />
        </Suspense>
      </section>

      <p className="sr-only" aria-live="polite">
        {topic.name}. {spec.variants ? `${spec.variants.label}: ${spec.variants.options.find(o => o.id === variant)?.label}. ` : ''}
        {spec.label(variant)} {spec.format(value, variant)}.{' '}
        {values.map(reading => `${reading.label}: ${reading.value}`).join('. ')}.
      </p>

      <p className="explore-hint">Drag to look around. Choose a part to explore.</p>
      <div className="plaque">
        <a href="#/" aria-label="Back to all studies">
          <Icon name="back" /> All machines
        </a>
        <h1 tabIndex={-1}>{topic.name}</h1>
        <p>{topic.tagline}</p>
      </div>

      <div className="rail-left">
      {compactReady && partsOpen && (
        <aside className="panel parts-panel" aria-label="Parts">
          <div className="panel-head">
            <h2>Parts</h2>
            <button className="icon" onClick={() => { setPartsOpen(false); partsToggle.current?.focus(); }} aria-label="Hide parts">
              <Icon name="close" />
            </button>
          </div>
          <div className="parts-list">
            {topic.parts.map((item, index) => (
              <button
                key={item.id}
                className={`part-row${item.id === selected && detailOpen ? ' selected' : ''}`}
                aria-pressed={item.id === selected && detailOpen}
                onClick={() => select(item.id)}
              >
                <span className="part-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="part-name">{item.name}</span>
                <Icon name="chevron" />
              </button>
            ))}
          </div>
        </aside>
      )}

      {detailOpen && (
        <aside ref={detailPanel} className="panel detail-panel" aria-label="Part details">
          <div className="panel-head">
            <span>{part.role}</span>
            <button className="icon" onClick={() => { setDetailOpen(false); partsToggle.current?.focus(); }} aria-label="Close details">
              <Icon name="close" />
            </button>
          </div>
          <div className="detail" aria-live="polite">
            <h2 ref={heading} tabIndex={-1}>
              {part.name}
            </h2>
            <p className="detail-copy">{part.description}</p>
            <h3>While it runs</h3>
            <p className="detail-copy">{part.principle}</p>
            <button
              className={`isolate${isolated ? ' is-active' : ''}`}
              onClick={() => setIsolated(!isolated)}
              aria-pressed={isolated}
            >
              <Icon name={isolated ? 'layers' : 'crosshair'} /> {isolated ? 'Show everything' : 'Isolate this part'}
            </button>
            {topic.legend !== 'none' && (
              <p className="legend">
                {legend.effort ? (
                  <>
                    <span className="swatch effort" /> {legend.effort}
                  </>
                ) : null}
                {legend.delivered ? (
                  <>
                    <span className="swatch delivered" /> {legend.delivered}
                  </>
                ) : null}
                <em>{legend.note ?? defaultLegend.note}</em>
              </p>
            )}
          </div>
        </aside>
      )}
      </div>

      <nav className="tools panel" aria-label="View controls">
        <button
          ref={partsToggle}
          className={partsOpen ? 'active' : ''}
          onClick={() => {
            setPartsOpen(!partsOpen);
            if (compact) {
              setDetailOpen(false);
              setAbout(false);
            }
          }}
          aria-pressed={partsOpen}
          title="Parts"
          aria-label="Toggle parts"
        >
          <Icon name="layers" /><span className="tool-name">Parts</span>
        </button>
        <span />
        <button onClick={() => scene.current?.zoom(0.85)} title="Zoom in" aria-label="Zoom in">
          <Icon name="plus" />
        </button>
        <button onClick={() => scene.current?.zoom(1.18)} title="Zoom out" aria-label="Zoom out">
          <Icon name="minus" />
        </button>
        <button
          onClick={() => {
            setAutoRotate(false);
            scene.current?.reset();
          }}
          title="Reset view"
          aria-label="Reset view"
        >
          <Icon name="reset" />
        </button>
        <button
          className={autoRotate ? 'active' : ''}
          onClick={() => setAutoRotate(!autoRotate)}
          aria-pressed={autoRotate}
          title="Auto rotate"
          aria-label="Toggle auto rotation"
        >
          <Icon name="orbit" />
        </button>
        <span />
        {canFullscreen && (
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else root.current?.requestFullscreen?.();
            }}
            title="Fullscreen"
            aria-label="Toggle fullscreen"
          >
            <Icon name="expand" />
          </button>
        )}
        <ThemeToggle compact />
        <button
          className={labels ? 'active' : ''}
          onClick={() => setLabels(!labels)}
          aria-pressed={labels}
          title="Part labels"
          aria-label="Toggle part labels"
        >
          <Icon name="tag" />
        </button>
        <span />
        <button
          onClick={event => about ? closeAbout() : openAbout(event)}
          aria-expanded={about}
          title="About this study"
          aria-label="About this study"
        >
          <Icon name="help" />
        </button>
      </nav>

      <div className="dock panel" ref={dock} aria-label="Mechanism controls">
        <div className="study-prompt">
          <p><strong>Try this</strong> {exploration.tryIt}</p>
          <button onClick={openAbout} aria-expanded={about}>Learn why <Icon name="help" /></button>
        </div>
        <button
          className={`play${playing ? ' active' : ''}`}
          onClick={() => setPlaying(!playing)}
          aria-pressed={playing}
          aria-label={playing ? 'Pause the motion' : 'Play the motion'}
        >
          <Icon name={playing ? 'pause' : 'play'} />
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>

        <div className="dock-controls">
          {spec.variants && (
            <div className="variant-block">
              <div className="variant" role="group" aria-label={spec.variants.label}>
                {spec.variants.options.map(option => (
                  <button
                    key={option.id}
                    className={option.id === variant ? 'active' : ''}
                    aria-pressed={option.id === variant}
                    onClick={() => {
                      setVariant(option.id);
                      setIsolated(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="variant-hint">{spec.variants.options.find(o => o.id === variant)?.hint}</p>
            </div>
          )}
          <div className="slider">
            <div className="slider-caption">
              <label htmlFor="mechanism-value">{spec.label(variant)}</label>
              <output htmlFor="mechanism-value">{spec.format(value, variant)}</output>
            </div>
            <input
              id="mechanism-value"
              type="range"
              min={spec.min}
              max={spec.max}
              step={spec.step}
              value={value}
              aria-valuetext={spec.format(value, variant)}
              onChange={e => setValue(e.currentTarget.valueAsNumber)}
            />
          </div>
          {(spec.extras ?? []).map(extra => (
            <div className="slider" key={extra.id}>
              <div className="slider-caption">
                <label htmlFor={`mechanism-${extra.id}`}>{extra.label(variant)}</label>
                <output htmlFor={`mechanism-${extra.id}`}>{extra.format(extras[extra.id], variant)}</output>
              </div>
              <input
                id={`mechanism-${extra.id}`}
                type="range"
                min={extra.min}
                max={extra.max}
                step={extra.step}
                value={extras[extra.id]}
                aria-valuetext={extra.format(extras[extra.id], variant)}
                onChange={e => {
                  // Read the slider before handing React an updater. The updater
                  // runs after the event has been returned to the pool, and by
                  // then currentTarget is null and reading it throws through the
                  // render, which unmounts the whole studio.
                  const moved = e.currentTarget.valueAsNumber;
                  setExtras(current => ({...current, [extra.id]: moved}));
                }}
              />
            </div>
          ))}
        </div>

        <dl className="readings">
          {values.map(reading => (
            <div key={reading.label}>
              <dt>
                {reading.label}
                {reading.hint && <em>{reading.hint}</em>}
              </dt>
              <dd>{reading.value}</dd>
            </div>
          ))}
        </dl>

      </div>

      {about && (
        <aside className="panel about-panel" aria-label="About this study">
          <div className="panel-head">
            <h2 ref={aboutHeading} tabIndex={-1}>Discover {topic.name.toLowerCase()}</h2>
            <button className="icon" onClick={closeAbout} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="about">
            <p className="big-idea">{exploration.idea}</p>
            <h3>Try it</h3>
            <p>{exploration.tryIt}</p>
            <h3>What to notice</h3>
            <p>{exploration.notice}</p>
            {spec.variants && <><h3>Current choice</h3><p>{spec.variants.options.find(option => option.id === variant)?.hint}</p></>}
            <h3>About this model</h3>
            <p>{exploration.model}</p>
            <details className="learn-more">
              <summary>How to explore</summary>
              <p>Drag the model to look around. Scroll, pinch, or use + and − to zoom. Choose a part in the picture or the Parts list. Pause to look closely.</p>
              <p>With a keyboard, Tab to a control. Use arrow keys on the slider. In the 3D view, arrow keys turn the view, + and − zoom, and Home resets it. Escape closes an open panel.</p>
            </details>
            <details className="learn-more">
              <summary>The science, step by step</summary>
              <p>{topic.summary}</p>
              <p>{topic.principle}</p>
            <dl className="facts">
              {topic.facts.map(([label, detail]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
            <h3>What the numbers mean</h3>
            <ul className="applications">
              {values.filter(reading => reading.hint).map(reading => (
                <li key={reading.label}>
                  <strong>{reading.label}</strong>
                  <span>{reading.hint}</span>
                </li>
              ))}
            </ul>
            <h3>The same idea elsewhere</h3>
            <ul className="applications">
              {topic.applications.map(item => (
                <li key={item.name}>
                  <strong>{item.name}</strong>
                  <span>{item.note}</span>
                </li>
              ))}
            </ul>
            </details>
            <details className="learn-more">
              <summary>What do the numbers and units mean?</summary>
              <dl className="word-help">
                <dt>Force · N and kN</dt><dd>A push or pull, measured in newtons (N). One kilonewton (kN) is 1,000 N.</dd>
                <dt>Work and energy · J</dt><dd>Energy can cause change. One joule (J) of work is a force of 1 N acting through 1 meter in its direction.</dd>
                <dt>Turning force · torque</dt><dd>How strongly a force turns something. Pushing farther from a pivot can make a stronger turn.</dd>
                <dt>Mass and density · kg and kg/m³</dt><dd>Mass is measured in kilograms. Density tells you how much mass fits in a given space.</dd>
                <dt>Distance · mm and µm</dt><dd>1,000 millimeters make a meter. 1,000 micrometers (µm) make a millimeter.</dd>
                <dt>Frequency · Hz</dt><dd>How many cycles happen each second. 1 kHz is 1,000 Hz; 1 MHz is a million; 1 GHz is a billion.</dd>
                <dt>Temperature · K</dt><dd>Kelvin starts at absolute zero. A rise of 1 K is the same size as a rise of 1 °C. Water freezes near 273 K.</dd>
                <dt>Pressure · bar</dt><dd>Force spread over an area. One bar is close to the pressure of the air around us at sea level.</dd>
                <dt>Multiples · × and %</dt><dd>2× means twice as much. 50% means half. A coefficient is a number used to describe a relationship.</dd>
                <dt>Large amounts of energy · GWh</dt><dd>One gigawatt-hour is a billion watt-hours. It measures energy, not power.</dd>
              </dl>
            </details>
            <p className="credit">
              Geometry here illustrates the principle; it does not specify a real machine.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

const paths: Record<string, string> = {
  back: 'M11 5 4 12l7 7M4 12h16',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 5 7 7-7 7',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 16l9 5 9-5M3 12l9 5 9-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  reset: 'M4 5v5h5M4.5 10a8 8 0 1 1 .8 6',
  orbit: 'M12 4a8 8 0 1 1-8 8M3.6 9.5c1.7-3 9.3-4.6 14.3-2.4M8 3.4c3.3-.6 8.6 4 9.8 8.6',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  tag: 'M7.5 7.5h.01M3 3h8l10 10-8 8L3 11V3Z',
  help: 'M12 17h.01M9.2 9a2.9 2.9 0 1 1 3.8 2.8c-.6.2-1 .8-1 1.5v.4M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z',
  crosshair: 'M12 3v4m0 10v4M3 12h4m10 0h4M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  sun: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  pause: 'M9 5v14M15 5v14',
};

function Icon({name}: {name: keyof typeof paths | string}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
