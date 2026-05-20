/* global React, ReactDOM, window, INITIATIVES, INITIATIVE_ANNOTATIONS,
   TopChrome, InitiativeView, AnnotationPanel, TweaksPanel, useTweaks,
   TweakSection, TweakRadio, TweakSelect, TweakToggle */

// AnnotationPanel reads the global `annotations` — alias so it picks up our set.
window.annotations = INITIATIVE_ANNOTATIONS;

const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "fixture": "f0-active",
  "annotationBadges": true,
  "stackEmphasis": true
}/*EDITMODE-END*/;

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [annotationsOpen, setAnnotationsOpen] = useStateApp(true);
  const [hashTask, setHashTask] = useStateApp(null);

  // /initiatives/<slug>#task-T-005 → expand + scroll
  useEffectApp(() => {
    const sync = () => {
      const m = window.location.hash.match(/^#task-([A-Za-z0-9-]+)/);
      setHashTask(m ? m[1] : null);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const initiative = INITIATIVES[t.fixture] || INITIATIVES['f0-active'];

  // Strip annotation badges visibility (tweak)
  const renderInitiative = t.annotationBadges ? initiative : {
    ...initiative,
    annotations: 0,
    tasks: initiative.tasks.map(tk => ({ ...tk, annotations: 0 })),
    exitGates: initiative.exitGates.map(g => ({ ...g, annotations: 0 })),
  };

  const breadcrumb = initiative.parentPlan
    ? [
        { label: 'Plans', to: '/plans' },
        { label: initiative.parentPlan.slug, to: `/plans/${initiative.parentPlan.slug}` },
        { label: `${initiative.phaseId} ${initiative.title}`, to: `/initiatives/${initiative.slug}` },
      ]
    : [
        { label: 'Initiatives', to: '/initiatives' },
        { label: initiative.title, to: `/initiatives/${initiative.slug}` },
      ];

  // Handlers — stub navigations for the prototype
  const onJumpToTask = (taskId) => {
    window.location.hash = `task-${taskId}`;
  };
  const onJumpToBlocker = (block) => {
    if (block.crossInitiative) {
      flashToast(`would navigate → /initiatives/${block.initiative}#task-${block.taskId}`);
    } else {
      window.location.hash = `task-${block.taskId}`;
    }
  };
  const onJumpToCrossRef = (ref) => {
    flashToast(`would navigate → /initiatives/${ref.toInitiative}#task-${ref.toTaskId}`);
  };
  const onOpenAnnotation = (entityPath) => {
    setAnnotationsOpen(true);
    flashToast(`drawer filtered → ${entityPath}`);
  };

  return (
    <React.Fragment>
      <TopChrome
        route={`/initiatives/${initiative.slug}`}
        breadcrumb={breadcrumb}
        highlightsCount={INITIATIVE_ANNOTATIONS.length}
        demo={true}
        onNav={() => {}}
        onToggleHighlights={() => setAnnotationsOpen(v => !v)}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <main style={{
          flex: 1, overflowY: 'auto',
          backgroundColor: 'transparent',
        }}>
          <InitiativeView
            initiative={renderInitiative}
            hashTask={hashTask}
            onJumpToTask={onJumpToTask}
            onJumpToBlocker={onJumpToBlocker}
            onJumpToCrossRef={onJumpToCrossRef}
            onOpenAnnotation={onOpenAnnotation} />
        </main>
        <AnnotationPanel open={annotationsOpen} onClose={() => setAnnotationsOpen(false)} />
      </div>

      <TweaksPanel title="Tweaks" noDeckControls={true}>
        <TweakSection label="Fixture">
          <TweakSelect label="initiative"
            value={t.fixture}
            options={[
              { value: 'f0-active',  label: 'F0 · Foundation Repair (active)' },
              { value: 'fneg1-done', label: 'F-1 · Repo Bootstrap (done)' },
              { value: 'standalone', label: 'standalone (no parent plan)' },
              { value: 'quiet',      label: 'quiet — no body, no parked/emerged' },
            ]}
            onChange={(v) => setTweak('fixture', v)} />
        </TweakSection>

        <TweakSection label="Visual signals">
          <TweakToggle label="annotation badges inline"
            value={t.annotationBadges}
            onChange={(v) => setTweak('annotationBadges', v)} />
          <TweakToggle label="stack panel emphasis"
            value={t.stackEmphasis}
            onChange={(v) => setTweak('stackEmphasis', v)} />
        </TweakSection>

        <TweakSection label="Hash navigation">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {initiative.tasks.map(tk => (
              <button key={tk.id} onClick={() => { window.location.hash = `task-${tk.id}`; }} style={{
                all: 'unset', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: hashTask === tk.id ? 'var(--status-active)' : 'var(--fg-muted)',
                padding: '3px 7px', borderRadius: 4,
                background: hashTask === tk.id ? 'color-mix(in srgb, var(--status-active) 15%, transparent)' : 'var(--bg-elevated)',
                border: `1px solid ${hashTask === tk.id ? 'var(--status-active)' : 'var(--border-subtle)'}`,
              }}>{tk.id}</button>
            ))}
            <button onClick={() => { history.replaceState(null, '', window.location.pathname); setHashTask(null); }} style={{
              all: 'unset', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 10,
              color: 'var(--fg-subtle)', padding: '3px 7px', borderRadius: 4,
            }}>clear</button>
          </div>
        </TweakSection>
      </TweaksPanel>

      <ToastHost />
    </React.Fragment>
  );
};

// ── Toast (for stubbed navigation) ────────────────────────────────────────
let _toastSetter = null;
const flashToast = (msg) => { if (_toastSetter) _toastSetter(msg); };

const ToastHost = () => {
  const [msg, setMsg] = useStateApp(null);
  useEffectApp(() => { _toastSetter = setMsg; return () => { _toastSetter = null; }; }, []);
  useEffectApp(() => {
    if (!msg) return;
    const tid = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(tid);
  }, [msg]);
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 24,
      transform: 'translateX(-50%)',
      padding: '8px 14px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono)', fontSize: 11,
      color: 'var(--fg-default)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 200,
    }}>{msg}</div>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
