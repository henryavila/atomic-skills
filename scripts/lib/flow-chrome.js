/**
 * Product L2 chrome: full-page tabs + pan/zoom around SVG diagrams.
 * Tokens from inlined ds.css. No process catalog. No list/card view.
 */
import { FLOW_ZOOM_KEY_PREFIX, FLOW_ZOOM_MIN, FLOW_ZOOM_MAX } from './flow-zoom.js';

export const FLOW_CSS = `/* flow layout — tokens from inlined ds.css only */
html,body{height:100%;overflow:hidden;margin:0;background:var(--bg-canvas);color:var(--fg-default);font-family:var(--font-sans)}
.app{display:grid;grid-template-rows:auto 1fr;height:100%;min-height:0}
.fl-header.top{z-index:20;background:color-mix(in srgb,var(--bg-canvas) 92%,transparent);border-bottom:1px solid var(--border-default);padding:var(--space-6) var(--space-8);display:flex;flex-direction:column;gap:var(--space-4)}
.top-row{display:flex;flex-wrap:wrap;gap:var(--space-6) var(--space-8);align-items:center;justify-content:space-between}
.brand{min-width:0;flex:1 1 220px}
.fl-title{margin:0;font-size:var(--fs-3xl);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight);line-height:var(--lh-tight)}
.fl-scenario{margin:2px 0 0;font-size:var(--fs-sm);color:var(--fg-muted);max-width:72ch}
.fl-toc{display:flex;flex-wrap:wrap;gap:var(--space-3);margin:0;padding:0}
.fl-toc button{appearance:none;display:inline-flex;align-items:center;height:30px;padding:0 var(--space-6);border-radius:var(--radius-pill);border:1px solid var(--border-default);background:var(--bg-elevated);color:var(--fg-muted);font:500 12px var(--font-sans);cursor:pointer}
.fl-toc button[aria-selected="true"]{color:var(--bg-canvas);background:var(--fg-default);border-color:var(--fg-default)}
.fl-toc button:focus-visible,.fl-toolbar button:focus-visible{outline:none;box-shadow:var(--shadow-focus)}
.fl-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3)}
.fl-toolbar button{appearance:none;height:28px;min-width:28px;padding:0 var(--space-4);border-radius:var(--radius-md);border:1px solid var(--border-default);background:var(--bg-surface);color:var(--fg-muted);font:600 12px var(--font-sans);cursor:pointer}
.fl-toolbar .zoom{font:700 12px var(--font-mono);color:var(--fg-subtle);padding:0 var(--space-3);min-width:3.2rem;text-align:center}
.theme-switch{display:inline-flex;gap:var(--space-2)}
.theme-switch button{appearance:none;height:28px;padding:0 var(--space-4);border-radius:var(--radius-pill);border:1px solid var(--border-default);background:var(--bg-elevated);color:var(--fg-muted);font:500 12px var(--font-sans);cursor:pointer}
.theme-switch button[aria-checked="true"]{background:var(--bg-surface);color:var(--fg-default)}
.fl-hint{margin:0;font-size:var(--fs-sm);color:var(--fg-subtle);display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:center}
.fl-meta{display:inline-flex;flex-wrap:wrap;gap:var(--space-6)}
.fl-meta span{font-size:var(--fs-sm);color:var(--fg-subtle)}
.fl-meta strong{color:var(--fg-muted);font-weight:var(--fw-medium)}
.fl-footer{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--fg-faint)}
.fl-viewport{position:relative;overflow:auto;min-width:0;min-height:0;cursor:grab;background:radial-gradient(circle at 1px 1px,var(--border-default) 1px,transparent 0) 0 0/22px 22px,var(--bg-sunken)}
.fl-viewport.is-panning{cursor:grabbing;user-select:none}
#fl-sizer{position:relative;min-width:100%;min-height:100%}
#fl-stage{position:absolute;top:0;left:0;padding:var(--space-12)}
.fl-surface{display:inline-block}
.fl-surface[hidden]{display:none !important}
.fl-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.sheet{display:inline-block;background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm);padding:18px 20px}
svg.diagram{display:block;max-width:none;font-family:var(--font-sans);shape-rendering:geometricPrecision;text-rendering:geometricPrecision}
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

export function flowChromeScript() {
  return `(function(){
var MIN=${FLOW_ZOOM_MIN},MAX=${FLOW_ZOOM_MAX},PREFIX=${JSON.stringify(FLOW_ZOOM_KEY_PREFIX)};
var slug=document.documentElement.getAttribute("data-fl-slug")||"default";
var key=PREFIX+slug;
var viewport=document.getElementById("fl-viewport");
var sizer=document.getElementById("fl-sizer");
var stage=document.getElementById("fl-stage");
var lab=document.getElementById("z-lab");
var scale=1;
function readZoom(){
  try{
    var n=parseFloat(localStorage.getItem(key));
    if(Number.isFinite(n)) return Math.min(MAX,Math.max(MIN,n));
  }catch(e){}
  return 1;
}
function saveZoom(){try{localStorage.setItem(key,String(scale))}catch(e){}}
function visiblePanel(){return document.querySelector(".fl-surface:not([hidden])")}
function visibleSvg(){
  var p=visiblePanel();
  return p?p.querySelector("svg"):null;
}
function svgNative(svg){
  if(!svg) return {w:0,h:0};
  if(!svg.dataset.nw){
    var vb=svg.viewBox&&svg.viewBox.baseVal;
    svg.dataset.nw=String((vb&&vb.width)||0);
    svg.dataset.nh=String((vb&&vb.height)||0);
  }
  return {w:+svg.dataset.nw,h:+svg.dataset.nh};
}
function applySvgScale(){
  var svg=visibleSvg();
  if(!svg) return;
  var n=svgNative(svg);
  svg.setAttribute("width",String(n.w*scale));
  svg.setAttribute("height",String(n.h*scale));
}
function applyStageGeometry(){
  applySvgScale();
  var sheet=document.querySelector(".fl-surface:not([hidden]) .sheet");
  if(!sheet||!viewport||!sizer||!stage) return null;
  var w=sheet.offsetWidth,h=sheet.offsetHeight,pad=40;
  var contentW=w+pad*2,contentH=h+pad*2;
  sizer.style.width=Math.max(viewport.clientWidth,Math.ceil(contentW))+"px";
  sizer.style.height=Math.max(viewport.clientHeight,Math.ceil(contentH))+"px";
  var sizerW=Math.max(viewport.clientWidth,Math.ceil(contentW));
  stage.style.left=Math.max(0,(sizerW-contentW)/2)+"px";
  stage.style.top="0px";
  if(lab) lab.textContent=Math.round(scale*100)+"%";
  return {contentW:contentW};
}
function setScale(next){
  scale=Math.min(MAX,Math.max(MIN,next));
  applyStageGeometry();
  saveZoom();
}
function selectTab(name){
  var tabs=document.querySelectorAll('[role="tab"][data-tab]');
  var i=0;
  for(;i<tabs.length;i++){
    var t=tabs[i];
    var on=t.getAttribute("data-tab")===name;
    t.setAttribute("aria-selected",on?"true":"false");
    var panel=document.getElementById(t.getAttribute("aria-controls"));
    if(!panel) continue;
    if(on) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden","");
  }
  applyStageGeometry();
}
var toc=document.querySelector(".fl-toc");
if(toc) toc.addEventListener("click",function(e){
  var t=e.target.closest("[data-tab]");
  if(!t||t.hidden) return;
  selectTab(t.getAttribute("data-tab"));
});
function pdfFilename(slug){
  var s=String(slug||"").trim().replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"");
  return s?s+"-fluxo.pdf":"fluxo.pdf";
}
function enc(s){return new TextEncoder().encode(s)}
function concat(chunks){
  var n=0,i=0;
  for(;i<chunks.length;i++) n+=chunks[i].length;
  var out=new Uint8Array(n),o=0;
  for(i=0;i<chunks.length;i++){out.set(chunks[i],o);o+=chunks[i].length}
  return out;
}
function buildFlowPdf(input){
  var list=Array.isArray(input&&input.pages)?input.pages:[];
  if(!list.length) throw new Error("buildFlowPdf: pages required");
  var header=enc("%PDF-1.4\\n%\\x80\\x80\\x80\\x80\\n");
  var bodyParts=[],offsets=[0],pos=header.length;
  function pushObj(num,payload){
    var start=enc(num+" 0 obj\\n"),end=enc("\\nendobj\\n");
    offsets[num]=pos;
    var chunk=concat([start,payload,end]);
    bodyParts.push(chunk);
    pos+=chunk.length;
  }
  var n=list.length,kids=list.map(function(_,i){return (3+i*3)+" 0 R"}).join(" ");
  pushObj(1,enc("<< /Type /Catalog /Pages 2 0 R >>"));
  pushObj(2,enc("<< /Type /Pages /Kids [ "+kids+" ] /Count "+n+" >>"));
  list.forEach(function(p,i){
    var pageNo=3+i*3,contentNo=pageNo+1,imageNo=pageNo+2;
    var ptW=Number(p.ptWidth)||Number(p.width)||595;
    var ptH=Number(p.ptHeight)||Number(p.height)||842;
    var raw=p.jpeg;
    var jpeg=raw instanceof Uint8Array?raw:new Uint8Array(raw);
    var pxW=Math.max(1,Number(p.width)||1),pxH=Math.max(1,Number(p.height)||1);
    var content="q "+ptW+" 0 0 "+ptH+" 0 0 cm /Im0 Do Q";
    pushObj(pageNo,enc("<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 "+ptW+" "+ptH+" ] /Resources << /XObject << /Im0 "+imageNo+" 0 R >> >> /Contents "+contentNo+" 0 R >>"));
    pushObj(contentNo,enc("<< /Length "+content.length+" >>\\nstream\\n"+content+"\\nendstream"));
    pushObj(imageNo,concat([enc("<< /Type /XObject /Subtype /Image /Width "+pxW+" /Height "+pxH+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpeg.length+" >>\\nstream\\n"),jpeg,enc("\\nendstream")]));
  });
  var xrefStart=pos,maxObj=2+n*3,xref="xref\\n0 "+(maxObj+1)+"\\n0000000000 65535 f \\n",i;
  for(i=1;i<=maxObj;i++) xref+=String(offsets[i]).padStart(10,"0")+" 00000 n \\n";
  return concat([header].concat(bodyParts).concat([enc(xref),enc("trailer\\n<< /Size "+(maxObj+1)+" /Root 1 0 R >>\\nstartxref\\n"+xrefStart+"\\n%%EOF\\n")]));
}
function svgToJpeg(svg){
  return new Promise(function(resolve,reject){
    var vb=svg.viewBox&&svg.viewBox.baseVal;
    var w=(vb&&vb.width)||svg.width.baseVal.value||1;
    var h=(vb&&vb.height)||svg.height.baseVal.value||1;
    var xml=new XMLSerializer().serializeToString(svg);
    var blob=new Blob([xml],{type:"image/svg+xml;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var img=new Image();
    img.onload=function(){
      URL.revokeObjectURL(url);
      var canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(w*2));
      canvas.height=Math.max(1,Math.round(h*2));
      var ctx=canvas.getContext("2d");
      ctx.fillStyle="#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      canvas.toBlob(function(b){
        if(!b){reject(new Error("jpeg"));return}
        b.arrayBuffer().then(function(buf){
          resolve({jpeg:new Uint8Array(buf),width:canvas.width,height:canvas.height,ptWidth:539,ptHeight:539*(canvas.height/canvas.width)});
        }).catch(reject);
      },"image/jpeg",0.92);
    };
    img.onerror=function(){URL.revokeObjectURL(url);reject(new Error("svg"))};
    img.src=url;
  });
}
async function downloadPdf(btn){
  if(btn.disabled) return;
  btn.disabled=true;
  var prev=btn.textContent;
  btn.textContent="PDF…";
  try{
    var ids=["seq-svg","bpm-svg","mach-svg"],pages=[],i;
    for(i=0;i<ids.length;i++){
      var svg=document.getElementById(ids[i]);
      if(svg) pages.push(await svgToJpeg(svg));
    }
    if(!pages.length) throw new Error("Nenhum diagrama para exportar");
    var bytes=buildFlowPdf({pages:pages});
    var url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
    var name=btn.getAttribute("data-pdf-name")||pdfFilename(document.documentElement.getAttribute("data-fl-slug")||"");
    var a=document.createElement("a");
    a.href=url;a.download=name;a.click();
    setTimeout(function(){URL.revokeObjectURL(url)},60000);
  }catch(err){
    var hint=document.getElementById("fl-hint");
    if(hint) hint.appendChild(document.createTextNode(" "+((err&&err.message)||"Falha ao gerar PDF")));
  }finally{
    btn.disabled=false;
    btn.textContent=prev||"PDF";
  }
}
var bar=document.querySelector(".fl-toolbar");
if(bar) bar.addEventListener("click",function(e){
  var pdf=e.target.closest("[data-action=pdf]");
  if(pdf){downloadPdf(pdf);return}
  var b=e.target.closest("[data-zoom]");
  if(!b) return;
  var a=b.getAttribute("data-zoom");
  if(a==="in") setScale(scale+0.1);
  else if(a==="out") setScale(scale-0.1);
  else if(a==="height"||a==="width"){
    var n=svgNative(visibleSvg());
    if(!n.w||!n.h||!viewport) return;
    var fitX=(viewport.clientWidth-24)/(n.w+80);
    var fitY=(viewport.clientHeight-24)/(n.h+80);
    setScale(a==="height"?fitY:fitX);
  } else {
    setScale(1);
  }
});
if(viewport){
  var panning=false,px=0,py=0,sx=0,sy=0;
  viewport.addEventListener("pointerdown",function(e){
    if(e.button!==0) return;
    panning=true;px=e.clientX;py=e.clientY;sx=viewport.scrollLeft;sy=viewport.scrollTop;
    viewport.classList.add("is-panning");
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener("pointermove",function(e){
    if(!panning) return;
    viewport.scrollLeft=sx-(e.clientX-px);
    viewport.scrollTop=sy-(e.clientY-py);
  });
  function endPan(){panning=false;viewport.classList.remove("is-panning")}
  viewport.addEventListener("pointerup",endPan);
  viewport.addEventListener("pointercancel",endPan);
  viewport.addEventListener("wheel",function(e){
    if(!e.ctrlKey) return;
    e.preventDefault();
    setScale(scale+(e.deltaY<0?0.1:-0.1));
  },{passive:false});
}
scale=readZoom();
applyStageGeometry();
window.addEventListener("resize",applyStageGeometry);
})();`;
}
