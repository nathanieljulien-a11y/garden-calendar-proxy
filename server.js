import { useState, useEffect, useRef, useCallback } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap');`;

const styles = `
  ${FONTS}
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --soil:#1E1208; --bark:#3A2210; --bark2:#4A2E1A;
    --moss:#3E5230; --sage:#7A8C6A; --fern:#5C7A4A;
    --cream:#F5EDD8; --parchment:#EDE0C4; --straw:#C8A96E;
    --bloom:#C4664A; --dew:#8AB4A0;
    --warm:#D4824A; --cool:#7AACCF; --wet:#6A9CAF; --dry:#C4A46A;
    --inspo:#B08A5E;
  }
  body { font-family:'Crimson Pro',Georgia,serif; background:var(--soil); color:var(--cream); min-height:100vh; }
  .grain { position:fixed; inset:0; pointer-events:none; z-index:9999; opacity:.45;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.035'/%3E%3C/svg%3E"); }
  .app { max-width:980px; margin:0 auto; padding:2rem 1.5rem 5rem; }

  header { text-align:center; padding:2.5rem 0 2rem; border-bottom:1px solid rgba(200,169,110,.25); margin-bottom:2.5rem; }
  .deco { font-size:1.5rem; letter-spacing:.6rem; opacity:.6; margin-bottom:.6rem; }
  h1 { font-family:'Playfair Display',serif; font-size:clamp(1.9rem,5vw,3rem); font-weight:400; color:var(--cream); line-height:1.1; }
  h1 em { color:var(--straw); font-style:italic; }
  .subtitle { font-size:1rem; color:var(--sage); margin-top:.6rem; font-style:italic; font-weight:300; }

  .demo-banner { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:.4rem .75rem; padding:.55rem 1.5rem; background:rgba(30,18,8,.85); border-bottom:1px solid rgba(200,169,110,.18); font-size:.78rem; color:var(--sage); position:sticky; top:0; z-index:100; backdrop-filter:blur(6px); }
  .demo-name { color:var(--straw); font-weight:600; letter-spacing:.04em; font-family:'Playfair Display',serif; }
  .demo-sep { opacity:.35; }
  .demo-tag { font-style:italic; }
  .api-banner { background:rgba(44,26,14,.7); border:1px dashed rgba(200,169,110,.3); border-radius:2px; padding:1.1rem 1.5rem; margin-bottom:2rem; }
  .api-banner label { display:block; font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; color:var(--bloom); margin-bottom:.4rem; }
  .api-banner input { width:100%; background:rgba(30,18,8,.9); border:1px solid rgba(200,169,110,.25); border-radius:2px; color:var(--cream); padding:.65rem 1rem; font-family:'Crimson Pro',serif; font-size:1rem; outline:none; transition:border-color .2s; }
  .api-banner input:focus { border-color:var(--straw); }
  .api-note { font-size:.82rem; color:var(--sage); margin-top:.45rem; font-style:italic; }
  .rate-limit-box { background:rgba(92,122,74,.18); border:1px solid rgba(92,122,74,.35); border-radius:2px; padding:.9rem 1.4rem; color:var(--fern); font-size:.93rem; margin-bottom:1.2rem; }

  @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes popIn   { from{transform:scale(.8);opacity:0} to{transform:scale(1);opacity:1} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes bob     { from{transform:translateY(0) scale(1)} to{transform:translateY(-10px) scale(1.08)} }
  @keyframes pulse   { 0%,80%,100%{transform:scale(.65);opacity:.35} 40%{transform:scale(1);opacity:1} }
  @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes popUp   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes lineIn  { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }

  /* ── Form ── */
  .form-card { background:rgba(58,34,16,.55); border:1px solid rgba(200,169,110,.18); border-radius:2px; padding:2rem 2.5rem 2.5rem; animation:fadeUp .4s ease forwards; }
  .form-title { font-family:'Playfair Display',serif; font-size:1.5rem; color:var(--straw); font-weight:400; margin-bottom:.35rem; }
  .form-hint  { font-size:.93rem; color:var(--sage); font-style:italic; margin-bottom:2rem; }
  .field-row  { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  @media(max-width:520px){.field-row{grid-template-columns:1fr}}
  .field { margin-bottom:1rem; }
  .field label { display:block; font-size:.8rem; text-transform:uppercase; letter-spacing:.09em; color:var(--straw); margin-bottom:.4rem; }
  .field input,.field select { width:100%; background:rgba(245,237,216,.92); border:1px solid rgba(200,169,110,.5); border-radius:2px; color:#2C1A0A; padding:.75rem 1rem; font-family:'Crimson Pro',serif; font-size:16px; outline:none; transition:border-color .2s,box-shadow .2s; appearance:none; -webkit-appearance:none; }
  .field input::placeholder { color:#7A6040; }
  .field input:focus,.field select:focus { border-color:var(--straw); box-shadow:0 0 0 2px rgba(200,169,110,.2); }
  .field select option { background:#3A2210; color:var(--cream); }
  .prefetch-chip { display:inline-flex; align-items:center; gap:.35rem; font-size:.75rem; color:var(--sage); margin-top:.5rem; font-style:italic; }
  .prefetch-chip.ready  { color:var(--fern); }
  .prefetch-chip.active { color:var(--straw); }
  .prefetch-chip.error  { color:var(--bloom); }
  .spin-sm { display:inline-block; animation:spin .7s linear infinite; font-style:normal; }

  .divider { height:1px; background:rgba(200,169,110,.15); margin:1.75rem 0 1.5rem; }
  .section-label { font-size:.8rem; text-transform:uppercase; letter-spacing:.09em; color:var(--straw); margin-bottom:1.2rem; }
  .section-label em { text-transform:none; font-style:italic; color:var(--sage); letter-spacing:0; }
  .category-row { margin-bottom:1.5rem; }
  .cat-label { font-size:.78rem; text-transform:uppercase; letter-spacing:.1em; color:var(--dew); margin-bottom:.55rem; display:flex; align-items:center; gap:.5rem; }
  .cat-label::after { content:''; flex:1; height:1px; background:rgba(138,180,160,.18); }
  .tag-row { display:flex; gap:.5rem; }
  .tag-row input { flex:1; background:rgba(245,237,216,.92); border:1px solid rgba(200,169,110,.4); border-radius:2px; color:#2C1A0A; padding:.6rem .85rem; font-family:'Crimson Pro',serif; font-size:16px; outline:none; transition:border-color .2s; }
  .tag-row input::placeholder { color:#7A6040; }
  .tag-row input:focus { border-color:var(--straw); }
  .btn-add { background:var(--moss); border:none; color:var(--cream); padding:0 1rem; border-radius:2px; cursor:pointer; font-size:1.3rem; line-height:1; flex-shrink:0; transition:background .2s; min-height:44px; min-width:44px; }
  .btn-add:hover { background:var(--fern); }
  .tags { display:flex; flex-wrap:wrap; gap:.45rem; margin-top:.6rem; min-height:1.5rem; }
  .tag { background:rgba(74,94,58,.45); border:1px solid rgba(122,140,106,.35); border-radius:2px; padding:.28rem .7rem; font-size:.88rem; color:var(--cream); display:flex; align-items:center; gap:.45rem; animation:popIn .18s ease; }
  .tag-x { background:none; border:none; color:var(--sage); cursor:pointer; font-size:1rem; padding:0; }
  .tag-x:hover { color:var(--bloom); }
  .clarify-row { display:flex; flex-wrap:wrap; gap:.35rem; margin:.4rem 0 .2rem; align-items:center; animation:fadeIn .25s ease; }
  .clarify-label { font-size:.76rem; color:var(--sage); font-style:italic; margin-right:.15rem; }
  .clarify-btn { background:rgba(122,140,106,.15); border:1px solid rgba(122,140,106,.3); border-radius:2px; padding:.22rem .6rem; font-size:.76rem; color:var(--sage); cursor:pointer; transition:all .15s; font-family:'Crimson Pro',serif; }
  .clarify-btn:hover { background:rgba(122,140,106,.28); color:var(--cream); }
  .clarify-btn.selected { background:rgba(92,122,74,.35); border-color:var(--fern); color:var(--cream); }
  .gbif-badge { font-size:.68rem; color:rgba(122,140,106,.55); font-style:italic; margin-left:.3rem; }
  .spell-row { display:flex; flex-wrap:wrap; gap:.35rem; margin:.3rem 0 .2rem; align-items:center; animation:fadeIn .25s ease; font-size:.76rem; color:var(--sage); }
  .spell-btn { background:rgba(200,169,110,.15); border:1px solid rgba(200,169,110,.3); border-radius:2px; padding:.22rem .6rem; font-size:.76rem; color:var(--straw); cursor:pointer; transition:all .15s; font-family:'Crimson Pro',serif; }
  .spell-btn:hover { background:rgba(200,169,110,.28); color:var(--cream); }
  .occ-warning { font-size:.76rem; color:rgba(200,140,60,.85); background:rgba(200,140,60,.06); border:1px solid rgba(200,140,60,.2); border-radius:4px; padding:.35rem .65rem; margin-top:.3rem; line-height:1.5; }
  .gbif-occ-badge { font-size:.68rem; color:rgba(122,140,106,.55); font-style:italic; margin-left:.4rem; font-weight:normal; }
  .gbif-attribution { font-size:.68rem; color:rgba(180,180,160,.4); margin-top:.75rem; padding-top:.5rem; border-top:1px solid rgba(255,255,255,.05); line-height:1.5; }
  .btn-generate { width:100%; margin-top:1rem; background:var(--fern); border:1px solid var(--moss); color:var(--cream); padding:1rem; font-family:'Playfair Display',serif; font-size:1.15rem; font-style:italic; letter-spacing:.04em; border-radius:2px; cursor:pointer; transition:all .2s; display:flex; align-items:center; justify-content:center; gap:.6rem; }
  .btn-generate:hover:not(:disabled) { background:var(--moss); transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,.35); }
  .btn-generate:disabled { opacity:.45; cursor:not-allowed; }
  .error-box { background:rgba(139,74,42,.3); border:1px solid rgba(196,102,74,.4); border-radius:2px; padding:.9rem 1.4rem; color:#E8B89A; font-size:.93rem; margin-bottom:1.2rem; }

  /* ── Stream dot bar ── */
  .stream-bar { display:flex; align-items:center; gap:.75rem; padding:.6rem 1rem; background:rgba(44,26,14,.7); border:1px solid rgba(200,169,110,.12); border-radius:2px; margin-bottom:1.25rem; font-size:.78rem; color:var(--sage); flex-wrap:wrap; animation:fadeIn .3s ease; }
  .stream-months { display:flex; gap:3px; align-items:center; }
  .sdot { width:7px; height:7px; border-radius:50%; background:var(--bark2); border:1px solid rgba(200,169,110,.18); transition:background .25s,border-color .25s; }
  .sdot.active { background:var(--straw); border-color:var(--straw); animation:pulse 1s ease-in-out infinite; }
  .sdot.done   { background:var(--fern); border-color:var(--fern); }
  .sdot.inspo  { background:var(--inspo); border-color:var(--inspo); }
  .stream-txt  { font-style:italic; }
  .stream-txt.s2 { color:var(--inspo); }

  /* ── References panel (open by default, with pending state) ── */
  .refs-panel { background:rgba(30,18,8,.7); border:1px solid rgba(200,169,110,.15); border-radius:2px; padding:1rem 1.5rem; margin-bottom:2rem; animation:fadeIn .4s ease; }
  .refs-toggle { display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none; }
  .refs-title  { font-size:.75rem; text-transform:uppercase; letter-spacing:.1em; color:var(--sage); display:flex; align-items:center; gap:.5rem; }
  .refs-chevron { font-size:.7rem; color:var(--sage); transition:transform .2s; }
  .refs-chevron.open { transform:rotate(180deg); }
  .refs-body { margin-top:.85rem; }
  .refs-pending { font-size:.82rem; color:var(--sage); font-style:italic; display:flex; align-items:center; gap:.5rem; padding:.25rem 0; }
  .refs-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:.5rem 1.5rem; }
  .ref-item { font-size:.83rem; color:var(--parchment); display:flex; gap:.4rem; align-items:baseline; line-height:1.4; animation:lineIn .25s ease; }
  .ref-dot  { color:var(--straw); flex-shrink:0; font-size:.6rem; margin-top:.3rem; }
  .ref-cat  { font-size:.68rem; color:var(--sage); text-transform:uppercase; letter-spacing:.06em; margin-right:.35em; }

  /* ── Calendar ── */
  .cal-wrap { animation:fadeUp .4s ease; }
  .cal-header { text-align:center; margin-bottom:1.75rem; }
  .cal-header h2 { font-family:'Playfair Display',serif; font-size:1.9rem; font-weight:400; color:var(--cream); }
  .cal-header p  { color:var(--sage); font-style:italic; margin-top:.35rem; font-size:.95rem; }
  .meta-pills { display:flex; flex-wrap:wrap; justify-content:center; gap:.5rem; margin:1rem 0 0; }
  .pill { background:rgba(44,26,14,.8); border:1px solid rgba(200,169,110,.2); border-radius:20px; padding:.28rem .85rem; font-size:.83rem; color:var(--sage); animation:popUp .3s ease; }
  .pill b { color:var(--straw); font-weight:400; }

  /* ── Month nav ── */
  .month-nav { display:flex; align-items:stretch; margin-bottom:1.5rem; }
  .nav-btn { background:rgba(58,34,16,.7); border:1px solid rgba(200,169,110,.18); color:var(--straw); cursor:pointer; font-size:1.6rem; padding:0 1.1rem; transition:all .2s; flex-shrink:0; display:flex; align-items:center; justify-content:center; min-width:52px; min-height:52px; }
  .nav-btn:hover:not(:disabled) { background:var(--bark2); color:var(--cream); }
  .nav-btn:disabled { opacity:.15; cursor:default; }
  .nav-btn.hidden { visibility:hidden; pointer-events:none; }
  .nav-btn.left  { border-radius:2px 0 0 2px; border-right:none; }
  .nav-btn.right { border-radius:0 2px 2px 0; border-left:none; }
  .months-window { flex:1; display:grid; grid-template-columns:repeat(3,1fr); align-items:start; }
  @media(max-width:640px){
    .months-window { grid-template-columns:1fr; }
    .month-nav { flex-direction:column; }
    .nav-btn { padding:.7rem; min-width:unset; }
    .nav-btn.left  { border-radius:2px 2px 0 0; border-right:1px solid rgba(200,169,110,.18); border-bottom:none; }
    .nav-btn.right { border-radius:0 0 2px 2px; border-left:1px solid rgba(200,169,110,.18); border-top:none; }
  }

  /* ── Month panel ── */
  .month-panel { background:rgba(54,30,12,.52); border:1px solid rgba(200,169,110,.15); padding:0 0 1.5rem; display:flex; flex-direction:column; animation:fadeIn .35s ease; }
  .month-panel+.month-panel { border-left:none; }
  .month-panel.is-current { background:rgba(74,52,18,.72); border-color:rgba(200,169,110,.35); z-index:2; }

  /* Ghost panel shown for months not yet started */
  .month-ghost { background:rgba(40,22,8,.3); border:1px solid rgba(200,169,110,.06); min-height:420px; display:flex; align-items:center; justify-content:center; }
  .month-ghost+.month-ghost { border-left:none; }

  .season-bar { height:4px; width:100%; opacity:.7; flex-shrink:0; transition:background .4s; }

  .mp-head { padding:1.1rem 1.3rem .8rem; border-bottom:1px solid rgba(200,169,110,.1); }
  .mp-title-row { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:.3rem; margin-bottom:.5rem; }
  .mp-month-name { font-family:'Playfair Display',serif; font-size:1.15rem; color:var(--cream); display:flex; align-items:baseline; gap:.45rem; }
  .mp-season-tag { font-size:.72rem; color:var(--sage); font-family:'Crimson Pro',serif; font-style:italic; font-weight:300; }
  .this-month-badge { font-size:.58rem; letter-spacing:.13em; text-transform:uppercase; color:var(--straw); opacity:.8; border:1px solid rgba(200,169,110,.35); border-radius:10px; padding:.15rem .5rem; }

  .mp-stats { display:flex; flex-wrap:wrap; gap:.4rem .8rem; font-size:.78rem; color:var(--sage); min-height:1.2rem; }
  .mp-stat  { display:flex; align-items:center; gap:.28rem; animation:lineIn .2s ease; }
  .stat-badge { font-size:.68rem; text-transform:uppercase; letter-spacing:.07em; padding:.12rem .5rem; border-radius:10px; white-space:nowrap; }
  .stat-badge.warmer { background:rgba(212,130,74,.22); color:var(--warm); border:1px solid rgba(212,130,74,.3); }
  .stat-badge.cooler { background:rgba(122,172,207,.18); color:var(--cool); border:1px solid rgba(122,172,207,.28); }
  .stat-badge.wetter { background:rgba(106,156,175,.18); color:var(--wet);  border:1px solid rgba(106,156,175,.28); }
  .stat-badge.drier  { background:rgba(196,164,106,.18); color:var(--dry);  border:1px solid rgba(196,164,106,.28); }
  .stat-badge.avg    { background:rgba(122,140,106,.15); color:var(--sage); border:1px solid rgba(122,140,106,.2); }

  .mp-body { padding:.9rem 1.3rem 0; flex:1; }
  .mp-section-label { font-size:.68rem; text-transform:uppercase; letter-spacing:.11em; margin-bottom:.5rem; display:flex; align-items:center; gap:.4rem; }
  .mp-section-label.tasks-lbl { color:var(--straw); margin-top:0; }
  .mp-section-label.enjoy-lbl { color:var(--dew);   margin-top:.9rem; }
  .mp-section-label.inspo-lbl { color:var(--inspo); margin-top:.9rem; }
  .mp-section-label::after { content:''; flex:1; height:1px; background:currentColor; opacity:.2; }
  .mp-list { list-style:none; }
  .mp-list li { font-size:.88rem; color:var(--parchment); padding:.3rem 0; border-bottom:1px solid rgba(200,169,110,.07); display:flex; gap:.45rem; line-height:1.45; animation:lineIn .25s ease; }
  .mp-list li:last-child { border-bottom:none; }
  .bullet-task  { color:var(--fern);  flex-shrink:0; margin-top:.1rem; }
  .bullet-enjoy { color:var(--dew);   flex-shrink:0; margin-top:.1rem; }

  /* Inline typing cursor shown on the actively-streaming field */
  .typing-cursor::after { content:'▌'; animation:pulse .7s ease-in-out infinite; color:var(--straw); font-size:.7em; margin-left:2px; }

  /* Shimmer for fields not yet started */
  .shimmer-line { height:.7rem; border-radius:2px; margin:.38rem 0;
    background:linear-gradient(90deg,rgba(200,169,110,.06) 25%,rgba(200,169,110,.14) 50%,rgba(200,169,110,.06) 75%);
    background-size:400px 100%; animation:shimmer 1.5s ease-in-out infinite; }
  .shimmer-line.short  { width:55%; }
  .shimmer-line.medium { width:78%; }
  .shimmer-line.full   { width:100%; }
  .shimmer-block { padding:.4rem 0; }

  .suggestions { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.5rem; }
  .chip { background:transparent; border:1px solid rgba(138,180,160,.3); color:var(--sage); border-radius:20px; padding:.18rem .65rem; font-family:'Crimson Pro',serif; font-size:.8rem; cursor:pointer; transition:all .18s; }
  .chip:hover { background:rgba(92,122,74,.3); border-color:var(--fern); color:var(--cream); }
  .chip.added { background:rgba(74,94,58,.35); border-color:rgba(122,140,106,.3); color:rgba(200,200,180,.35); cursor:default; text-decoration:line-through; }
  @keyframes bobArrow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
  .float-arrow { position:fixed; bottom:2rem; left:50%; transform:translateX(-50%); z-index:1000; background:rgba(44,26,14,.85); border:1px solid rgba(200,169,110,.35); border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer; animation:bobArrow 1.6s ease-in-out infinite; backdrop-filter:blur(4px); transition:opacity .3s, visibility .3s; }
  .float-arrow:hover { background:rgba(92,122,74,.7); border-color:var(--fern); }
  .float-arrow svg { width:18px; height:18px; fill:none; stroke:var(--straw); stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; }
  .insights-panel { background:rgba(30,18,8,.7); border:1px solid rgba(200,169,110,.15); border-radius:2px; padding:1rem 1.5rem; margin-bottom:2rem; animation:fadeIn .4s ease; }
  .insights-unlock { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.75rem; }
  .insights-title  { font-size:.75rem; text-transform:uppercase; letter-spacing:.1em; color:var(--sage); display:flex; align-items:center; gap:.5rem; }
  .btn-unlock { background:rgba(92,122,74,.25); border:1px solid rgba(92,122,74,.4); color:var(--fern); padding:.4rem 1rem; font-family:'Crimson Pro',serif; font-size:.85rem; border-radius:2px; cursor:pointer; transition:all .2s; }
  .btn-unlock:hover { background:rgba(92,122,74,.4); color:var(--cream); }
  .btn-unlock:disabled { opacity:.4; cursor:not-allowed; }
  .insights-body { margin-top:.9rem; }
  .insights-good { font-size:.9rem; color:var(--fern); font-style:italic; padding:.25rem 0; animation:fadeIn .3s ease; }
  .insight-item { padding:.7rem 0; border-bottom:1px solid rgba(200,169,110,.08); animation:lineIn .25s ease; }
  .insight-item:last-child { border-bottom:none; }
  .insight-plant { font-family:'Playfair Display',serif; font-size:.95rem; color:var(--straw); margin-bottom:.25rem; }
  .insight-q     { font-size:.88rem; color:var(--cream); font-style:italic; margin-bottom:.2rem; }
  .insight-ctx   { font-size:.83rem; color:var(--sage); margin-bottom:.15rem; }
  .insight-tip   { font-size:.83rem; color:var(--dew); }
  .insight-tip::before { content:'→ '; opacity:.6; }
  .btn-inspo { background:rgba(176,138,94,.18); border:1px solid rgba(176,138,94,.35); color:var(--inspo); padding:.5rem .9rem; font-family:'Crimson Pro',serif; font-size:.85rem; border-radius:2px; cursor:pointer; transition:all .2s; width:100%; text-align:left; }
  .btn-inspo:hover { background:rgba(176,138,94,.3); border-color:var(--inspo); color:var(--parchment); }
  .inspo-loading { font-size:.82rem; color:var(--sage); font-style:italic; display:flex; align-items:center; gap:.4rem; padding:.3rem 0; }
  .inspo-name   { font-family:'Playfair Display',serif; font-style:italic; color:var(--straw); font-size:.92rem; }
  .inspo-detail { color:var(--sage); font-size:.82rem; margin-top:.15rem; }
  .inspo-text   { margin-top:.3rem; font-size:.84rem; color:var(--parchment); line-height:1.45; }

  .page-dots { display:flex; justify-content:center; gap:.5rem; margin-bottom:2rem; }
  .pdot { width:8px; height:8px; border-radius:50%; background:var(--bark2); border:1px solid rgba(200,169,110,.22); cursor:pointer; transition:all .2s; }
  .pdot.active   { background:var(--straw); border-color:var(--straw); }
  .pdot.disabled { opacity:.2; cursor:default; pointer-events:none; }
  .cal-actions { display:flex; justify-content:center; gap:1rem; flex-wrap:wrap; margin-top:.5rem; }
  .btn-ghost { background:transparent; border:1px solid rgba(200,169,110,.28); color:var(--sage); padding:.7rem 1.5rem; font-family:'Crimson Pro',serif; font-size:.95rem; border-radius:2px; cursor:pointer; transition:all .2s; }
  .btn-ghost:hover { border-color:var(--straw); color:var(--straw); }
  .btn-solid { background:var(--fern); border:1px solid var(--moss); color:var(--cream); padding:.7rem 1.6rem; font-family:'Crimson Pro',serif; font-size:.95rem; border-radius:2px; cursor:pointer; transition:all .2s; }
  .btn-solid:hover:not(:disabled) { background:var(--moss); }
  .btn-solid:disabled { opacity:.45; cursor:not-allowed; }
`;

