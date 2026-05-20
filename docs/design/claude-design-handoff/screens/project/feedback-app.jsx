/* global React, ReactDOM, window, FEEDBACK_ITEMS, ENTITY_TITLES,
   TopChrome, FeedbackHost, FeedbackDrawer,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, TweakSelect,
   TweakButton, Btn, Kbd */

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp, useMemo: useMemoApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "drawerOpen": true,
  "badgeVariant": "standard",
  "density": "cozy",
  "groupBy": "target",
  "showResolved": false,
  "hideOrphans": false,
  "showGallery": true,
  "liveStream": true,
  "bulkVolume": false
}/*EDITMODE-END*/;

// ── Filler items to demonstrate the "showing 100 of N" cap ────────────────
const buildFillerItems = () => {
  const out = [];
  const targets = ['tasks.T-001', 'tasks.T-002', 'tasks.T-003', 'tasks.T-004', 'tasks.T-005', 'tasks.T-006',
                   'exitGates.F0-G1', 'exitGates.F0-G2', 'exitGates.F0-G3'];
  const sevs = ['info', 'info', 'info', 'warn', 'info'];
  for (let i = 0; i < 110; i++) {
    const isHi = i % 3 === 0;
    out.push(isHi ? {
      kind: 'highlight', id: `bulk-h-${i}`,
      target: { slug: 'v3-f0-foundation-repair', path: targets[i % targets.length] },
      author: i % 2 ? 'ai' : 'human',
      severity: sevs[i % sevs.length],
      createdAt: `${i + 1}m ago`, createdAtSort: -(i + 1),
      reason: `Bulk-injected highlight #${i + 1} — synthetic demo content for the cap footer.`,
      acknowledged: false,
    } : {
      kind: 'annotation', id: `bulk-a-${i}`,
      target: { slug: 'v3-f0-foundation-repair', path: targets[i % targets.length] },
      author: i % 2 ? 'ai' : 'human',
      createdAt: `${i + 1}m ago`, createdAtSort: -(i + 1),
      body: `Bulk-injected annotation #${i + 1}. Synthetic note to push the drawer past 100 items.`,
      resolved: false, replies: [],
    });
  }
  return out;
};

