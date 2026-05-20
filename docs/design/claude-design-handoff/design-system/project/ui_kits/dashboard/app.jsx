/* global React, ReactDOM, window, plan, highlights,
   TopChrome, DemoBanner, PlanView, InitiativeView, HelpView, AnnotationPanel,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "textureCanvas": "grid",
  "textureActive": true,
  "textureDrift": true,
  "groupCompleted": true
}/*EDITMODE-END*/;

const App = () => {
  const [route, setRoute] = useStateApp({ name: 'plan', slug: plan.slug });
  const [panelOpen, setPanelOpen] = useStateApp(false);
  const [demo] = useStateApp(true);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply canvas texture class to body so it survives main's own bg
  useEffectApp(() => {
    document.body.classList.remove('has-texture-canvas', 'has-texture-grain', 'has-texture-scanlines');
    if (t.textureCanvas === 'grid')      document.body.classList.add('has-texture-canvas');
    if (t.textureCanvas === 'grain')     document.body.classList.add('has-texture-grain');
    if (t.textureCanvas === 'scanlines') document.body.classList.add('has-texture-scanlines');
  }, [t.textureCanvas]);

  const breadcrumb = (() => {
    if (route.name === 'plan')        return [{ label: `/${route.slug}`, to: `/plans/${route.slug}` }];
    if (route.name === 'initiative')  return [
      { label: `/${plan.slug}`, to: `/plans/${plan.slug}` },
      { label: route.phaseId,  to: `/plans/${plan.slug}` },
      { label: route.slug,     to: `/initiatives/${route.slug}` },
    ];
    if (route.name === 'help')        return [{ label: '/help', to: '/help' }];
    return [];
  })();

  const onNav = (to) => {
    if (to === '/')           setRoute({ name: 'plan', slug: plan.slug });
    else if (to === '/help')  setRoute({ name: 'help' });
    else if (to.startsWith('/plans/'))       setRoute({ name: 'plan', slug: to.replace('/plans/', '') });
    else if (to.startsWith('/initiatives/')) setRoute({ name: 'initiative', slug: to.replace('/initiatives/', ''), phaseId: 'F0' });
  };

  const openInitiative = (slug) => {
    if (!slug) return;
    setRoute({ name: 'initiative', slug, phaseId: 'F0' });
  };

  const highlightsCount = highlights.length;

  return (
    <React.Fragment>
      <DemoBanner visible={demo} />
      <TopChrome
        route={route}
        breadcrumb={breadcrumb}
        highlightsCount={highlightsCount}
        onNav={onNav}
        onToggleHighlights={() => setPanelOpen(o => !o)}
        onToggleHelp={() => onNav('/help')}
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-canvas)' }}>
          {route.name === 'plan'       && <PlanView onOpenInitiative={openInitiative} textures={t} />}
          {route.name === 'initiative' && <InitiativeView slug={route.slug} onBack={() => setRoute({ name: 'plan', slug: plan.slug })} textures={t} />}
          {route.name === 'help'       && <HelpView />}
        </main>
        <AnnotationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Textures" subtitle="Interaction signals woven into the brand">
          <TweakRadio label="Canvas texture"
            value={t.textureCanvas}
            options={[
              { value: 'none',      label: 'None' },
              { value: 'grid',      label: 'Grid (default)' },
              { value: 'grain',     label: 'Grain' },
              { value: 'scanlines', label: 'Scanlines' },
            ]}
            onChange={(v) => setTweak('textureCanvas', v)} />
          <TweakToggle label="Active scanlines"
            description="Slow vertical scan on the HERE phase card"
            value={t.textureActive}
            onChange={(v) => setTweak('textureActive', v)} />
          <TweakToggle label="Drift diagonal pulse"
            description="Diagonal warning stripes on critical highlights"
            value={t.textureDrift}
            onChange={(v) => setTweak('textureDrift', v)} />
        </TweakSection>
        <TweakSection title="Completed phases" subtitle="How done phases appear in the plan view">
          <TweakToggle label="Group into accordion"
            description="When on, all done phases collapse into a single completed band at the top. Off shows them inline at 62% opacity, in chronological position."
            value={t.groupCompleted}
            onChange={(v) => setTweak('groupCompleted', v)} />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
