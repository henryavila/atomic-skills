/**
 * Diagram-only SVG presentation rules shared by on-screen FLOW_CSS and PDF export.
 * Uses design-system tokens (var(--*)). Screen resolves them from inlined ds.css;
 * PDF injects light-paper token values into a cloned SVG (see flow-pdf.js).
 */

export const FLOW_DIAGRAM_CSS = `svg.diagram{display:block;max-width:none;font-family:var(--font-sans);shape-rendering:geometricPrecision;text-rendering:geometricPrecision}
svg.diagram text{fill:var(--fg-default)}
.actor-box{fill:var(--bg-elevated);stroke:var(--border-default);stroke-width:1}
.actor-label{fill:var(--fg-default);font-size:11px;font-weight:600}
.actor-stick-bg{fill:var(--bg-surface)}
.actor-stick-rule{stroke:var(--border-default);stroke-width:1}
.lifeline{stroke:var(--fg-faint);stroke-width:1;stroke-dasharray:3 5;pointer-events:none}
.life-hit{stroke:transparent;stroke-width:20;fill:none}
.arrow{stroke:var(--fg-muted);stroke-width:1.25;fill:none}
.arrow.async{stroke-dasharray:5 4}
.arrow-head{fill:var(--fg-muted)}
.msg{fill:var(--fg-default);font-size:12px}
.xor-wash{fill:color-mix(in srgb,var(--bg-elevated) 18%,transparent);stroke:none}
.xor-rail{stroke:var(--status-warning-line);stroke-width:2;fill:none}
.xor-q{fill:var(--status-warning);font-size:12px;font-weight:600}
.hair{stroke:var(--border-subtle);stroke-width:1}
.pill{fill:var(--bg-sunken);stroke:var(--status-warning-line);stroke-width:1}
.pill-t{fill:var(--status-warning);font-size:11px;font-weight:600}
.loop-arc{fill:none;stroke:var(--status-warning);stroke-width:1.25;stroke-dasharray:4 3}
.loop-head{fill:var(--status-warning)}
.act{fill:var(--bg-elevated);stroke:var(--border-default);stroke-width:1.25}
.act-t{fill:var(--fg-default);font-size:12px;font-weight:500}
.who{fill:var(--fg-subtle);font-size:10px;font-family:var(--font-mono)}
.diamond{fill:color-mix(in srgb,var(--status-warning) 10%,var(--bg-surface));stroke:var(--status-warning-line);stroke-width:1.25}
.xor-t{fill:var(--fg-default);font-size:12px;font-weight:600}
.bar{fill:var(--fg-muted)}
.evt{fill:var(--bg-canvas);stroke:var(--status-error-line);stroke-width:1.5}
.sub-mark{fill:none;stroke:var(--border-default);stroke-width:1}
.edge{stroke:var(--fg-faint);stroke-width:1.15;fill:none}
.edge.back{stroke:var(--status-warning);stroke-dasharray:4 3}
.edge-head{fill:var(--fg-muted)}
.edge-head.back{fill:var(--status-warning)}
.edge-t{fill:var(--fg-muted);font-size:11px}
.end-ok{fill:var(--status-success);stroke:var(--status-success);stroke-width:1.5}
.end-bad{fill:var(--status-error);stroke:var(--status-error);stroke-width:1.5}
.end-t{fill:var(--fg-muted);font-size:11px}
.end-hole{fill:var(--bg-canvas)}
.st{fill:var(--bg-sunken);stroke:var(--border-default);stroke-width:1.15}
.st.entry{stroke:var(--status-info);stroke-width:1.75}
.st.term{stroke:var(--status-success);stroke-width:1.75}
.st-t{fill:var(--fg-default);font-size:12px;font-weight:500}
.mach-title{fill:var(--fg-muted);font-size:12px;font-weight:600}
.mach-legend{fill:var(--fg-subtle);font-size:10px}
.edge-cap{fill:var(--bg-surface);stroke:var(--border-default);stroke-width:1}
.edge-title{fill:var(--fg-default);font-size:11px;font-weight:600}
.fx{fill:var(--fg-subtle);font-size:10px;font-family:var(--font-sans)}
.fx-pill{fill:var(--bg-sunken);stroke:var(--border-default);stroke-width:1}
.fx-pill-t{fill:var(--fg-muted);font-size:9px;font-weight:600}
`;