// ─── Constants ────────────────────────────────────────────────────────────────
const ORIENTATIONS = [
  "North-facing (cool, shaded)","South-facing (warm, sunny)",
  "East-facing (morning sun)","West-facing (afternoon sun)","Mixed / open aspect",
];
const PLANT_CATEGORIES = [
  {key:"trees",      label:"Trees",               icon:"🌳", suggestions:[]},
  {key:"shrubs",     label:"Shrubs & Hedges",      icon:"🌿", suggestions:[]},
  {key:"flowers",    label:"Flowers & Perennials", icon:"🌸", suggestions:[]},
  {key:"vegetables", label:"Vegetables",           icon:"🥦", suggestions:[]},
  {key:"fruit",      label:"Fruit & Berries",      icon:"🍓", suggestions:[]},
  {key:"herbs",      label:"Herbs",                icon:"🌿", suggestions:[]},
];

// ─── iNat seed list ───────────────────────────────────────────────────────────
// Validated across 15 cities, 5 continents. common name → scientific name.
const INAT_SEED = {
  vegetables: [
    {common:"Tomato",             sci:"Solanum lycopersicum"},
    {common:"Potato",             sci:"Solanum tuberosum"},
    {common:"Kale / cabbage",     sci:"Brassica oleracea"},
    {common:"Courgette",          sci:"Cucurbita pepo"},
    {common:"Sweet pepper",       sci:"Capsicum annuum"},
    {common:"Aubergine",          sci:"Solanum melongena"},
    {common:"Cucumber",           sci:"Cucumis sativus"},
    {common:"Sweet corn",         sci:"Zea mays"},
    {common:"French bean",        sci:"Phaseolus vulgaris"},
    {common:"Pea",                sci:"Pisum sativum"},
    {common:"Lettuce",            sci:"Lactuca sativa"},
    {common:"Pak choi",           sci:"Brassica rapa"},
    {common:"Sweet potato",       sci:"Ipomoea batatas"},
    {common:"Pumpkin",            sci:"Cucurbita maxima"},
    {common:"Onion",              sci:"Allium cepa"},
    {common:"Garlic",             sci:"Allium sativum"},
    {common:"Leek",               sci:"Allium ampeloprasum"},
    {common:"Spinach",            sci:"Spinacia oleracea"},
    {common:"Radish / daikon",    sci:"Raphanus sativus"},
    {common:"Kangkong",           sci:"Ipomoea aquatica"},
    {common:"Bitter melon",       sci:"Momordica charantia"},
    {common:"Moringa",            sci:"Moringa oleifera"},
    {common:"Long bean",          sci:"Vigna unguiculata"},
    {common:"Edamame / soybean",  sci:"Glycine max"},
  ],
  herbs: [
    {common:"Rosemary",           sci:"Salvia rosmarinus"},
    {common:"Sage",               sci:"Salvia officinalis"},
    {common:"Chives",             sci:"Allium schoenoprasum"},
    {common:"Fennel",             sci:"Foeniculum vulgare"},
    {common:"Oregano",            sci:"Origanum vulgare"},
    {common:"Basil",              sci:"Ocimum basilicum"},
    {common:"Thyme",              sci:"Thymus vulgaris"},
    {common:"Mint",               sci:"Mentha spicata"},
    {common:"Parsley",            sci:"Petroselinum crispum"},
    {common:"Dill",               sci:"Anethum graveolens"},
    {common:"Coriander",          sci:"Coriandrum sativum"},
    {common:"Lemongrass",         sci:"Cymbopogon citratus"},
    {common:"Pandan",             sci:"Pandanus amaryllifolius"},
    {common:"Lemon verbena",      sci:"Aloysia citrodora"},
    {common:"Tarragon",           sci:"Artemisia dracunculus"},
    {common:"Vietnamese coriander",sci:"Persicaria odorata"},
    {common:"Culantro",           sci:"Eryngium foetidum"},
    {common:"Shiso / perilla",    sci:"Perilla frutescens"},
  ],
  fruit: [
    {common:"Fig",                sci:"Ficus carica"},
    {common:"Apple",              sci:"Malus domestica"},
    {common:"Cherry",             sci:"Prunus avium"},
    {common:"Pear",               sci:"Pyrus communis"},
    {common:"Plum",               sci:"Prunus domestica"},
    {common:"Strawberry",         sci:"Fragaria ananassa"},
    {common:"Grape",              sci:"Vitis vinifera"},
    {common:"Loquat",             sci:"Eriobotrya japonica"},
    {common:"Lemon",              sci:"Citrus limon"},
    {common:"Orange",             sci:"Citrus sinensis"},
    {common:"Persimmon",          sci:"Diospyros kaki"},
    {common:"Papaya",             sci:"Carica papaya"},
    {common:"Banana",             sci:"Musa acuminata"},
    {common:"Mango",              sci:"Mangifera indica"},
    {common:"Passionfruit",       sci:"Passiflora edulis"},
    {common:"Guava",              sci:"Psidium guajava"},
    {common:"Blackcurrant",       sci:"Ribes nigrum"},
    {common:"Raspberry",          sci:"Rubus idaeus"},
    {common:"Blueberry",          sci:"Vaccinium corymbosum"},
    {common:"Gooseberry",         sci:"Ribes uva-crispa"},
    {common:"Yuzu",               sci:"Citrus junos"},
    {common:"Sea buckthorn",      sci:"Hippophae rhamnoides"},
  ],
  flowers: [
    {common:"Rose",               sci:"Rosa"},
    {common:"Lavender",           sci:"Lavandula angustifolia"},
    {common:"Pelargonium",        sci:"Pelargonium"},
    {common:"Begonia",            sci:"Begonia"},
    {common:"Bougainvillea",      sci:"Bougainvillea"},
    {common:"Hibiscus",           sci:"Hibiscus rosa-sinensis"},
    {common:"Heliconia",          sci:"Heliconia"},
    {common:"Bird of paradise",   sci:"Strelitzia reginae"},
    {common:"Sunflower",          sci:"Helianthus annuus"},
    {common:"Nasturtium",         sci:"Tropaeolum majus"},
    {common:"Petunia",            sci:"Petunia hybrida"},
    {common:"Fuchsia",            sci:"Fuchsia"},
    {common:"Impatiens",          sci:"Impatiens walleriana"},
    {common:"Marigold",           sci:"Tagetes erecta"},
    {common:"Zinnia",             sci:"Zinnia elegans"},
    {common:"Dahlia",             sci:"Dahlia pinnata"},
    {common:"Cosmos",             sci:"Cosmos bipinnatus"},
    {common:"Agapanthus",         sci:"Agapanthus africanus"},
    {common:"African violet",     sci:"Streptocarpus ionanthus"},
    {common:"Waratah",            sci:"Telopea speciosissima"},
  ],
  trees: [
    {common:"Magnolia",           sci:"Magnolia"},
    {common:"Japanese maple",     sci:"Acer palmatum"},
    {common:"Camellia",           sci:"Camellia japonica"},
    {common:"Callistemon",        sci:"Callistemon"},
    {common:"Wisteria",           sci:"Wisteria sinensis"},
    {common:"Hawthorn",           sci:"Crataegus monogyna"},
    {common:"Elder",              sci:"Sambucus nigra"},
    {common:"Eucalyptus",         sci:"Eucalyptus"},
    {common:"Flame tree",         sci:"Delonix regia"},
    {common:"Coconut palm",       sci:"Cocos nucifera"},
    {common:"Frangipani",         sci:"Plumeria"},
    {common:"Weeping willow",     sci:"Salix babylonica"},
    {common:"Crab apple",         sci:"Malus sylvestris"},
    {common:"Olive",              sci:"Olea europaea"},
    {common:"Bay laurel",         sci:"Laurus nobilis"},
    {common:"Jacaranda",          sci:"Jacaranda mimosifolia"},
  ],
  shrubs: [
    {common:"Rhododendron",       sci:"Rhododendron"},
    {common:"Oleander",           sci:"Nerium oleander"},
    {common:"Ixora",              sci:"Ixora coccinea"},
    {common:"Pittosporum",        sci:"Pittosporum tenuifolium"},
    {common:"Callistemon",        sci:"Callistemon"},
    {common:"Duranta",            sci:"Duranta erecta"},
    {common:"Croton",             sci:"Codiaeum variegatum"},
    {common:"Acalypha",           sci:"Acalypha wilkesiana"},
    {common:"Photinia",           sci:"Photinia fraseri"},
    {common:"Hydrangea",          sci:"Hydrangea macrophylla"},
    {common:"Privet",             sci:"Ligustrum ovalifolium"},
    {common:"Bamboo",             sci:"Phyllostachys aurea"},
    {common:"Lomandra",           sci:"Lomandra longifolia"},
    {common:"Holly",              sci:"Ilex aquifolium"},
  ],
};