// ── App ──────────────────────────────────────────────────────────────────
const App = () => {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [drawerOpen, setDrawerOpen] = useStateApp(t.drawerOpen);
  const [targetFilter, setTargetFilter] = useStateApp(null);
  const [items, setItems] = useStateApp(FEEDBACK_ITEMS);
  const [lastFreshId, setLastFreshId] = useStateApp(null);
  const liveSimRef = useRefApp(null);

  // Sync the persisted drawer-open tweak to local UI state (so the toggle in
  // the panel works without a reload) — but only on transition.
  const prevOpenRef = useRefApp(t.drawerOpen);
  useEffectApp(() => {
    if (prevOpenRef.current !== t.drawerOpen) {
      setDrawerOpen(t.drawerOpen);
      prevOpenRef.current = t.drawerOpen;
    }
  }, [t.drawerOpen]);

  const openDrawer = (next = true) => {
    setDrawerOpen(next);
    setTweak('drawerOpen', next);
  };
  const toggleDrawer = () => openDrawer(!drawerOpen);

  // Keyboard shortcut: Cmd/Ctrl + \ toggles the drawer (matches devtools idiom).
  useEffectApp(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleDrawer();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [drawerOpen]);

  // Optional bulk-volume mode for the cap-footer demo.
  const effectiveItems = useMemoApp(() => {
    if (t.bulkVolume) return [...items, ...buildFillerItems()];
    return items;
  }, [items, t.bulkVolume]);

  // Inline-badge open handler — opens drawer + filters to the clicked target.
  const onOpenForTarget = (path) => {
    if (!path) return;
    // Mock paths from the gallery are non-routable — show a toast and no filter.
    if (path.startsWith('mock.')) {
      flashToast(`(gallery preview · "${path}" is not a real target)`);
      openDrawer(true);
      return;
    }
    setTargetFilter(path);
    openDrawer(true);
    const label = (ENTITY_TITLES[path] || {}).label || path;
    flashToast(`drawer → ${label}`);
  };

  // ── Live SSE simulator ─────────────────────────────────────────────────
  // The spec calls for: "SSE-driven updates land in under 200ms from server
  // emit to DOM paint. Test by posting via curl with the drawer open."
  // We approximate this by injecting synthetic items at random intervals
  // when the live stream is on. The first 600ms of an item's lifetime gets
  // a fresh-highlight background.
  useEffectApp(() => {
    if (!t.liveStream) {
      if (liveSimRef.current) clearTimeout(liveSimRef.current);
      return;
    }
    const tick = () => {
      injectFromAgent();
      liveSimRef.current = setTimeout(tick, 9000 + Math.random() * 6000);
    };
    liveSimRef.current = setTimeout(tick, 5500);
    return () => { if (liveSimRef.current) clearTimeout(liveSimRef.current); };
  }, [t.liveStream]);

  // Pool of plausible AI-emitted items
  const aiSamples = [
    { kind: 'highlight', target: 'tasks.T-003', severity: 'warn',
      reason: 'zod 3.23 deprecated `.refine` second-arg signature — current code uses the old form. Tests pass but will warn at runtime.',
      author: 'ai' },
    { kind: 'annotation', target: 'tasks.T-006', body: 'Schema validator should reject empty strings on `slug` — current behavior silently accepts and downstream fails in fuzzy match.', author: 'ai' },
    { kind: 'highlight', target: 'exitGates.F0-G1', severity: 'info',
      reason: 'Lockfile pinning looks clean. Logged for the audit trail.', author: 'ai' },
    { kind: 'highlight', target: 'self', severity: 'critical',
      reason: 'Drift detected: agent wrote to src/server/* during F0 — out of scope. Either widen scope explicitly or rebase.',
      author: 'ai' },
    { kind: 'annotation', target: 'tasks.T-002', body: 'Confirmed: Brazilian-Portuguese name `Conceição` round-trips correctly now. Closing on my side.', author: 'ai' },
  ];

  const injectFromAgent = () => {
    const s = aiSamples[Math.floor(Math.random() * aiSamples.length)];
    const id = `live-${Date.now()}`;
    const baseTarget = { slug: 'v3-f0-foundation-repair', path: s.target };
    const item = s.kind === 'highlight' ? {
      kind: 'highlight', id, target: baseTarget,
      author: s.author, severity: s.severity,
      createdAt: 'just now', createdAtSort: 0,
      reason: s.reason, acknowledged: false,
    } : {
      kind: 'annotation', id, target: baseTarget,
      author: s.author,
      createdAt: 'just now', createdAtSort: 0,
      body: s.body, resolved: false, replies: [],
    };
    setItems(prev => [item, ...prev]);
    setLastFreshId(id);
    // Don't auto-open drawer — spec: drawer must not steal focus unless explicitly opened.
    setTimeout(() => setLastFreshId(null), 1400);
  };

  const breadcrumb = [
    { label: 'Plans',         to: '/plans' },
    { label: 'v3-redesign',   to: '/plans/v3-redesign' },
    { label: 'F0 Foundation Repair', to: '/initiatives/v3-f0-foundation-repair' },
  ];

  // Total unresolved/unacknowledged count for the chrome counter.
  const openCount = effectiveItems.filter(it =>
    !((it.kind === 'annotation' && it.resolved) || (it.kind === 'highlight' && it.acknowledged))
  ).length;

  return (
    <React.Fragment>
      <TopChrome
        route="/feedback"
        breadcrumb={breadcrumb}
        highlightsCount={openCount}
        demo={true}
        onNav={() => {}}
        onToggleHighlights={() => { setTargetFilter(null); toggleDrawer(); }}
        onToggleHelp={() => {}}
      />

      {/* Demo strip explaining what the screen is */}
      <DemoStrip
        onSimulate={injectFromAgent}
        liveStream={t.liveStream}
        onToggleLive={() => setTweak('liveStream', !t.liveStream)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <main style={{
          flex: 1, overflowY: 'auto',
          backgroundColor: 'transparent',
        }}>
          <FeedbackHost
            items={effectiveItems}
            badgeVariant={t.badgeVariant}
            onOpen={onOpenForTarget}
            showGallery={t.showGallery}
          />
        </main>

        <FeedbackDrawer
          open={drawerOpen}
          onClose={() => openDrawer(false)}
          items={effectiveItems}
          targetFilter={targetFilter}
          onClearTargetFilter={() => setTargetFilter(null)}
          liveStream={t.liveStream}
          onToggleLive={() => setTweak('liveStream', !t.liveStream)}
          lastFreshId={lastFreshId}
          groupBy={t.groupBy}
          badgeVariant={t.badgeVariant}
          density={t.density}
          showResolved={t.showResolved}
          hideOrphans={t.hideOrphans}
        />
      </div>

      <TweaksPanel title="Tweaks" noDeckControls={true}>
        <TweakSection label="Drawer">
          <TweakToggle label="open"
            value={drawerOpen}
            onChange={(v) => openDrawer(v)} />
          <TweakSelect label="group items by"
            value={t.groupBy}
            options={[
              { value: 'target', label: 'target (default)' },
              { value: 'time',   label: 'time — newest first' },
            ]}
            onChange={(v) => setTweak('groupBy', v)} />
          <TweakRadio label="density"
            value={t.density}
            options={['cozy', 'dense']}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>

        <TweakSection label="Inline badges">
          <TweakSelect label="variant"
            value={t.badgeVariant}
            options={[
              { value: 'whisper',  label: 'whisper — dot + count' },
              { value: 'standard', label: 'standard — ⚑ + count (default)' },
              { value: 'loud',     label: 'loud — count + reason preview' },
            ]}
            onChange={(v) => setTweak('badgeVariant', v)} />
          <TweakToggle label="show variant gallery"
            value={t.showGallery}
            onChange={(v) => setTweak('showGallery', v)} />
        </TweakSection>

        <TweakSection label="Filters & edge cases">
          <TweakToggle label="show resolved / acknowledged"
            value={t.showResolved}
            onChange={(v) => setTweak('showResolved', v)} />
          <TweakToggle label="hide orphan targets"
            value={t.hideOrphans}
            onChange={(v) => setTweak('hideOrphans', v)} />
          <TweakToggle label="bulk volume (110+ items)"
            value={t.bulkVolume}
            onChange={(v) => setTweak('bulkVolume', v)} />
        </TweakSection>

        <TweakSection label="Live stream">
          <TweakToggle label="SSE channel live"
            value={t.liveStream}
            onChange={(v) => setTweak('liveStream', v)} />
          <TweakButton label="inject agent item now" onClick={injectFromAgent} />
        </TweakSection>

        <TweakSection label="Keyboard">
          <KeyboardLegend />
        </TweakSection>
      </TweaksPanel>

      <ToastHost />
    </React.Fragment>
  );
};

// ── DemoStrip — context bar under chrome explaining the screen ──────────
const DemoStrip = ({ onSimulate, liveStream, onToggleLive }) => (
  <div style={{
    flex: 'none',
    padding: '8px 18px',
    background: 'color-mix(in srgb, var(--status-emerged) 6%, var(--bg-canvas))',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', gap: 12,
    fontFamily: 'var(--font-sans)', fontSize: 12,
    color: 'var(--fg-muted)',
  }}>
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.08em',
      color: 'var(--status-emerged)',
      padding: '2px 7px', borderRadius: 3,
      background: 'color-mix(in srgb, var(--status-emerged) 14%, transparent)',
      border: '1px solid color-mix(in srgb, var(--status-emerged) 35%, transparent)',
    }}>F13 · BIDIRECTIONAL FEEDBACK</span>
    <span style={{ color: 'var(--fg-subtle)' }}>·</span>
    <span>Human flags work for the agent · agent flags drift for the human · both meet here.</span>
    <div style={{ flex: 1 }} />
    <button onClick={onSimulate} style={{
      all: 'unset', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 24, padding: '0 10px',
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
      color: 'var(--status-active)',
      background: 'color-mix(in srgb, var(--status-active) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--status-active) 35%, transparent)',
      borderRadius: 4,
    }} title="curl -X POST localhost:7777/api/feedback ...">
      <span>↯</span> simulate agent post
    </button>
    <button onClick={onToggleLive} title={liveStream ? 'Pause auto-injection' : 'Resume auto-injection'}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 24, padding: '0 9px', borderRadius: 999,
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        color: liveStream ? 'var(--status-done)' : 'var(--fg-muted)',
        border: `1px solid ${liveStream ? 'color-mix(in srgb, var(--status-done) 40%, transparent)' : 'var(--border-subtle)'}`,
        background: liveStream ? 'color-mix(in srgb, var(--status-done) 8%, transparent)' : 'transparent',
      }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: liveStream ? 'var(--status-done)' : 'var(--fg-faint)',
        boxShadow: liveStream ? '0 0 6px color-mix(in srgb, var(--status-done) 70%, transparent)' : 'none',
      }} />
      {liveStream ? 'LIVE' : 'PAUSED'}
    </button>
  </div>
);

const KeyboardLegend = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', gap: 6,
    fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-muted)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Kbd>⌘ \</Kbd> <span>toggle drawer</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Kbd>Esc</Kbd> <span>close drawer</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Kbd>Tab</Kbd> <span>step through items</span>
    </div>
  </div>
);

// ── Toast (for stubbed navigation feedback) ─────────────────────────────
let _toastSetter = null;
const flashToast = (msg) => { if (_toastSetter) _toastSetter(msg); };
window._flashToast = flashToast;

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
      animation: 'aideck-fade-in 200ms var(--ease-out)',
    }}>{msg}</div>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
