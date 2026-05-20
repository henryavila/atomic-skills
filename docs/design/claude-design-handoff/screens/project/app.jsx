/* global React, ReactDOM, window,
   TopChrome, DemoBanner, HelpView,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "demoBanner": true,
  "canvasTexture": "grid",
  "simulateEmpty": false
}/*EDITMODE-END*/;

const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffectApp(() => {
    document.body.classList.remove('has-texture-canvas', 'has-texture-grain', 'has-texture-scanlines');
    if (t.canvasTexture === 'grid')      document.body.classList.add('has-texture-canvas');
    if (t.canvasTexture === 'grain')     document.body.classList.add('has-texture-grain');
    if (t.canvasTexture === 'scanlines') document.body.classList.add('has-texture-scanlines');
  }, [t.canvasTexture]);

  return (
    <React.Fragment>
      <DemoBanner visible={t.demoBanner} />
      <TopChrome
        route={{ name: 'help' }}
        breadcrumb={[{ label: '/help', to: '/help' }]}
        highlightsCount={4}
        onNav={() => {}}
        onToggleHighlights={() => {}}
        onToggleHelp={() => {}}
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <main style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}>
          <HelpView
            density={t.density}
            simulateEmpty={t.simulateEmpty}
          />
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Layout" subtitle="Density of the directory">
          <TweakRadio label="Density"
            value={t.density}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'dense',       label: 'Dense' },
            ]}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>
        <TweakSection title="Canvas" subtitle="Background texture behind the page">
          <TweakRadio label="Texture"
            value={t.canvasTexture}
            options={[
              { value: 'none',  label: 'None' },
              { value: 'grid',  label: 'Grid' },
              { value: 'grain', label: 'Grain' },
            ]}
            onChange={(v) => setTweak('canvasTexture', v)} />
        </TweakSection>
        <TweakSection title="Edge cases" subtitle="Preview the empty + demo states">
          <TweakToggle label="Demo banner"
            description="The amber DEMO MODE strip at the top of the app."
            value={t.demoBanner}
            onChange={(v) => setTweak('demoBanner', v)} />
          <TweakToggle label="Simulate zero skills"
            description="Pretend ~/.claude/skills/ is empty to preview the empty state."
            value={t.simulateEmpty}
            onChange={(v) => setTweak('simulateEmpty', v)} />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