// Map PLANT_CATEGORIES keys to INAT_SEED keys
const CAT_TO_SEED = {
  trees:"trees", shrubs:"shrubs", flowers:"flowers",
  vegetables:"vegetables", fruit:"fruit", herbs:"herbs",
};

// Climate-zone fallback presets (used when iNat returns <3 plants with count >0)
const CLIMATE_FALLBACKS = {
  tropical:    {
    vegetables:["Tomato","Sweet pepper","Aubergine","Kangkong","Bitter melon","Moringa","Long bean","Sweet corn","Sweet potato","Pumpkin"],
    herbs:     ["Basil","Lemongrass","Pandan","Culantro","Vietnamese coriander","Coriander","Mint","Shiso / perilla"],
    fruit:     ["Mango","Papaya","Banana","Guava","Passionfruit","Lemon","Orange","Fig"],
    flowers:   ["Bougainvillea","Hibiscus","Heliconia","Bird of paradise","Rose","Begonia","Impatiens","Marigold","Zinnia","Cosmos"],
    trees:     ["Coconut palm","Flame tree","Frangipani","Jacaranda","Camellia","Eucalyptus","Magnolia","Wisteria"],
    shrubs:    ["Ixora","Duranta","Croton","Acalypha","Oleander","Rhododendron","Pittosporum","Hydrangea"],
  },
  subtropical: {
    vegetables:["Tomato","Sweet pepper","Courgette","Aubergine","Sweet corn","Lettuce","Kale / cabbage","Cucumber","Onion","Sweet potato"],
    herbs:     ["Basil","Rosemary","Lemongrass","Coriander","Mint","Oregano","Thyme","Sage"],
    fruit:     ["Lemon","Orange","Fig","Mango","Guava","Passionfruit","Strawberry","Grape"],
    flowers:   ["Bougainvillea","Rose","Pelargonium","Strelitzia","Agapanthus","Hibiscus","Begonia","Cosmos","Lavender","Marigold"],
    trees:     ["Jacaranda","Magnolia","Olive","Camellia","Callistemon","Eucalyptus","Wisteria","Flame tree"],
    shrubs:    ["Oleander","Rhododendron","Callistemon","Pittosporum","Duranta","Photinia","Hydrangea","Ixora"],
  },
  mediterranean:{
    vegetables:["Tomato","Sweet pepper","Courgette","Aubergine","Cucumber","Lettuce","Kale / cabbage","Onion","Garlic","Pea"],
    herbs:     ["Rosemary","Thyme","Sage","Oregano","Basil","Fennel","Lavender","Coriander","Lemon verbena","Tarragon"],
    fruit:     ["Fig","Grape","Lemon","Orange","Plum","Cherry","Apple","Pear","Persimmon","Loquat"],
    flowers:   ["Rose","Lavender","Pelargonium","Bougainvillea","Oleander","Cosmos","Begonia","Nasturtium","Zinnia","Dahlia"],
    trees:     ["Olive","Magnolia","Wisteria","Camellia","Callistemon","Jacaranda","Frangipani","Eucalyptus"],
    shrubs:    ["Oleander","Pittosporum","Rhododendron","Hydrangea","Photinia","Callistemon","Privet","Bamboo"],
  },
  temperate:   {
    vegetables:["Tomato","Potato","Kale / cabbage","Courgette","Sweet pepper","Cucumber","French bean","Pea","Lettuce","Onion"],
    herbs:     ["Rosemary","Sage","Chives","Oregano","Basil","Thyme","Mint","Parsley","Fennel","Dill"],
    fruit:     ["Apple","Cherry","Pear","Plum","Strawberry","Fig","Blackcurrant","Raspberry","Blueberry","Gooseberry"],
    flowers:   ["Rose","Lavender","Pelargonium","Begonia","Sunflower","Nasturtium","Petunia","Fuchsia","Cosmos","Dahlia"],
    trees:     ["Magnolia","Japanese maple","Camellia","Wisteria","Hawthorn","Elder","Callistemon","Crab apple"],
    shrubs:    ["Rhododendron","Hydrangea","Pittosporum","Photinia","Holly","Privet","Bamboo","Lomandra"],
  },
  continental: {
    vegetables:["Tomato","Potato","Kale / cabbage","Courgette","Sweet pepper","Cucumber","Sweet corn","Pea","Lettuce","Onion"],
    herbs:     ["Dill","Thyme","Sage","Chives","Basil","Mint","Parsley","Coriander","Oregano","Fennel"],
    fruit:     ["Apple","Pear","Plum","Cherry","Strawberry","Blackcurrant","Raspberry","Blueberry","Gooseberry","Grape"],
    flowers:   ["Cosmos","Pelargonium","Sunflower","Fuchsia","Impatiens","Lavender","Rose","Begonia","Dahlia","Petunia"],
    trees:     ["Japanese maple","Magnolia","Elder","Hawthorn","Weeping willow","Camellia","Wisteria","Crab apple"],
    shrubs:    ["Rhododendron","Oleander","Hydrangea","Photinia","Privet","Holly","Bamboo","Pittosporum"],
  },
  arid:        {
    vegetables:["Tomato","Sweet corn","Sweet pepper","Kale / cabbage","Courgette","Aubergine","Onion","Garlic","Lettuce","Pumpkin"],
    herbs:     ["Rosemary","Thyme","Sage","Oregano","Dill","Lemongrass","Basil","Fennel","Tarragon","Coriander"],
    fruit:     ["Fig","Plum","Strawberry","Lemon","Orange","Apple","Pear","Guava","Grape","Persimmon"],
    flowers:   ["Sunflower","Pelargonium","Cosmos","Impatiens","Lavender","Rose","Marigold","Zinnia","Hibiscus","Nasturtium"],
    trees:     ["Olive","Eucalyptus","Magnolia","Callistemon","Elder","Hawthorn","Weeping willow","Jacaranda"],
    shrubs:    ["Oleander","Rhododendron","Duranta","Callistemon","Photinia","Privet","Pittosporum","Hydrangea"],
  },
};

// Classify climate zone from OpenMeteo data (same classification the app already uses)
function getClimateZone(cd) {
  if (!cd) return "temperate";
  const meanTemp = cd.monthly_mean_temp
    ? cd.monthly_mean_temp.reduce((a,b)=>a+b,0)/12
    : (cd.annual_mean_temp ?? 12);
  const minTemp  = cd.monthly_mean_temp ? Math.min(...cd.monthly_mean_temp) : (cd.coldest_month_temp ?? 5);
  const annualPrecip = cd.annual_precipitation ?? 600;

  if (meanTemp >= 20 && minTemp >= 18)    return "tropical";
  if (meanTemp >= 16 && minTemp >= 5)     return "subtropical";
  if (meanTemp >= 12 && annualPrecip < 400) return "arid";
  if (meanTemp >= 10 && minTemp >= 2)     return "mediterranean";
  if (minTemp < -5)                       return "continental";
  return "temperate";
}

// ─── iNat local suggestions ───────────────────────────────────────────────────
// Queries iNat captive=true for all plants in a category, returns top-N common names.
async function fetchInatSuggestions(catKey, lat, lng, topN = 10) {
  const seedKey = CAT_TO_SEED[catKey];
  const plants  = INAT_SEED[seedKey] ?? [];
  if (!plants.length) return null;

  const results = [];
  const batchSize = 5;
  for (let i = 0; i < plants.length; i += batchSize) {
    const batch = plants.slice(i, i + batchSize);
    const counts = await Promise.all(batch.map(async p => {
      try {
        const url = new URL("https://api.inaturalist.org/v1/observations");
        url.searchParams.set("taxon_name", p.sci);
        url.searchParams.set("lat",        lat);
        url.searchParams.set("lng",        lng);
        url.searchParams.set("radius",     "50");
        url.searchParams.set("captive",    "true");
        url.searchParams.set("per_page",   "1");
        const res  = await fetch(url);
        const data = await res.json();
        return { common: p.common, count: data.total_results ?? 0 };
      } catch { return { common: p.common, count: 0 }; }
    }));
    results.push(...counts);
    if (i + batchSize < plants.length) await new Promise(r => setTimeout(r, 1200));
  }

  // Return top N with count > 0; if fewer than 3 meaningful results, signal fallback needed
  const ranked = results.filter(r => r.count > 0).sort((a,b) => b.count - a.count);
  return { ranked: ranked.slice(0, topN), sparse: ranked.length < 3 };
}
const MONTH_NAMES   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SEASON_COLORS = { Winter:"#7AA6C2",Spring:"#8CBF72",Summer:"#D4A84B",Autumn:"#C47A45",Fall:"#C47A45" };
const SEASON_EMOJIS = {
  January:"❄️",February:"🌨️",March:"🌱",April:"🌸",May:"🌿",June:"☀️",
  July:"🌻",August:"🍅",September:"🍂",October:"🎃",November:"🍁",December:"❄️",
};

// ─── Plant validation & clarification ────────────────────────────────────────

// Principle-based clarification rules. Each rule fires when the resolved genus matches.
// To add a new rule: add one entry here — no other code changes needed.
const CLARIFICATION_RULES = [
  {
    test: ({ genus }) => genus === "Magnolia",
    question: "Deciduous or evergreen?",
    options: ["Deciduous (loses leaves)", "Evergreen", "Not sure"],
    promptHint: (ans) => ans.startsWith("Deciduous")
      ? "deciduous — prune immediately after flowering in spring only"
      : ans === "Evergreen" ? "evergreen — prune lightly after flowering, avoid hard cuts" : null,
  },
  {
    test: ({ genus }) => genus === "Rosa",
    question: "What type of rose?",
    options: ["Bush / hybrid tea / floribunda", "Climbing or rambler", "Shrub rose", "Not sure"],
    promptHint: (ans) => ans.startsWith("Climbing")
      ? "climbing/rambler — prune flowered laterals after bloom, train new canes"
      : ans.startsWith("Bush") ? "bush/hybrid tea — hard prune early spring to outward-facing buds"
      : ans.startsWith("Shrub") ? "shrub rose — remove one third of oldest stems annually" : null,
  },
  {
    test: ({ genus }) => genus === "Malus",
    question: "Eating, cooking, or crab apple?",
    options: ["Eating apple", "Cooking apple", "Crab apple", "Not sure"],
    promptHint: (ans) => ans === "Crab apple"
      ? "crab apple — ornamental, prune for shape after flowering only"
      : ans.includes("apple") ? "fruiting apple — summer prune laterals Jul–Aug, structural prune Feb only" : null,
  },
  {
    test: ({ genus }) => genus === "Lavandula",
    question: "Common or French lavender?",
    options: ["Common / English lavender", "French lavender (butterfly ears)", "Not sure"],
    promptHint: (ans) => ans.startsWith("French")
      ? "French lavender (Lavandula stoechas) — less hardy, protect in hard frosts"
      : ans.startsWith("Common") ? "common lavender — fully hardy, trim after flowering in Aug" : null,
  },
  {
    test: ({ genus }) => genus === "Camellia",
    question: "When does it flower?",
    options: ["Spring (Feb–April)", "Autumn/Winter (Oct–Jan)", "Not sure"],
    promptHint: (ans) => ans.startsWith("Spring")
      ? "Camellia japonica — prune immediately after spring flowering"
      : ans.startsWith("Autumn") ? "Camellia sasanqua — prune after autumn/winter flowering" : null,
  },
];

// Common English name → scientific name / genus for GBIF lookup.
// GBIF species/match works well with scientific names but not vernacular English names.
// This map is the bridge — we own the translation, GBIF owns the taxonomy.
const COMMON_TO_SCIENTIFIC = {
  // Clarification-rule plants (genus only — GBIF resolves to accepted species)
  "magnolia":   "Magnolia",
  "rose":       "Rosa",
  "roses":      "Rosa",
  "apple":      "Malus",
  "apples":     "Malus",
  "lavender":   "Lavandula",
  "camellia":   "Camellia",
  // Scientific name enrichment — specific accepted names
  "rosemary":   "Salvia rosmarinus",
  "hydrangea":  "Hydrangea",
  "forsythia":  "Forsythia",
  "tomato":     "Solanum lycopersicum",
  "tomatoes":   "Solanum lycopersicum",
  "fig":        "Ficus carica",
  "figs":       "Ficus carica",
  "peony":      "Paeonia",
  "peonies":    "Paeonia",
  "wisteria":   "Wisteria",
  "clematis":   "Clematis",
  "dahlia":     "Dahlia",
  "dahlias":    "Dahlia",
  "allium":     "Allium",
  "tulip":      "Tulipa",
  "tulips":     "Tulipa",
  "daffodil":   "Narcissus",
  "daffodils":  "Narcissus",
  "snowdrop":   "Galanthus",
  "snowdrops":  "Galanthus",
  "bluebell":   "Hyacinthoides",
  "bluebells":  "Hyacinthoides",
  "buddleia":   "Buddleja",
  "buddleja":   "Buddleja",
  "viburnum":   "Viburnum",
  "photinia":   "Photinia fraseri",  // Red Robin — most common UK garden photinia
  "photinias":  "Photinia fraseri",
  // Additional common names missing from GBIF name backbone
  "holly":       "Ilex aquifolium",
  "hollies":     "Ilex aquifolium",
  "olive":       "Olea europaea",
  "olives":      "Olea europaea",
  "quince":      "Cydonia oblonga",
  "quinces":     "Cydonia oblonga",
  "rhubarb":     "Rheum rhabarbarum",
  "blueberry":   "Vaccinium corymbosum",
  "blueberries": "Vaccinium corymbosum",
  "edelweiss":   "Leontopodium alpinum",
  "coconut":     "Cocos nucifera",
  "pineapple":   "Ananas comosus",
  "pineapples":  "Ananas comosus",
  "coconuts":    "Cocos nucifera",
  "melon":       "Cucumis melo",
  "melons":      "Cucumis melo",
  "hellebore":   "Helleborus",
  "hellebores":  "Helleborus",
  "oleander":    "Nerium oleander",
  "pyracantha":  "Pyracantha",
  "magnolia":    "Magnolia",
  "hydrangea":   "Hydrangea",
  "spruce":      "Picea",
  "crocus":      "Crocus",
  "daffodil":    "Narcissus",
  "daffodils":   "Narcissus",
  "elderflower": "Sambucus nigra",
  "elderberry": "Sambucus nigra",
  "ivy":        "Hedera",
  "fern":       "Dryopteris",
  "ferns":      "Dryopteris",
  "mint":       "Mentha",
  "thyme":      "Thymus",
  "sage":       "Salvia officinalis",
  "basil":      "Ocimum basilicum",
  "chives":     "Allium schoenoprasum",
  "parsley":    "Petroselinum crispum",
  "strawberry": "Fragaria",
  "strawberries": "Fragaria",
  "raspberry":  "Rubus idaeus",
  "raspberries": "Rubus idaeus",
  "blackberry": "Rubus fruticosus",
  "blackberries": "Rubus fruticosus",
  "gooseberry": "Ribes uva-crispa",
  "gooseberries": "Ribes uva-crispa",
  "currant":    "Ribes",
  "currants":   "Ribes",
  "redcurrant":  "Ribes rubrum",
  "redcurrants": "Ribes rubrum",
  "blackcurrant":  "Ribes nigrum",
  "blackcurrants": "Ribes nigrum",
  "peach":      "Prunus persica",
  "peaches":    "Prunus persica",
  "plum":       "Prunus domestica",
  "plums":      "Prunus domestica",
  "cherry":     "Prunus avium",
  "cherries":   "Prunus avium",
  "pear":       "Pyrus communis",
  "pears":      "Pyrus communis",
  "courgette":  "Cucurbita pepo",
  "courgettes": "Cucurbita pepo",
  "zucchini":   "Cucurbita pepo",
  "bean":       "Phaseolus",
  "beans":      "Phaseolus",
  "pea":        "Pisum sativum",
  "peas":       "Pisum sativum",
  "potato":     "Solanum tuberosum",
  "potatoes":   "Solanum tuberosum",
  "carrot":     "Daucus carota",
  "carrots":    "Daucus carota",
  "onion":      "Allium cepa",
  "onions":     "Allium cepa",
  "garlic":     "Allium sativum",
};

// Validates a plant name via GBIF species/match API.
// GBIF names backbone derives from WCVP (World Checklist of Vascular Plants, Royal Botanic Gardens, Kew)
// and Plants of the World Online (POWO) — so this lookup honours both sources.
// Source attribution: Global Biodiversity Information Facility (GBIF) · gbif.org · CC BY 4.0
async function validatePlantName(name) {
  // Translate common English name → scientific name for GBIF lookup
  const queryName = COMMON_TO_SCIENTIFIC[name.toLowerCase()] || name;
  const proxyUrl  = PROXY_BASE ? `${PROXY_BASE}/api/species?name=${encodeURIComponent(queryName)}` : null;
  const directUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(queryName)}&verbose=false`;

  const tryFetch = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  try {
    let data;
    try {
      data = proxyUrl ? await tryFetch(proxyUrl) : await tryFetch(directUrl);
    } catch {
      data = await tryFetch(directUrl); // fall back to direct
    }

    // GBIF returns matchType:"NONE" when nothing found
    if (!data || data.matchType === "NONE" || !data.canonicalName) {
      return { status: "unknown", name };
    }

    const genus   = data.genus || data.canonicalName?.split(" ")[0] || "";
    const family  = data.family || "";
    const sciName = data.canonicalName || data.scientificName || "";
    const rule    = CLARIFICATION_RULES.find(r => r.test({ genus, family }));

    // Auto-populate the lookup map so occurrence checks use the correct scientific name
    // even for plants not hardcoded in COMMON_TO_SCIENTIFIC
    const key = name.toLowerCase();
    if (!COMMON_TO_SCIENTIFIC[key] && sciName) {
      COMMON_TO_SCIENTIFIC[key] = sciName;
    }

    // Spelling suggestion: if the user's input doesn't match any known common name
    // and differs meaningfully from the canonical scientific name, offer a correction.
    // Use the first common vernacular name from COMMON_TO_SCIENTIFIC that maps to the
    // same scientific name, falling back to the canonical name itself.
    let spellSuggestion = null;
    const inputKey = name.toLowerCase().trim();
    const isKnownCommon = !!COMMON_TO_SCIENTIFIC[inputKey];
    const matchesScientific = sciName.toLowerCase().startsWith(inputKey) || inputKey === sciName.toLowerCase();
    if (!isKnownCommon && !matchesScientific && sciName) {
      // Find a friendly common name that maps to this scientific name
      const commonMatch = Object.entries(COMMON_TO_SCIENTIFIC).find(([k, v]) =>
        v.toLowerCase() === sciName.toLowerCase() && k !== inputKey
      );
      spellSuggestion = commonMatch ? commonMatch[0] : sciName;
      // Capitalise first letter for display
      spellSuggestion = spellSuggestion.charAt(0).toUpperCase() + spellSuggestion.slice(1);
    }

    return {
      status: "valid", name,
      scientificName: sciName,
      family, genus,
      usageKey: data.usageKey,        // GBIF taxon key — used for occurrence lookup
      confidence: data.confidence,
      attribution: "GBIF / WCVP (Royal Botanic Gardens, Kew)",
      clarificationRule: rule || null,
      clarificationAnswer: null,
      spellSuggestion,
    };
  } catch {
    return { status: "unknown", name };
  }
}

// Checks how many times a plant has been recorded growing near a location.
// Fires once coordinates are known (after climate prefetch).
// Source: GBIF occurrence records · gbif.org · CC BY 4.0 / CC0 per dataset
async function checkRegionalOccurrence(scientificName, lat, lng) {
  if (!lat || !lng || !scientificName) return null;
  // Single species/match to resolve correct GBIF occurrence parameter.
  // genusKey aggregates all species under a genus; taxonKey is species-level.
  let gbifParam;
  let resolvedMatchType = null;
  try {
    const matchUrl = PROXY_BASE
      ? `${PROXY_BASE}/api/species?name=${encodeURIComponent(scientificName)}`
      : `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}&verbose=false`;
    const r = await fetch(matchUrl);
    if (r.ok) {
      const d = await r.json();
      // Only use EXACT or FUZZY matches — HIGHERRANK means species not in GBIF backbone
      // (e.g. Leontopodium alpinum → Asteraceae family, giving millions of false records)
      const matchType = d.matchType || "";
      const rank = (d.rank || "").toUpperCase();
      if (d.usageKey && (matchType === "EXACT" || matchType === "FUZZY")) {
        gbifParam = rank === "GENUS"  ? `genusKey=${d.genusKey || d.usageKey}`
                  : rank === "FAMILY" ? `familyKey=${d.familyKey || d.usageKey}`
                  : `taxonKey=${d.usageKey}`;
        // Store matchType so badge logic can require EXACT for zero-count warnings
        resolvedMatchType = matchType;
      } else {
        return null; // HIGHERRANK or NONE — not reliable enough for occurrence data
      }
    }
  } catch {}
  if (!gbifParam) return null;
  const url = `https://api.gbif.org/v1/occurrence/search?${gbifParam}&decimalLatitude=${lat-3.0},${lat+3.0}&decimalLongitude=${lng-3.0},${lng+3.0}&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.count !== "number") return null;
    return { count: data.count, recorded: data.count > 0, matchType: resolvedMatchType };
  } catch {
    return null;
  }
}
function enrichedPlantName(name, meta) {
  let label = name;
  if (meta?.status === "valid") {
    if (meta.scientificName && meta.scientificName.toLowerCase() !== name.toLowerCase()) {
      label += ` (${meta.scientificName})`;
    }
    if (meta.clarificationAnswer && meta.clarificationRule) {
      const hint = meta.clarificationRule.promptHint(meta.clarificationAnswer);
      if (hint) label += ` — ${hint}`;
    }
  }
  // Flag plants with zero local GBIF records — applies to all plants, validated or not
  if (meta?.occurrence?.count === 0 && meta?.occurrence?.matchType === 'EXACT' && meta?.scientificName) {
    label += ` — ⚠ 0 GBIF records near location, likely unsuitable for this climate`;
  } else if (meta?.occurrence?.count > 0) {
    label += ` — ${meta.occurrence.count} local GBIF records`;
  }
  return label;
}


// ─── Empty month template ─────────────────────────────────────────────────────
const emptyMonth = (name) => ({
  month:name, season:null, sunHours:null,
  tasks:[], enjoy:[],
  _taskPartial:null, _enjoyPartial:null,
  _state:"pending",
});


// ─── OpenMeteo climate data ───────────────────────────────────────────────────
// Fetches 10 years of daily ERA5 data and aggregates to monthly normals.
// Free, no API key, global coverage, CC BY 4.0.
const OM_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

async function fetchOpenMeteoClimate(lat, lng) {
  const vars = [
    "temperature_2m_mean","temperature_2m_min","temperature_2m_max",
    "precipitation_sum","sunshine_duration"
  ].join(",");
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=2014-01-01&end_date=2023-12-31&daily=${vars}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenMeteo HTTP ${res.status}`);
  const raw = await res.json();

  const dates  = raw.daily?.time || [];
  const tMean  = raw.daily?.temperature_2m_mean || [];
  const tMin   = raw.daily?.temperature_2m_min  || [];
  const tMax   = raw.daily?.temperature_2m_max  || [];
  const precip = raw.daily?.precipitation_sum   || [];
  const sun    = raw.daily?.sunshine_duration   || [];

  const acc = Array.from({length:12}, () => ({tMean:[],tMin:[],tMax:[],precip:0,sun:0,frostDays:0,count:0}));
  for (let i = 0; i < dates.length; i++) {
    const m = new Date(dates[i]).getMonth();
    if (tMean[i]  != null) acc[m].tMean.push(tMean[i]);
    if (tMin[i]   != null) acc[m].tMin.push(tMin[i]);
    if (tMax[i]   != null) acc[m].tMax.push(tMax[i]);
    if (precip[i] != null) acc[m].precip += precip[i];
    if (sun[i]    != null) acc[m].sun += sun[i];
    if (tMin[i]   != null && tMin[i] < 0) acc[m].frostDays++;
    acc[m].count++;
  }
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  const YEARS = 10;
  return {
    lat: raw.latitude, lng: raw.longitude,
    tMean:     acc.map(a => avg(a.tMean)),
    tMin:      acc.map(a => avg(a.tMin)),
    tMax:      acc.map(a => avg(a.tMax)),
    precip:    acc.map(a => a.precip / YEARS),
    sunHrs:    acc.map(a => (a.sun / a.count) / 3600),
    frostDays: acc.map(a => a.frostDays / YEARS),
  };
}

function deriveClimateFromOM(cd, hemisphere) {
  const { tMean, tMin, tMax, precip, frostDays } = cd;
  const annualFrost   = frostDays.reduce((a,b) => a+b, 0);
  const coldestMean   = Math.min(...tMean);
  const hottestMax    = Math.max(...tMax);
  const coldestMin    = Math.min(...tMin);
  const annualPrecip  = precip.reduce((a,b) => a+b, 0);
  const dryMonthCount = precip.filter(p => p < 30).length;
  const tempRange     = Math.max(...tMean) - Math.min(...tMean);

  // Hardiness zone from coldest monthly minimum
  const zone = coldestMin < -17.8 ? "Zone 6" : coldestMin < -12.2 ? "Zone 7"
    : coldestMin < -6.7 ? "Zone 8" : coldestMin < -1.1 ? "Zone 9"
    : coldestMin < 4.4  ? "Zone 10" : "Zone 11+";

  // Multi-axis climate classification
  let climateType;
  if (annualFrost === 0 && coldestMean > 18) {
    climateType = "equatorial";
  } else if (annualFrost === 0 && coldestMean > 15) {
    climateType = "tropical humid";
  } else if (annualFrost < 5 && dryMonthCount >= 4) {
    const summerIdxs = hemisphere === "S" ? [11,0,1] : [5,6,7];
    const winterIdxs = hemisphere === "S" ? [5,6,7] : [11,0,1];
    const wetSummer = summerIdxs.reduce((a,i)=>a+precip[i],0) > winterIdxs.reduce((a,i)=>a+precip[i],0) * 1.5;
    climateType = hottestMax > 35 ? "hot semi-arid" : wetSummer ? "subtropical (wet/dry seasons)" : "mediterranean";
  } else if (annualFrost < 5 && annualPrecip > 800) {
    climateType = "subtropical oceanic";
  } else if (annualFrost < 5 && dryMonthCount >= 3) {
    climateType = "subtropical (wet/dry seasons)";
  } else if (annualFrost < 5) {
    climateType = "subtropical";
  } else if (coldestMean < 0 || annualFrost > 60) {
    climateType = "cold temperate";
  } else if (tempRange < 16) {
    climateType = "temperate oceanic";
  } else {
    climateType = "temperate continental";
  }

  // Frost months — hemisphere-aware
  const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let lastFrost = null, firstFrost = null;
  if (hemisphere === "S") {
    for (let i = 11; i >= 6; i--) if (frostDays[i] > 0.5) { lastFrost = SHORT[i]; break; }
    for (let i = 0;  i <= 5; i++) if (frostDays[i] > 0.5) { firstFrost = SHORT[i]; break; }
  } else {
    for (let i = 5; i >= 0; i--) if (frostDays[i] > 0.5) { lastFrost = SHORT[i]; break; }
    for (let i = 6; i <= 11; i++) if (frostDays[i] > 0.5) { firstFrost = SHORT[i]; break; }
  }

  // Dry season months (named)
  const dryMonths = SHORT.filter((_,i) => precip[i] < 30);

  // Season note for prompt
  let seasonNote = "";
  if (hemisphere === "S") {
    seasonNote = "SOUTHERN HEMISPHERE — seasons are inverted vs Northern Hemisphere. Summer is Dec–Feb, winter is Jun–Aug.";
  } else if (climateType === "equatorial") {
    seasonNote = "EQUATORIAL — no seasons. Growing year-round. Tasks governed by wet/dry cycles, not temperature.";
  } else if (climateType === "tropical humid") {
    seasonNote = "TROPICAL — no frost ever. Growing year-round. Wet season governs planting timing.";
  }

  return { zone, climateType, lastFrost, firstFrost, dryMonths, seasonNote, annualFrost, annualPrecip };
}

function buildClimateContext(cd, derived) {
  const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmt1  = arr => SHORT.map((m,i) => `${m}:${arr[i]?.toFixed(1)}`).join(" ");
  const fmt0  = arr => SHORT.map((m,i) => `${m}:${arr[i]?.toFixed(0)}`).join(" ");
  return [
    `Hemisphere: ${derived.seasonNote ? (derived.seasonNote.startsWith("SOUTHERN") ? "Southern (seasons inverted)" : "Equatorial") : "Northern"}`,
    `Climate type: ${derived.climateType}`,
    `Hardiness zone: ${derived.zone}`,
    `Monthly mean temps (°C):  ${fmt1(cd.tMean)}`,
    `Monthly max temps (°C):   ${fmt1(cd.tMax)}`,
    `Monthly precip (mm):      ${fmt0(cd.precip)}`,
    `Monthly sunshine (h/day): ${fmt1(cd.sunHrs)}`,
    `Frost days/month:         ${fmt1(cd.frostDays)}`,
    `Last spring frost: ${derived.lastFrost || "none"} · First autumn frost: ${derived.firstFrost || "none"}`,
    `Annual frost days: ${derived.annualFrost.toFixed(0)}`,
    derived.dryMonths.length ? `Dry months (<30mm rain): ${derived.dryMonths.join(", ")}` : "No pronounced dry season",
    derived.seasonNote ? `IMPORTANT: ${derived.seasonNote}` : "",
  ].filter(Boolean).join("\n");
}

// Detect hemisphere from latitude (equatorial band ±10°)
function detectHemisphere(lat) {
  if (lat > 10)  return "N";
  if (lat < -10) return "S";
  return "EQ";
}

// ─── Proxy base URL ───────────────────────────────────────────────────────────
// Read directly from Vite env at build time — window.__VITE_PROXY_URL__ set by
// main.jsx is unreliable due to module evaluation order.
const PROXY_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_PROXY_URL)
  ? String(import.meta.env.VITE_PROXY_URL).replace(/\/$/, "")
  : (typeof window !== "undefined" && window.__VITE_PROXY_URL__)
  ? String(window.__VITE_PROXY_URL__).replace(/\/$/, "")
  : "";

// True only in Claude artifact sandbox — no proxy, needs direct API key
function isArtifact() {
  if (typeof window === "undefined") return false;
  if (PROXY_BASE) return false;
  const host = window.location.hostname;
  return !host.includes("vercel.app") && host !== "localhost" && host !== "127.0.0.1";
}

// ─── Streaming helper ─────────────────────────────────────────────────────────
async function streamClaude(prompt, maxTokens, onChunk, signal, apiKey) {
  const url = isArtifact()
    ? "https://api.anthropic.com/v1/messages"
    : `${PROXY_BASE}/api/stream`;
  const headers = isArtifact()
    ? { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" }
    : { "Content-Type":"application/json" };
  const res = await fetch(url, {
    method:"POST", headers,
    body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:maxTokens, stream:true, messages:[{role:"user",content:prompt}] }),
    signal,
  });
  if (!res.ok) {
    const e = await res.json().catch(()=>({}));
    const err = new Error(e.message || e.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.isRateLimit = res.status === 429;
    throw err;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    for (const line of dec.decode(value,{stream:true}).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const d = line.slice(6).trim();
      if (d==="[DONE]") continue;
      try {
        const evt = JSON.parse(d);
        if (evt.type==="content_block_delta"&&evt.delta?.type==="text_delta") onChunk(evt.delta.text);
        if (evt.type==="message_delta"&&evt.delta?.stop_reason==="max_tokens") onChunk("\n");
      } catch {}
    }
  }
}

// Non-streaming for small payloads
async function callClaude(prompt, maxTokens, signal, apiKey) {
  const url = isArtifact()
    ? "https://api.anthropic.com/v1/messages"
    : `${PROXY_BASE}/api/call`;
  const headers = isArtifact()
    ? { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" }
    : { "Content-Type":"application/json" };
  const res = await fetch(url, { method:"POST", headers,
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxTokens,messages:[{role:"user",content:prompt}]}),
    signal,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message||data.error);
  return JSON.parse(data.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());
}

// ─── Line-format stream parser ────────────────────────────────────────────────
// KEY FIXES vs previous version:
// 1. All mutable parser state lives in plain JS variables (never in React state),
//    so React batching can never drop an intermediate update.
// 2. processPartial fires on EVERY chunk — not just recognised prefixes — so the
//    typing cursor always advances even on very long lines.
// 3. React state is updated via a rAF-throttled flush so the UI stays smooth
//    without setState being called hundreds of times per second.
//
// onMonthUpdate(allMonthsSnapshot) — receives the full months map each flush.
function makeLineParser(onFlush) {
  const monthsMap = {};
  let lineBuffer  = "";
  let currentName = null;
  let lastPrefix  = null;
  let cancelled   = false;
  let dirty       = false; // true when monthsMap has unseen changes

  function cancel() { cancelled = true; }

  function cur() { return currentName ? monthsMap[currentName] : null; }

  function doFlush() {
    if (cancelled || !dirty) return;
    dirty = false;
    const snapshot = {};
    Object.keys(monthsMap).forEach(k => { snapshot[k] = { ...monthsMap[k], tasks:[...monthsMap[k].tasks], enjoy:[...monthsMap[k].enjoy] }; });
    onFlush(snapshot);
  }

  function scheduleFlush() { dirty = true; } // just mark dirty — interval does the rest

  function commitCurrent() {
    const m = cur();
    if (!m) return;
    m._taskPartial  = null;
    m._enjoyPartial = null;
    m._state        = "done";
    currentName     = null;
    scheduleFlush();
  }

  function processLine(line) {
    const l = line.trim();
    if (!l) return;

    if (l.startsWith("MONTH:")) {
      commitCurrent();
      const name = l.slice(6).trim();
      if (!MONTH_NAMES.includes(name)) return;
      monthsMap[name] = { ...emptyMonth(name), _state:"active" };
      currentName = name;
      lastPrefix = null;
      scheduleFlush();
      return;
    }

    const m = cur();
    if (!m) return;

    if (l === "---") { lastPrefix = null; commitCurrent(); return; }

    if      (l.startsWith("SEASON:")) { m.season      = l.slice(7).trim();  lastPrefix = null; }
    else if (l.startsWith("SUN:"))    { m.sunHours    = parseFloat(l.slice(4)); lastPrefix = null; }
    else if (l.startsWith("TASK:"))   { m.tasks.push(l.slice(5).trim());  m._taskPartial  = null; lastPrefix = "TASK:"; }
    else if (l.startsWith("ENJOY:"))  { m.enjoy.push(l.slice(6).trim());  m._enjoyPartial = null; lastPrefix = "ENJOY:"; }
    else if (l.startsWith("INAME:"))  { m.inspiration = { ...(m.inspiration||{}), name:     l.slice(6).trim() }; lastPrefix = null; }
    else if (l.startsWith("ILOC:"))   { m.inspiration = { ...(m.inspiration||{}), location: l.slice(5).trim() }; lastPrefix = null; }
    else if (l.startsWith("IDIST:"))  { m.inspiration = { ...(m.inspiration||{}), distance: l.slice(6).trim() }; lastPrefix = null; }
    else if (l.startsWith("IHIGH:"))  { m.inspiration = { ...(m.inspiration||{}), highlight:l.slice(6).trim() }; lastPrefix = "IHIGH:"; }
    else if (lastPrefix && l.length > 0) {
      // Continuation of a force-split line — re-apply last prefix
      processLine(lastPrefix + l);
      return; // already called scheduleFlush inside recursive call
    }

    scheduleFlush();
  }

  // FIX: update partial on EVERY chunk, not just recognised prefixes.
  // Strip the known prefix if present, otherwise show raw tail so cursor always moves.
  function processPartial(tail) {
    const m = cur();
    if (!m || !tail) return;
    if (tail.startsWith("TASK:"))        { m._taskPartial  = tail.slice(5);  m._enjoyPartial = null; }
    else if (tail.startsWith("ENJOY:"))  { m._enjoyPartial = tail.slice(6);  m._taskPartial  = null; }
    else if (tail.startsWith("MONTH:") ||
             tail.startsWith("SEASON:")||
             tail.startsWith("SUN:")   ||
             tail.startsWith("INAME:")||
             tail.startsWith("ILOC:")  ||
             tail.startsWith("IDIST:")||
             tail.startsWith("IHIGH:")) {
      // Recognised prefix mid-line — clear partials, don't show noise
      m._taskPartial = null; m._enjoyPartial = null;
    } else if (tail.length > 0) {
      // Unknown tail — keep showing whatever was last set so cursor stays visible
      // (don't clear — avoids flicker when prefix hasn't arrived yet)
    }
    scheduleFlush();
  }

  const onChunk = function(chunk) {
    if (cancelled) return;
    lineBuffer += chunk;
    const lines = lineBuffer.split("\n");
    for (let i = 0; i < lines.length - 1; i++) processLine(lines[i]);
    lineBuffer = lines[lines.length - 1];
    // Only force-split truly runaway lines (200+ chars with no \n)
    while (lineBuffer.length > 200) {
      const slice = lineBuffer.slice(0, 200);
      const splitAt = Math.max(slice.lastIndexOf(" "), 50);
      processLine(lineBuffer.slice(0, splitAt).trim());
      lineBuffer = lineBuffer.slice(splitAt).trimStart();
    }
    processPartial(lineBuffer);
  };

  function flush() {
    if (lineBuffer.trim()) {
      processLine(lineBuffer.trim());
      lineBuffer = "";
    }
    if (currentName && monthsMap[currentName]?._state === "active") {
      commitCurrent();
    }
    dirty = true;
    doFlush(); // synchronous — commits final content before post-stream cleanup
  }

  return { onChunk, cancel, flush, doFlush };
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportICS(months, city) {
  const now = new Date();
  const year = now.getFullYear();
  const thisMonth = now.getMonth();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Garden Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (let i = 1; i <= 12; i++) {
    const mIdx = (thisMonth + i) % 12;
    const mYear = year + Math.floor((thisMonth + i) / 12);
    const mName = MONTH_NAMES[mIdx];
    const m = months[mName];
    if (!m || !m.tasks.length) continue;
    const dateStr = `${mYear}${String(mIdx + 1).padStart(2,"0")}01`;
    const stamp = now.toISOString().replace(/[-:]/g,"").slice(0,15)+"Z";
    const uid = `garden-${mName}-${mYear}@gardenCalendar`;
    const description = m.tasks.map(t => `• ${t}`).join("\\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`,
      `SUMMARY:🌿 Garden tasks — ${mName}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${city}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  triggerDownload(lines.join("\r\n"), "garden-calendar.ics", "text/calendar");
}

function exportPDF(months, city, meta) {
  const year = new Date().getFullYear();
  const thisMonth = new Date().getMonth();
  const ordered = Array.from({length:12}, (_,i) => MONTH_NAMES[(thisMonth + 1 + i) % 12]);
  const SEASON_COLORS = {Winter:"#7BA7BC",Spring:"#7BAF7B",Summer:"#C9A84C",Autumn:"#C4703A"};

  const monthHTML = ordered.map(name => {
    const m = months[name];
    if (!m || m._state === "pending") return "";
    const mIdx = MONTH_NAMES.indexOf(name);
    const mYear = year + (mIdx <= thisMonth ? 1 : 0);
    const color = SEASON_COLORS[m.season] || "#7BAF7B";
    const tasks = m.tasks.map(t => `<li>${t}</li>`).join("");
    const enjoy = m.enjoy.map(e => `<li>${e}</li>`).join("");
    return `
      <div class="month-block">
        <div class="month-header" style="border-left:4px solid ${color}">
          <span class="month-name">${name} ${mYear}</span>
          <span class="month-season" style="color:${color}">${m.season || ""}</span>
        </div>
        ${tasks ? `<div class="section-label">Things to do</div><ul>${tasks}</ul>` : ""}
        ${enjoy ? `<div class="section-label">What to enjoy</div><ul>${enjoy}</ul>` : ""}
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Garden Calendar — ${city}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 680px; margin: 0 auto; padding: 2rem; color: #2C1A0A; }
    h1 { font-size: 1.6rem; margin-bottom: .25rem; }
    .subtitle { color: #7a6040; font-size: .9rem; margin-bottom: 2rem; }
    .month-block { margin-bottom: 2rem; page-break-inside: avoid; }
    .month-header { padding: .4rem .8rem; background: #faf6ef; margin-bottom: .6rem; display:flex; justify-content:space-between; align-items:baseline; }
    .month-name { font-size: 1.15rem; font-weight: bold; }
    .month-season { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
    .section-label { font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: #9a7a50; margin: .5rem 0 .2rem; }
    ul { margin: 0; padding-left: 1.2rem; }
    li { margin-bottom: .25rem; font-size: .9rem; line-height: 1.5; }
    @media print { body { padding: 1rem; } }
  </style></head><body>
  <h1>🌿 Garden Calendar</h1>
  <div class="subtitle">${city}${meta?.zone ? ` · ${meta.zone}` : ""}${meta?.climate ? ` · ${meta.climate}` : ""}</div>
  ${monthHTML}
  </body></html>`;

  triggerDownload(html, "garden-calendar.html", "text/html");
}

function TagInput({value,onChange,placeholder,onAdd}) {
  const [inp,setInp]=useState("");
  const add=()=>{
    const v=inp.trim();
    if(v&&!value.includes(v)){ onChange([...value,v]); if(onAdd) onAdd(v); }
    setInp("");
  };
  return (
    <div>
      <div className="tag-row">
        <input type="text" value={inp} placeholder={placeholder}
          onChange={e=>setInp(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),add())}/>
        <button className="btn-add" onClick={add} type="button">+</button>
      </div>
      <div className="tags">
        {value.map(item=>(
          <span key={item} className="tag">{item}
            <button className="tag-x" onClick={()=>onChange(value.filter(x=>x!==item))}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}


function Shimmer({lines=3}) {
  const w=["full","medium","short","medium","full"];
  return <div className="shimmer-block">{Array.from({length:lines}).map((_,i)=><div key={i} className={`shimmer-line ${w[i%w.length]}`} style={{animationDelay:`${i*.15}s`}}/>)}</div>;
}

// References panel — open by default, shows pending state while fetching
function RefsPanel({refs, pending}) {
  const [open,setOpen] = useState(true);
  const catIcon = { Climate:"🌦", "Plant care":"🌿", Phenology:"🗓", Wildlife:"🐦", Gardens:"🌳", Broadcasters:"📺" };
  return (
    <div className="refs-panel">
      <div className="refs-toggle" onClick={()=>setOpen(o=>!o)}>
        <span className="refs-title">📚 Sources & References</span>
        <span className={`refs-chevron${open?" open":""}`}>▼</span>
      </div>
      {open && (
        <div className="refs-body">
          {pending ? (
            <div className="refs-pending">
              <span className="spin-sm">◌</span>
              Consulting climate records, horticultural guides & wildlife databases…
            </div>
          ) : (
            <div className="refs-list">
              {(refs||[]).map((r,i)=>(
                <div key={i} className="ref-item">
                  <span className="ref-dot">◆</span>
                  <span>
                    <span className="ref-cat">{catIcon[r.category]||"◆"} {r.category}</span>
                    <span>{(r.sources || (r.name ? [r.name] : [])).join(" · ")}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StreamBar({months, stream1Done, activeMonth, chunkCount}) {
  if (stream1Done) return null;
  return (
    <div className="stream-bar">
      <div className="stream-months">
        {MONTH_NAMES.map(name => {
          const m = months[name];
          const state = !m ? "" : m._state==="active" ? "active" : m._state==="done" && m.inspiration ? "inspo" : m._state==="done" ? "done" : "";
          return <div key={name} className={`sdot ${state}`} title={name}/>;
        })}
      </div>
      {!stream1Done && activeMonth && (
        <span className="stream-txt"><span className="spin-sm">◌</span> {activeMonth}…</span>
      )}
      <span style={{marginLeft:"auto",opacity:.5,fontFamily:"monospace",fontSize:".72rem"}}>{chunkCount} chunks</span>
    </div>
  );
}

function orientationShort(o) { return o?o.split(" (")[0]:""; }

// ─── MonthPanel ───────────────────────────────────────────────────────────────
function MonthPanel({m, isCurrent, showInspoButton, inspo, onFetchInspo}) {
  if (!m || m._state==="pending") {
    return <div className="month-ghost"><Shimmer lines={2}/></div>;
  }
  const sColor = SEASON_COLORS[m.season]||"var(--bark2)";
  const isActive = m._state==="active";

  return (
    <div className={`month-panel${isCurrent?" is-current":""}`}>
      <div className="season-bar" style={{background: m.season ? sColor : "var(--bark2)", opacity:.7}}/>

      <div className="mp-head">
        <div className="mp-title-row">
          <div className="mp-month-name">
            {SEASON_EMOJIS[m.month]} {m.month}
            {m.season && <span className="mp-season-tag">{m.season}</span>}
          </div>
          {isCurrent && <span className="this-month-badge">Now</span>}
        </div>
        <div className="mp-stats">
          {m.sunHours!=null && <div className="mp-stat">☀️ {m.sunHours}h / day</div>}
          {isActive && !m.sunHours && <Shimmer lines={1}/>}
        </div>
      </div>

      <div className="mp-body">
        {/* 1. Things to do */}
        <div className="mp-section-label tasks-lbl">Things to do</div>
        {m.tasks.length > 0 || m._taskPartial ? (
          <ul className="mp-list">
            {m.tasks.map((t,j)=><li key={j}><span className="bullet-task">›</span>{t}</li>)}
            {m._taskPartial && isActive && (
              <li key="tp"><span className="bullet-task">›</span><span className="typing-cursor">{m._taskPartial}</span></li>
            )}
          </ul>
        ) : <Shimmer lines={3}/>}

        {/* 2. What to enjoy */}
        <div className="mp-section-label enjoy-lbl">What to enjoy</div>
        {m.enjoy.length > 0 || m._enjoyPartial ? (
          <ul className="mp-list">
            {m.enjoy.map((e,j)=><li key={j}><span className="bullet-enjoy">✿</span>{e}</li>)}
            {m._enjoyPartial && isActive && (
              <li key="ep"><span className="bullet-enjoy">✿</span><span className="typing-cursor">{m._enjoyPartial}</span></li>
            )}
          </ul>
        ) : <Shimmer lines={2}/>}

        {/* 3. For inspiration — on-demand, only on current + next 2 months */}
        {showInspoButton && (
          <div style={{marginTop:"1rem"}}>
            <div className="mp-section-label inspo-lbl">For inspiration</div>
            {!inspo || inspo.state === "idle" ? (
              <button className="btn-inspo" onClick={onFetchInspo}>
                🌿 Where to visit in {m.month}
              </button>
            ) : inspo.state === "loading" ? (
              <div className="inspo-loading">
                <span className="spin-sm">◌</span> Finding the best garden for {m.month}…
              </div>
            ) : inspo.state === "error" ? (
              <div style={{display:"flex",flexDirection:"column",gap:".4rem"}}>
                <div style={{fontSize:".8rem",color:"var(--bloom)",fontStyle:"italic"}}>Couldn't find a suggestion — try again</div>
                <button className="btn-inspo" onClick={onFetchInspo}>↺ Retry</button>
              </div>
            ) : inspo.data ? (
              <div className="inspo-block">
                <div className="inspo-name">{inspo.data.name}</div>
                {inspo.data.organisation && (
                  <div style={{fontSize:".75rem",color:"var(--clay)",opacity:.8,marginBottom:".15rem"}}>{inspo.data.organisation}</div>
                )}
                {inspo.data.location && (
                  <div className="inspo-detail">
                    {inspo.data.location}{inspo.data.distance ? ` · ${inspo.data.distance}` : ""}
                  </div>
                )}
                {inspo.data.highlight && <div className="inspo-text">{inspo.data.highlight}</div>}
                <button className="btn-inspo" style={{marginTop:".7rem"}} onClick={onFetchInspo}>↺ Try somewhere else</button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── InsightsPanel ───────────────────────────────────────────────────────────
function InsightsPanel({insights, plantMeta, onFetch, hasPlants, stream1Done, totalPlantCount}) {
  const [open, setOpen] = useState(false);
  const canUnlock = stream1Done && hasPlants;
  const handleUnlock = () => { setOpen(true); onFetch(); };

  // Count how many plants have GBIF occurrence data loaded
  const gbifCount = Object.values(plantMeta||{}).filter(m => m?.occurrence != null).length;

  return (
    <div className="insights-panel">
      <div className="insights-unlock">
        <span className="insights-title">🔍 Insights about your garden</span>
        {!open ? (
          <button className="btn-unlock" onClick={handleUnlock} disabled={!canUnlock}
            title={!canUnlock ? "Available once calendar is generated" : ""}>
            {canUnlock ? "Unlock insights" : "Available after generating"}
          </button>
        ) : (
          <button className="btn-unlock" onClick={onFetch}
            disabled={insights.state==="loading"} style={{fontSize:".78rem"}}>
            {insights.state==="loading" ? "Thinking…" : "↺ Refresh"}
          </button>
        )}
      </div>

      {open && (
        <div className="insights-body">
          {insights.state === "loading" && (
            <div style={{padding:".5rem 0"}}><Shimmer lines={4}/></div>
          )}
          {insights.state === "error" && (
            <div style={{fontSize:".85rem",color:"var(--bloom)",fontStyle:"italic",padding:".4rem 0"}}>
              Couldn't load insights — try refreshing.
            </div>
          )}
          {insights.state === "done" && insights.allLookingGood && (
            <div className="insights-good">✓ {insights.goodNewsLine || "Your plant selection looks well-suited to this location — happy growing!"}</div>
          )}
          {insights.state === "done" && (insights.items||[]).map((item,i) => (
            <div key={i} className="insight-item">
              <div className="insight-plant">{item.plant}
                {plantMeta?.[item.plant]?.occurrence?.count != null && (
                  <span className="gbif-occ-badge">
                    {plantMeta[item.plant].occurrence.count === 0
                      ? "· no local GBIF records"
                      : `· ${plantMeta[item.plant].occurrence.count} local records`}
                  </span>
                )}
              </div>
              <div className="insight-q">{item.question}</div>
              <div className="insight-ctx">{item.context}</div>
              <div className="insight-tip">{item.suggestion}</div>
            </div>
          ))}
          {insights.state === "done" && gbifCount > 0 && (
            <div className="gbif-attribution">
              Regional occurrence data: <a href="https://gbif.org" target="_blank" rel="noopener" style={{color:"inherit"}}>GBIF</a>
              {" · "}names: <a href="https://powo.science.kew.org" target="_blank" rel="noopener" style={{color:"inherit"}}>Plants of the World Online</a> / WCVP (Royal Botanic Gardens, Kew)
              {" · "}{gbifCount} of {totalPlantCount} plants checked
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GardenCalendar() {
  const [apiKey,setApiKey]   = useState("");
  const [city,setCity]       = useState("");
  const [rateLimitMsg,setRateLimitMsg] = useState("");
  // iNat localised suggestions: { trees: ["Rose","Lavender",...], ... }
  const [localSuggestions, setLocalSuggestions] = useState({});
  // Per-category loading state: { trees: "loading"|"ready"|"fallback"|null }
  const [suggestionState, setSuggestionState] = useState({});
  const [orientation,setOri] = useState("");
  const [plants,setPlants]   = useState({trees:[],shrubs:[],flowers:[],vegetables:[],fruit:[],herbs:[]});
  const [features,setFeatures] = useState([]);
  // plantMeta: { [plantName]: { status, scientificName, genus, clarificationRule, clarificationAnswer, occurrence } }
  const [plantMeta,setPlantMeta] = useState({});
  const plantMetaRef = useRef({});
  const [meta,setMeta]               = useState(null);
  const metaRef = useRef(null);
  // Keep refs in sync so async callbacks read current state
  useEffect(() => { plantMetaRef.current = plantMeta; }, [plantMeta]);
  useEffect(() => { metaRef.current = meta; }, [meta]);

  const onPlantAdded = useCallback(async (name) => {
    // Use ref-style check via functional updater to avoid stale closure
    setPlantMeta(prev => {
      if (prev[name]) return prev; // already validated or loading
      // Kick off async validation outside the updater
      validatePlantName(name).then(result =>
        setPlantMeta(p => ({ ...p, [name]: result }))
      );
      return { ...prev, [name]: { status: "loading", name } };
    });
  }, []);

  const onClarify = useCallback((name, answer) => {
    setPlantMeta(prev => ({
      ...prev,
      [name]: { ...prev[name], clarificationAnswer: answer }
    }));
  }, []);
  const [prefetchState,setPfState]   = useState("idle");
  const [stage,setStage]             = useState("form");
  const [months,setMonths]           = useState({});
  const [stream1Done,setS1Done]      = useState(false);
  const [activeMonth,setActiveMonth] = useState(null);
  const [pageIdx,setPageIdx]         = useState(0);
  const [error,setError]             = useState("");
  // Per-month inspiration: { "January": { state:"idle"|"loading"|"done"|"error", data:{...}|null } }
  const [inspos,setInspos]           = useState({});
  const [insights,setInsights]       = useState({state:"idle", items:[]});
  const [showArrow,setShowArrow]     = useState(false);
  const [chunkCount,setChunkCount]   = useState(0);  // live chunk counter for stall diagnosis
  const chunkCountRef                = useRef(0);

  const prefetchIdRef = useRef(0);
  const submitIdRef   = useRef(0);
  const abortRef      = useRef(null);
  const parserRef     = useRef(null);
  const uiIntervalRef = useRef(null);
  const calTopRef     = useRef(null);
  const monthRefs     = useRef({});  // name -> DOM node
  const scrollArrowRef = useRef(null);

  const nowIdx  = new Date().getMonth();
  const nowName = MONTH_NAMES[nowIdx];
  const totalPlants = Object.values(plants).flat().length;


  // ── Prefetch meta ──────────────────────────────────────────────────────────
  const prefetchMeta = useCallback(async (c,o) => {
    if (!c||!o) return;
    const rid = ++prefetchIdRef.current;
    setPfState("fetching"); setMeta(null);
    try {
      // Step 1: Get lat/lng from Claude (lightweight call — just geocoding + references)
      const geoResult = await callClaude(`Location: ${c}.
Return ONLY valid JSON — no markdown, no explanation:
{"lat":<decimal latitude>,"lng":<decimal longitude>,"references":[{"category":"Climate","sources":["<source 1>","<source 2>"]},{"category":"Plant care","sources":["<source 1>","<source 2>"]},{"category":"Phenology","sources":["<source 1>","<source 2>"]},{"category":"Wildlife","sources":["<source 1>","<source 2>"]},{"category":"Gardens","sources":["<source 1>","<source 2>","<source 3>"]},{"category":"Broadcasters","sources":["<name 1>","<name 2>","<name 3>"]}]}
Rules:
- Each category: 2-3 distinct real organisations or publications
- Climate: national met service, major broadcaster weather, local services for this region
- Plant care: leading horticultural institutions for this country (e.g. RHS and Kew for UK)
- Phenology: citizen science and academic phenology networks for this region
- Wildlife: leading wildlife charities or ornithological societies for this country
- Gardens near ${c}: mix from national heritage trusts, royal/state parks, local botanic gardens — NOT always the same institution
- Broadcasters: 2-3 gardening broadcasters, presenters, or writer-practitioners who are well known in the country or region of ${c}. Real people who present gardening on TV, radio, or major publications. For UK: e.g. Monty Don, Carol Klein, Sarah Raven. Choose equivalents for other regions.
- No source repeated across categories`, 700, undefined, apiKey);
      if (rid!==prefetchIdRef.current) return;

      // Step 2: Fetch real climate data from OpenMeteo
      const hemisphere = detectHemisphere(geoResult.lat);
      const cd = await fetchOpenMeteoClimate(geoResult.lat, geoResult.lng);
      if (rid!==prefetchIdRef.current) return;
      const derived = deriveClimateFromOM(cd, hemisphere);

      setMeta({
        lat: geoResult.lat, lng: geoResult.lng,
        zone: derived.zone,
        lastFrost: derived.lastFrost || "none",
        firstFrost: derived.firstFrost || "none",
        climate: derived.climateType,
        hemisphere,
        references: geoResult.references,
        // Store full climate data for prompt building
        _cd: cd, _derived: derived,
      });
      setPfState("ready");

      // Step 3: Load iNat localised suggestions lazily per category
      const climateZone = getClimateZone(cd);
      const catKeys = Object.keys(CAT_TO_SEED);
      // Mark all categories as loading
      setSuggestionState(Object.fromEntries(catKeys.map(k => [k, "loading"])));
      setLocalSuggestions({});
      // Load categories sequentially to avoid throttling
      (async () => {
        const newSuggestions = {};
        const newStates = {};
        for (const catKey of catKeys) {
          try {
            const result = await fetchInatSuggestions(catKey, geoResult.lat, geoResult.lng);
            const useFallback = !result || result.sparse;
            if (useFallback) {
              newSuggestions[catKey] = (CLIMATE_FALLBACKS[climateZone] ?? CLIMATE_FALLBACKS.temperate)[catKey] ?? [];
              newStates[catKey] = "fallback";
            } else {
              newSuggestions[catKey] = result.ranked.map(r => r.common);
              newStates[catKey] = "ready";
            }
            // Update state progressively as each category finishes
            setLocalSuggestions(prev => ({ ...prev, [catKey]: newSuggestions[catKey] }));
            setSuggestionState(prev => ({ ...prev, [catKey]: newStates[catKey] }));
          } catch {
            // On error fall back to climate preset
            const fallback = (CLIMATE_FALLBACKS[climateZone] ?? CLIMATE_FALLBACKS.temperate)[catKey] ?? [];
            setLocalSuggestions(prev => ({ ...prev, [catKey]: fallback }));
            setSuggestionState(prev => ({ ...prev, [catKey]: "fallback" }));
          }
          // Small gap between categories
          await new Promise(r => setTimeout(r, 500));
        }
      })();
    } catch(e) {
      if (rid===prefetchIdRef.current) setPfState("error");
    }
  },[]);

  // ── Wake-up ping — fires once on mount to pre-warm Render free tier ──────
  useEffect(() => {
    if (PROXY_BASE && !isArtifact()) {
      fetch(`${PROXY_BASE}/api/health`, { method:"GET" }).catch(()=>{});
    }
  }, []);

  useEffect(()=>{
    if (city&&orientation&&(!isArtifact()||apiKey)) prefetchMeta(city,orientation);
    else { setPfState("idle"); setMeta(null); }
  },[city,orientation,apiKey,prefetchMeta]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!city||!orientation) { setError("Please fill in city and orientation."); return; }
    setRateLimitMsg("");
    // Abort previous stream and yield a tick so the abort settles before we start fresh
    if (abortRef.current) { abortRef.current.abort(); }
    if (parserRef.current) { parserRef.current.cancel(); parserRef.current = null; }
    if (uiIntervalRef.current) { clearInterval(uiIntervalRef.current); uiIntervalRef.current = null; }
    // Yield long enough for the aborted fetch to settle and any pending timers to clear
    await new Promise(r => setTimeout(r, 50));
    const abort = new AbortController();
    abortRef.current = abort;
    const rid = ++submitIdRef.current;

    setError(""); setStage("calendar");
    setS1Done(false); setActiveMonth(null);
    unlockedPages.current = new Set();
    userNavigatedRef.current = false;
    setInspos({}); setInsights({state:"idle", items:[]});
    setShowArrow(true);
    // Clear stale occurrence data from previous run — keeps species/clarification data intact
    setPlantMeta(prev => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => { next[k] = { ...v, occurrence: undefined }; });
      return next;
    });
    // Scroll to top of page after a tick so the calendar view has mounted
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    // Initialise all months as pending
    const init = {};
    MONTH_NAMES.forEach(n=>{ init[n]=emptyMonth(n); });
    setMonths(init);

    // offset 0 shows [prev, current, next] — current month is the middle panel
    setPageIdx(0);

    const featuresCtx = features.length ? ` Garden features: ${features.join(", ")}.` : "";
    const now = `${MONTH_NAMES[nowIdx]} ${new Date().getFullYear()}`;

    // Build the 12-month sequence starting one month before current, wrapping around
    const startIdx = (nowIdx + 11) % 12;
    const orderedMonths = Array.from({length:12}, (_,i) => MONTH_NAMES[(startIdx + i) % 12]);

    // Ensure meta — wait for prefetch if in progress, reuse if ready, fetch fresh only if idle
    let m = null;
    let occurrenceByName = {}; // populated after GBIF checks, used to build allPlants
    try {
        // If prefetch already has real climate data, reuse it immediately
        if (metaRef.current?._cd && metaRef.current?.lat && metaRef.current?.lng) {
          m = metaRef.current;
        } else if (prefetchState === "fetching") {
          // Prefetch is in flight — poll for up to 15s rather than making a duplicate call
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (metaRef.current?._cd) { m = metaRef.current; break; }
            if (rid !== submitIdRef.current) return;
          }
          if (!m) { setError("Climate data timed out. Please try again."); return; }
        } else {
          // Fallback: geocode + fetch OpenMeteo
          const geoResult = await callClaude(`Location: ${city}.
Return ONLY valid JSON — no markdown, no explanation:
{"lat":<decimal latitude>,"lng":<decimal longitude>,"references":[{"category":"Climate","sources":["<source 1>","<source 2>"]},{"category":"Plant care","sources":["<source 1>","<source 2>"]},{"category":"Phenology","sources":["<source 1>","<source 2>"]},{"category":"Wildlife","sources":["<source 1>","<source 2>"]},{"category":"Gardens","sources":["<source 1>","<source 2>","<source 3>"]},{"category":"Broadcasters","sources":["<name 1>","<name 2>","<name 3>"]}]}
Rules:
- Each category: 2-3 distinct real organisations or publications
- Climate: national met service, major broadcaster weather, local services for this region
- Plant care: leading horticultural institutions for this country (e.g. RHS and Kew for UK)
- Phenology: citizen science and academic phenology networks for this region
- Wildlife: leading wildlife charities or ornithological societies for this country
- Gardens near ${city}: mix from national heritage trusts, royal/state parks, local botanic gardens
- Broadcasters: 2-3 real gardening presenters well known in the country or region of ${city}
- No source repeated across categories`, 700, abort.signal, apiKey);
          if (rid!==submitIdRef.current) return;
          const hemisphere = detectHemisphere(geoResult.lat);
          const cd = await fetchOpenMeteoClimate(geoResult.lat, geoResult.lng);
          if (rid!==submitIdRef.current) return;
          const derived = deriveClimateFromOM(cd, hemisphere);
          m = {
            lat: geoResult.lat, lng: geoResult.lng,
            zone: derived.zone,
            lastFrost: derived.lastFrost || "none",
            firstFrost: derived.firstFrost || "none",
            climate: derived.climateType,
            hemisphere,
            references: geoResult.references,
            _cd: cd, _derived: derived,
          };
        }
        if (rid===submitIdRef.current) {
          setMeta(m);
          // Fire GBIF occurrence checks for ALL plants and AWAIT them before building prompt
          // Uses scientific name if validated, raw name otherwise (catches plants like coconut)
          if (m?.lat && m?.lng) {
            try {
              const allPlantNames = Object.values(plants).flat();
              // Concurrent in batches of 5 — fast enough, avoids GBIF rate limiting
              const BATCH = 5;
              const occResults = [];
              for (let i = 0; i < allPlantNames.length; i += BATCH) {
                const batch = allPlantNames.slice(i, i + BATCH);
                const batchResults = await Promise.all(batch.map(async plantName => {
                  try {
                    const meta = plantMetaRef.current[plantName];
                    const queryName = meta?.scientificName || COMMON_TO_SCIENTIFIC[plantName.toLowerCase()] || plantName;
                    const occ = await checkRegionalOccurrence(queryName, m.lat, m.lng);
                    return { plantName, occ };
                  } catch {
                    return { plantName, occ: null };
                  }
                }));
                occResults.push(...batchResults);
                if (i + BATCH < allPlantNames.length) await new Promise(r => setTimeout(r, 200));
              }
              // Batch update plantMeta with all occurrence results
              setPlantMeta(prev => {
                const next = { ...prev };
                occResults.forEach(({ plantName, occ }) => {
                  if (occ !== null) {
                    next[plantName] = { ...(next[plantName]||{}), occurrence: occ };
                  }
                });
                return next;
              });
              // Build occurrenceByName for immediate use in prompt (before React re-renders)
              occurrenceByName = {};
              occResults.forEach(({ plantName, occ }) => {
                if (occ !== null) occurrenceByName[plantName] = occ;
              });
            } catch {
              // GBIF batch failed entirely — continue without occurrence data
            }
          }
        }
    } catch(e) {
      if (e.name==="AbortError") return;
      if (e.isRateLimit) { setRateLimitMsg(e.message); return; }
      setError("Failed to fetch climate data."); return;
    }

    // Build rich climate context from real OpenMeteo data
    const metaCtx = m?._cd && m?._derived
      ? `\nREAL CLIMATE DATA for ${city} (10-year averages, Open-Meteo/ERA5):\n${buildClimateContext(m._cd, m._derived)}`
      : m ? `Zone:${m.zone}. Last frost:${m.lastFrost}. First frost:${m.firstFrost}. Climate:${m.climate}.` : "";

    // Build allPlants NOW — after occurrence data is available in occurrenceByName
    // enrichedPlantName reads from plantMeta but React hasn't re-rendered yet,
    // so we pass occurrence data directly via a local lookup
    const allPlants = Object.entries(plants).map(([k,v])=>v.length
      ? `${k}: ${v.map(p => {
          const meta = plantMetaRef.current[p] || {};
          const occ = occurrenceByName[p] ?? meta.occurrence ?? null;
          const metaWithOcc = { ...meta, occurrence: occ };
          return enrichedPlantName(p, metaWithOcc);
        }).join(", ")}`
      : null).filter(Boolean).join(" | ")||"general/unspecified mix";

    // ── STREAM 1: line-format tasks + enjoy ──────────────────────────────────
    const s1prompt = `You are an expert horticulturist and naturalist.
Location: ${city}. Orientation: ${orientation}. Plants: ${allPlants}.${featuresCtx} Date: ${now}. ${metaCtx}

Output EXACTLY 12 blocks in this order: ${orderedMonths.join(", ")}.
Use ONLY this exact line format. No extra text, no markdown, no explanation.

MONTH:February
SEASON:Winter
SUN:2.5
TASK:Cut ALL autumn-fruiting raspberry canes to ground level, clearing old growth
TASK:Sow sweet peas singly in 7cm root trainers on a bright frost-free windowsill
ENJOY:Forsythia — tight yellow buds swelling on bare stems, days from opening
ENJOY:Blackbird — males singing territorial song from the apple tree at first light
---
MONTH:June
SEASON:Summer
SUN:7.5
TASK:Trim rosemary and thyme lightly after flowering, cutting only green leafy growth
TASK:Pot up strawberry runners into 9cm pots, pinning into compost while still attached
TASK:Pinch fig shoot tips to 5 leaves to concentrate energy into swelling fruitlets
TASK:Harvest courgettes when 15–20cm, checking every 2 days to prevent marrow formation
ENJOY:Swift — screaming low over the raised beds in tight formation, hawking insects
ENJOY:Lavender — first purple spikes opening at the tips, bees working methodically upward
---

ENJOY RULE — apply before writing every ENJOY line:
Each observation must capture something actively happening or transitioning THIS specific month — an emergence, arrival, behaviour, or sensory shift. Never a static description of appearance.
SCALE RULE — this is a residential town garden, NOT a stately home or nature reserve. Every wildlife observation must be plausible in a small urban garden. Ask: could a person realistically see this from their kitchen window in a city?
PASS: Robin singing from a fence post. Blackbird foraging under shrubs. Swift passing overhead. Bumblebee on lavender.
FAIL: Murmuration of starlings (landscape-scale). Barn owl hunting (farmland). Deer grazing. Red kite circling (rural).
GOOD: "Forsythia — tight yellow buds swelling on bare stems, days from opening"
GOOD: "Swift — screaming low over the raised beds in tight formation, hawking insects"
BAD: "Lavender — purple flowers in the garden" / "Roses — beautiful blooms"

COVERAGE MANDATE — plan this before writing any months.
Use 3 task slots in winter months (Nov–Mar) and up to 4 in peak months (Apr–Oct). Every plant in the inventory must appear by name in at least one TASK with an appropriate task type. Required task types per plant type:
- Fruit trees (apple, pear, fig): prune + harvest
- Spring-flowering shrubs (forsythia, camellia, lilac): prune after flowering
- Summer-flowering shrubs (hydrangea, buddleja): prune in spring before growth
- Mediterranean shrubs (lavender, rosemary, sage, thyme): light trim after flowering only
- Bulbs (tulip, allium, daffodil): plant in autumn + lift/store after foliage dies
- Perennials (peony, salvia, geranium): mulch or divide at least once
- Fruiting vegetables (tomatoes, courgettes, peppers): sow + harvest + pest monitor
- Climbing/podding veg (runner beans, peas): sow + harvest
- Soft fruit (strawberries, raspberries, currants): prune + harvest
- Herbs: light trim after flowering

LIFECYCLE RULES — apply before every pruning task:
- Forsythia, Camellia and other spring-bloomers: flower Feb–Apr on last year's wood. Prune ONLY May–Jun after flowering. NEVER suggest pruning Jan–Apr.
- Hydrangea (mophead/lacecap): leave flowerheads ALL winter for frost protection. Prune in April only, after last frost risk passes, cutting to first pair of fat buds.
- Lavender: trim in August after flowering to base of spike. Spring: remove frost-damaged tips 2–3cm max only. NO hard prune ever.
- Rosemary, Thyme, Sage: FULLY HARDY in most UK and temperate climates — do NOT suggest lifting or bringing indoors for winter. Light trim after flowering only. Never cut into old leafless wood.
- Apple: summer prune new laterals to 3 leaves above basal cluster (Jul–Aug). Structural prune late Feb only — not January.
- Raspberries: autumn-fruiting → cut ALL canes to ground level in Feb. Summer-fruiting → cut only fruited canes after harvest in Aug.

TIMING RULES — use the real climate data above, not assumptions:
- Last spring frost ${m?._derived?.lastFrost || m?.lastFrost || "mid-March"}: no tender crops outdoors before this.
- First autumn frost ${m?._derived?.firstFrost || m?.firstFrost || "mid-November"}: harvest or protect tender crops before this.
- If frost-free year-round: no cold protection tasks needed. Focus on wet/dry season and heat management.
- Lawn feed: spring/summer blend only. NEVER apply during coldest 3 months.
- ${m?._derived?.seasonNote ? `HEMISPHERE/SEASON: ${m._derived.seasonNote}` : ""}

INVENTORY RULE: ONLY suggest tasks for plants listed in this garden. Do NOT introduce unlisted plants. Always refer to plants by their common name as listed — never use scientific names in task or enjoy text.

SPECIFICITY RULE: Every TASK must include a measurement, plant part, method, or timing cue.
FAIL: "Prune apple" / "Feed lawn" / "Check for pests" / "Water plants"
PASS: "Summer prune apple laterals to 3 leaves above basal cluster" / "Apply 35g/m² balanced granular feed" / "Inspect tomato leaves weekly for early blight — remove affected leaves immediately"

ENJOY FORMAT: Start every ENJOY line with the subject (plant, bird, insect or phenomenon) followed by an em-dash, then a short concrete observation.

Other rules:
- SUN: avg daily hours adjusted for ${orientation}. One decimal.
- TASK: 3 lines in winter months (Nov–Mar); up to 4 lines in peak months (Apr–Oct). Include at least one task referencing a garden feature (${features.length ? features.join(", ") : "any features present"}) where seasonally relevant.
- ENJOY: exactly 2 lines. At least one wildlife or seasonal visitor.
- SEASON: Winter/Spring/Summer/Autumn only
- End each block with ---
- Output all 12 months in order. NO other text.`;

    const parser1 = makeLineParser((snapshot) => {
      if (rid!==submitIdRef.current) return;
      const active = Object.values(snapshot).find(m=>m._state==="active");
      setActiveMonth(active ? active.month : null);
      setMonths(prev => {
        const next = { ...prev };
        Object.keys(snapshot).forEach(k => { next[k] = snapshot[k]; });
        return next;
      });
    });
    parserRef.current = parser1;

    chunkCountRef.current = 0;
    setChunkCount(0);

    // Drive UI updates at 50ms intervals — completely decoupled from chunk rate
    uiIntervalRef.current = setInterval(() => {
      parser1.doFlush();
      setChunkCount(chunkCountRef.current); // sync chunk count to React
    }, 50);

    // Stall detector — if no chunks for 22s, abort and show error
    let lastChunkAt = Date.now();
    const stallTimer = setInterval(() => {
      if (Date.now() - lastChunkAt > 22000) {
        clearInterval(stallTimer);
        abort.abort();
        clearInterval(uiIntervalRef.current); uiIntervalRef.current = null;
        setError("Stream stalled — no data received for 20 seconds. Please try again.");
      }
    }, 2000);

    try {
      await streamClaude(s1prompt, 12000, (chunk) => {
        chunkCountRef.current++;
        lastChunkAt = Date.now();
        parser1.onChunk(chunk);
      }, abort.signal, apiKey);
      parser1.flush();
    } catch(e) {
      clearInterval(stallTimer);
      clearInterval(uiIntervalRef.current); uiIntervalRef.current = null;
      if (e.name==="AbortError"||rid!==submitIdRef.current) return;
      if (e.isRateLimit) { setRateLimitMsg(e.message); return; }
      setError("Stream failed: "+e.message); return;
    }
    clearInterval(stallTimer);
    clearInterval(uiIntervalRef.current); uiIntervalRef.current = null;
    if (rid!==submitIdRef.current) return;
    // Mark all remaining active months as done
    setMonths(prev => {
      const next={...prev};
      Object.keys(next).forEach(k=>{ if(next[k]._state==="active") next[k]={...next[k],_state:"done",_taskPartial:null,_enjoyPartial:null}; });
      return next;
    });
    setS1Done(true); setActiveMonth(null);
    setShowArrow(false);
  };

  const resetAll = () => {
    if (abortRef.current) abortRef.current.abort();
    if (parserRef.current) { parserRef.current.cancel(); parserRef.current = null; }
    if (uiIntervalRef.current) { clearInterval(uiIntervalRef.current); uiIntervalRef.current = null; }
    ++prefetchIdRef.current; ++submitIdRef.current;
    unlockedPages.current = new Set();
    setStage("form"); setMeta(null); setMonths({}); setInspos({}); setInsights({state:"idle",items:[]});
    setPfState("idle"); setS1Done(false); setError(""); setRateLimitMsg(""); setShowArrow(false); setFeatures([]); setPlantMeta({});
  };

  // ── On-demand inspiration fetch for a single month ────────────────────────
  const fetchInspo = async (monthName) => {
    
    setInspos(prev => ({ ...prev, [monthName]: { state:"loading", data:null } }));
    const now = `${MONTH_NAMES[nowIdx]} ${new Date().getFullYear()}`;

    // Build exclusion list: all other chosen gardens + the current month's own suggestion if retrying
    const alreadyChosen = Object.entries(inspos)
      .filter(([_, v]) => v?.data?.name)
      .map(([_, v]) => v.data.name);
    const exclusionClause = alreadyChosen.length > 0
      ? `\nDo NOT suggest any of these gardens (already used for other months):\n${alreadyChosen.map(n=>`- ${n}`).join("\n")}\nChoose a genuinely different garden.`
      : "";

    try {
      const result = await callClaude(`You are a public gardens expert near ${city}.
Month: ${monthName}. Date: ${now}.

Recommend ONE real public garden within 1-2 hours of ${city} worth visiting in ${monthName}.
Return ONLY valid JSON, no markdown:
{
  "name": "<Real garden name>",
  "organisation": "<e.g. National Trust / Royal Parks / local authority / independent>",
  "location": "<Town, Region>",
  "distance": "<travel time from ${city}>",
  "highlight": "<Specific plant or feature in ${monthName} — name actual plant, 10-20 words>"
}
Rules:
- Real, publicly accessible garden only
- Draw from a WIDE range of operators: National Trust, Royal Parks, Historic England, Kew, local boroughs, independent — not always RHS
- highlight must name the specific plant or seasonal feature (not vague phrases)
- highlight must be 10-20 words${exclusionClause}`, 400, undefined, apiKey);

      // Guard against vague highlights — require at least 8 words
      const wordCount = (result.highlight || "").trim().split(/\s+/).length;
      if (wordCount < 8) result.highlight = result.highlight + " — visit for the seasonal garden highlights";

      setInspos(prev => ({ ...prev, [monthName]: { state:"done", data:result } }));
    } catch(e) {
      setInspos(prev => ({ ...prev, [monthName]: { state:"error", data:null } }));
    }
  };
  // ── Garden insights — climate suitability analysis ────────────────────────
  const fetchInsights = async () => {
    if (totalPlants === 0) return;
    setInsights({state:"loading", items:[]});
    const allPlants = Object.entries(plants).map(([k,v])=>v.length?`${k}: ${v.join(", ")}`:null).filter(Boolean).join(" | ");
    const featuresCtx = features.length ? ` Garden features: ${features.join(", ")}.` : "";
    const metaCtx = meta ? `Zone: ${meta.zone}. Climate: ${meta.climate}. Last frost: ${meta.lastFrost}. First frost: ${meta.firstFrost}.` : "";
    // Build GBIF occurrence context string for the prompt
    const occurrenceCtx = Object.entries(plantMeta)
      .filter(([,m]) => m?.occurrence != null && m?.scientificName && m.occurrence.count < 1000000)
      .map(([name, m]) => {
        const c = m.occurrence.count;
        const level = c === 0 ? "no GBIF records near location — likely unsuitable"
          : c < 10  ? `${c} GBIF records near location — rarely recorded`
          : c < 50  ? `${c} GBIF records near location — occasionally recorded`
          : c < 200 ? `${c} GBIF records near location — well established`
          : `${c} GBIF records near location — very common`;
        return `${name} (${m.scientificName}): ${level}`;
      }).join("\n");

    try {
      const result = await callClaude(`You are a knowledgeable, curious gardening friend — warm and non-alarmist in tone.
Location: ${city}. Orientation: ${orientation}. ${metaCtx}
Plants in this garden: ${allPlants}${featuresCtx}
${occurrenceCtx ? `\nRegional occurrence data from GBIF (citizen science records within ~50km):\n${occurrenceCtx}\n` : ""}
Review the plant list for any worth a gentle conversation given this climate and location.
Consider cold hardiness, heat needs, sun/shade, and regional suitability.
Where GBIF records are available, use occurrence count as supporting evidence — low counts may indicate marginal suitability.

Return ONLY valid JSON, no markdown:
{
  "allLookingGood": true,
  "goodNewsLine": "<warm 1-sentence sign-off if all fine, else null>",
  "items": [
    {
      "plant": "<name>",
      "question": "<curious non-alarming question e.g. 'How is your fig coping in colder winters?'>",
      "context": "<1 sentence: the specific challenge for this location>",
      "suggestion": "<1 concrete tip: hardier variety, microclimate advice, or alternative>"
    }
  ]
}
Rules:
- Max 4 items. Only flag genuine concerns — skip anything broadly suitable.
- If everything suits the location well, allLookingGood:true and empty items array.
- Tone: curious and encouraging. "How is X doing?" not "X will fail."
- context + suggestion together under 35 words per item.`, 700, undefined, apiKey);
      setInsights({state:"done", items:result.items||[], allLookingGood:result.allLookingGood, goodNewsLine:result.goodNewsLine});
    } catch(e) {
      setInsights({state:"error", items:[]});
    }
  };

  // offset 0 = months[0,1,2], offset 1 = months[1,2,3] … offset 9 = months[9,10,11]
  // orderedMonths is built in handleSubmit; mirror it here for nav use
  const startIdx = (nowIdx + 11) % 12;
  const orderedForNav = Array.from({length:12}, (_,i) => MONTH_NAMES[(startIdx + i) % 12]);
  const MAX_OFFSET = 9; // 12 - 3

  // Track permanently unlocked offsets — once all 3 months at that offset are done, stays unlocked
  const unlockedPages = useRef(new Set());
  const isOffsetDone = (oi) => orderedForNav.slice(oi, oi+3).every(n => months[n] && months[n]._state === "done");
  for (let i = 0; i <= MAX_OFFSET; i++) { if (isOffsetDone(i)) unlockedPages.current.add(i); }
  const offsetReady = (oi) => unlockedPages.current.has(oi);

  // Track whether user has manually navigated — suppress auto-advance if so
  const userNavigatedRef = useRef(false);

  // Auto-advance the visible window to follow the active streaming month
  // Only fires if user hasn't manually navigated back
  useEffect(() => {
    if (!activeMonth || stream1Done) return;
    if (userNavigatedRef.current) return; // user took control — don't override
    const monthOrderIdx = orderedForNav.indexOf(activeMonth);
    if (monthOrderIdx < 0) return;
    const lastVisibleIdx = pageIdx + 2;
    if (monthOrderIdx > lastVisibleIdx) {
      const newOffset = Math.min(monthOrderIdx - 2, MAX_OFFSET);
      setPageIdx(newOffset);
    }
  }, [activeMonth]);
  const canLeft  = pageIdx > 0; // always allow going back
  const activeOffset = activeMonth ? orderedForNav.indexOf(activeMonth) : -1;
  // canRight: allow if next offset is fully ready, OR if streaming and active month is exactly in the next offset window
  const nextOffsetIsActive = !stream1Done && activeOffset >= 0 && activeOffset >= pageIdx+1 && activeOffset <= pageIdx+3;
  const canRight = pageIdx < MAX_OFFSET && (offsetReady(pageIdx + 1) || nextOffsetIsActive);

  const visibleNames = orderedForNav.slice(pageIdx, pageIdx + 3);
  const stillStreaming = !stream1Done;

  const pfLabel = {
    idle:null,
    fetching:<span className="prefetch-chip active"><span className="spin-sm">◌</span> Fetching climate data…</span>,
    ready:<span className="prefetch-chip ready">✓ Climate data ready · Open-Meteo/ERA5</span>,
    error:<span className="prefetch-chip error">⚠ Will retry on generate</span>,
  }[prefetchState];

  const slowScroll = () => {
    // Don't hide the arrow — keep it showing throughout streaming
    const targetEl = (activeMonth && monthRefs.current[activeMonth])
      ? monthRefs.current[activeMonth]
      : calTopRef.current;
    if (!targetEl) return;
    const targetY = targetEl.getBoundingClientRect().top + window.scrollY - 20;
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (Math.abs(dist) < 10) return; // already there
    const duration = Math.min(Math.max(Math.abs(dist) * 2.5, 800), 4000);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      window.scrollTo(0, startY + dist * ease);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="grain"/>
      <div className="demo-banner">
        <span className="demo-name">NatJulien_Demo</span>
        <span className="demo-sep">·</span>
        <span className="demo-tag">AI-powered garden calendar</span>
        <span className="demo-sep">·</span>
        <span className="demo-tag">Powered by Claude</span>
      </div>
      {showArrow && (
        <button className="float-arrow" onClick={slowScroll} title="Scroll to calendar">
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      )}
      <div className="app">
        <header>
          <div className="deco">✦ ✿ ✦</div>
          <h1>The Garden <em>Calendar</em></h1>
          <p className="subtitle">A personalised year of growing, tending & harvesting</p>
        </header>

        {isArtifact() && stage !== "calendar" && (
          <div className="api-banner">
            <label>🔑 Anthropic API Key</label>
            <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-ant-…"/>
            <p className="api-note">Used only in your browser · Get a key at console.anthropic.com</p>
          </div>
        )}
        {error && <div className="error-box">⚠ {error}</div>}
        {rateLimitMsg && <div className="rate-limit-box">🌿 {rateLimitMsg}</div>}

        {/* ── FORM ── */}
        {stage==="form" && (
          <div className="form-card">
            <div className="form-title">Tell us about your garden</div>
            <p className="form-hint">Fill in location and orientation — climate data fetches in the background while you add your plants</p>
            <div className="field-row">
              <div className="field">
                <label>📍 City & Country</label>
                <input type="text" value={city} onChange={e=>setCity(e.target.value)} placeholder="e.g. Edinburgh, UK"/>
              </div>
              <div className="field">
                <label>🧭 Garden Orientation</label>
                <select value={orientation} onChange={e=>setOri(e.target.value)}>
                  <option value="">Select…</option>
                  {ORIENTATIONS.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
                {pfLabel}
              </div>
            </div>
            <div className="divider"/>
            <p className="section-label">🏡 Garden Features <em>— optional</em></p>
            <div className="category-row">
              <div className="cat-label">🏡 Features</div>
              <TagInput value={features} onChange={setFeatures} placeholder="Add features, press Enter…"/>
              <div className="suggestions">
                {["Lawn","Paving","Pond","Gravel","Raised beds","Greenhouse","Compost"].map(f => {
                  const active = features.map(x=>x.toLowerCase()).includes(f.toLowerCase());
                  return (
                    <button key={f} className={`chip${active?" added":""}`}
                      onClick={()=>{ if(!active) setFeatures(prev=>[...prev,f]); }}
                      type="button">
                      {active ? "✓ " : "+ "}{f}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="divider"/>
            <p className="section-label">🌱 Garden Inventory <em>— optional but recommended</em></p>
            {PLANT_CATEGORIES.map(cat=>(
              <div key={cat.key} className="category-row">
                <div className="cat-label">{cat.icon} {cat.label}</div>
                <TagInput
                  value={plants[cat.key]}
                  onChange={v=>setPlants({...plants,[cat.key]:v})}
                  placeholder={`Add ${cat.label.toLowerCase()}, press Enter…`}
                  onAdd={onPlantAdded}
                />
                {/* Clarification prompts — one per plant that needs it */}
                {plants[cat.key].map(plantName => {
                  const m = plantMeta[plantName];
                  if (!m || m.status !== "valid" || !m.clarificationRule) return null;
                  return (
                    <div key={plantName} className="clarify-row">
                      <span className="clarify-label">{plantName}: {m.clarificationRule.question}</span>
                      {m.clarificationRule.options.map(opt => (
                        <button key={opt}
                          className={`clarify-btn${m.clarificationAnswer===opt?" selected":""}`}
                          onClick={()=>onClarify(plantName, opt)}
                          type="button">
                          {opt}
                        </button>
                      ))}
                      {m.scientificName && (
                        <span className="gbif-badge">· {m.scientificName} · GBIF/WCVP</span>
                      )}
                    </div>
                  );
                })}
                {/* Spelling suggestions — shown when GBIF resolved a likely correction */}
                {plants[cat.key].map(plantName => {
                  const m = plantMeta[plantName];
                  if (!m?.spellSuggestion) return null;
                  return (
                    <div key={`spell-${plantName}`} className="spell-row">
                      <span>Did you mean</span>
                      <button className="spell-btn" type="button"
                        onClick={() => {
                          // Replace the misspelled entry with the suggestion
                          const corrected = m.spellSuggestion;
                          setPlants(prev => ({
                            ...prev,
                            [cat.key]: prev[cat.key].map(p => p === plantName ? corrected : p)
                          }));
                          setPlantMeta(prev => {
                            const next = { ...prev };
                            next[corrected] = { ...next[plantName], spellSuggestion: null };
                            delete next[plantName];
                            return next;
                          });
                          onPlantAdded(corrected);
                        }}>
                        {m.spellSuggestion}
                      </button>
                      <span style={{opacity:.5}}>· {m.scientificName}</span>
                    </div>
                  );
                })}

                {/* Regional suitability warnings — shown once occurrence data loads */}
                {plants[cat.key].map(plantName => {
                  const m = plantMeta[plantName];
                  if (!m?.occurrence) return null;
                  if (m.occurrence.count === 0 && m.occurrence.matchType === 'EXACT' && m?.scientificName) return (
                    <div key={`occ-${plantName}`} className="occ-warning">
                      ⚠ <strong>{plantName}</strong> — no GBIF records within 300km · likely unsuitable for this location
                      {m.scientificName && <span className="gbif-badge"> · {m.scientificName}</span>}
                      <span className="gbif-badge"> · GBIF</span>
                    </div>
                  );
                  return null;
                })}
                <div className="suggestions">
                  {(() => {
                    const state = suggestionState[cat.key];
                    const suggestions = localSuggestions[cat.key];
                    if (state === "loading") {
                      return (
                        <span style={{fontSize:".75rem",color:"var(--muted)",fontStyle:"italic",opacity:.7}}>
                          🌍 Finding local suggestions…
                        </span>
                      );
                    }
                    if (!suggestions || suggestions.length === 0) return null;
                    return (
                      <>
                        {state === "fallback" && (
                          <span style={{fontSize:".7rem",color:"var(--muted)",fontStyle:"italic",display:"block",marginBottom:".25rem",opacity:.6}}>
                            suggestions for your climate
                          </span>
                        )}
                        {state === "ready" && (
                          <span style={{fontSize:".7rem",color:"var(--muted)",fontStyle:"italic",display:"block",marginBottom:".25rem",opacity:.6}}>
                            popular near you
                          </span>
                        )}
                        {suggestions.map(s => {
                          const added = plants[cat.key].map(p=>p.toLowerCase()).includes(s.toLowerCase());
                          return (
                            <button key={s} className={`chip${added?" added":""}`}
                              onClick={()=>{
                                if(!added){
                                  setPlants(p=>({...p,[cat.key]:[...p[cat.key],s]}));
                                  onPlantAdded(s);
                                }
                              }}
                              type="button">
                              {added ? "✓ " : "+ "}{s}
                            </button>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
            <button className="btn-generate" onClick={handleSubmit} disabled={!city||!orientation||(isArtifact()&&!apiKey)}>
              {prefetchState==="ready"?"✦ Generate My Calendar — Ready!":"✦ Generate My Garden Calendar"}
            </button>
          </div>
        )}

        {/* ── CALENDAR ── */}
        {stage==="calendar" && (
          <div className="cal-wrap">
            <StreamBar months={months} stream1Done={stream1Done} activeMonth={activeMonth} chunkCount={chunkCount}/>

            <div className="cal-header">
              <div className="deco" style={{fontSize:"1.3rem"}}>✦ ✿ ✦</div>
              <h2>Your Garden Calendar</h2>
              <p>{city}{orientation?` · ${orientationShort(orientation)}`:""}</p>
              {meta ? (
                <div className="meta-pills">
                  <div className="pill">🌡 Zone <b>{meta.zone}</b></div>
                  <div className="pill">🌸 Last frost <b>{meta.lastFrost}</b></div>
                  <div className="pill">🍂 First frost <b>{meta.firstFrost}</b></div>
                  <div className="pill">🌤 {meta.climate}</div>
                  {totalPlants>0&&<div className="pill">🌱 <b>{totalPlants}</b> plants tracked</div>}
                </div>
              ) : (
                <div style={{maxWidth:340,margin:"1rem auto 0"}}><Shimmer lines={1}/></div>
              )}
            </div>

            {/* Occurrence warnings — only shown when plant was GBIF-validated (has scientificName)
                 AND returned count=0. Unvalidated plants or proxy failures are silently skipped. */}
            {Object.entries(plantMeta).filter(([,m]) => m?.occurrence?.count === 0 && m?.occurrence?.matchType === 'EXACT' && m?.scientificName).length > 0 && (
              <div style={{maxWidth:"860px",margin:"0 auto .75rem",padding:"0 1rem"}}>
                {Object.entries(plantMeta)
                  .filter(([,m]) => m?.occurrence?.count === 0 && m?.occurrence?.matchType === 'EXACT' && m?.scientificName)
                  .map(([plantName, m]) => (
                    <div key={plantName} className="occ-warning">
                      ⚠ <strong>{plantName}</strong> — no GBIF records within 300km · likely unsuitable for {city}
                      {m.scientificName && <span className="gbif-badge"> · {m.scientificName}</span>}
                      <span className="gbif-badge"> · GBIF</span>
                    </div>
                  ))}
              </div>
            )}

            {/* References panel — open with pending message until meta arrives */}
            <RefsPanel refs={meta?.references} pending={!meta}/>

            {/* Insights panel — between references and the calendar months */}
            <InsightsPanel
              insights={insights}
              plantMeta={plantMeta}
              onFetch={fetchInsights}
              hasPlants={totalPlants > 0}
              stream1Done={stream1Done}
              totalPlantCount={totalPlants}
            />

            {/* Export buttons — shown once generation is complete */}
            {stream1Done && (
              <div style={{display:"flex",gap:".75rem",justifyContent:"center",margin:"1rem 0 .5rem",flexWrap:"wrap"}}>
                <button
                  onClick={() => exportPDF(months, city, meta)}
                  style={{background:"#2C1A0A",color:"#F5EDD8",border:"none",borderRadius:"6px",padding:".55rem 1.2rem",fontSize:".85rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".4rem"}}>
                  📄 Export for Print (HTML)
                </button>
                <button
                  onClick={() => exportICS(months, city)}
                  style={{background:"#4a7c59",color:"#fff",border:"none",borderRadius:"6px",padding:".55rem 1.2rem",fontSize:".85rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".4rem"}}>
                  📅 Export to Calendar (.ics)
                </button>
              </div>
            )}

            <div ref={calTopRef}/>
            <div className="month-nav">
              <button className={`nav-btn left${!canLeft?" hidden":""}`} onClick={()=>{userNavigatedRef.current=true; setPageIdx(p=>p-1);}} disabled={!canLeft}>‹</button>
              <div className="months-window">
                {visibleNames.map((name) => {
                  return (
                    <div key={name} ref={el => { if(el) monthRefs.current[name]=el; }}>
                      <MonthPanel
                        m={months[name]}
                        isCurrent={name===nowName}
                        showInspoButton={months[name]?._state==="done"}
                        inspo={inspos[name] || {state:"idle",data:null}}
                        onFetchInspo={()=>fetchInspo(name)}
                      />
                    </div>
                  );
                })}
              </div>
              <button className={`nav-btn right${!canRight?" hidden":""}`} onClick={()=>{userNavigatedRef.current=true; setPageIdx(p=>p+1);}} disabled={!canRight}>›</button>
            </div>

            <div className="page-dots">
              {Array.from({length: MAX_OFFSET + 1}).map((_,i)=>{
                const rdy = offsetReady(i);
                const label = `${orderedForNav[i]} – ${orderedForNav[i+2]}`;
                return <div key={i} className={`pdot${i===pageIdx?" active":""}${!rdy?" disabled":""}`}
                  onClick={()=>rdy&&setPageIdx(i)} title={rdy ? label : "Generating…"}/>;
              })}
            </div>

            <div className="cal-actions">
              <button className="btn-ghost" onClick={resetAll}>← Edit Garden</button>
              <button className="btn-solid" onClick={handleSubmit} disabled={stillStreaming}>
                {stillStreaming?"Generating…":"✦ Regenerate"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
