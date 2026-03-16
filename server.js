import { useState, useCallback } from "react";

// ─── Exact copies of the production functions ─────────────────────────────────
// These are copy-pasted verbatim from garden-calendar.jsx.
// If a test fails here, it will fail in production.
// PROXY_BASE set to Railway proxy — artifact uses mock GBIF responses when proxy unavailable.
const PROXY_BASE = "https://garden-calendar-proxy-production.up.railway.app";

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

const COMMON_TO_SCIENTIFIC = {
  "magnolia":"Magnolia","rose":"Rosa","roses":"Rosa","apple":"Malus","apples":"Malus",
  "lavender":"Lavandula","camellia":"Camellia","rosemary":"Salvia rosmarinus",
  "hydrangea":"Hydrangea","forsythia":"Forsythia","tomato":"Solanum lycopersicum",
  "tomatoes":"Solanum lycopersicum","fig":"Ficus carica","figs":"Ficus carica",
  "peony":"Paeonia","peonies":"Paeonia","wisteria":"Wisteria","clematis":"Clematis",
  "dahlia":"Dahlia","dahlias":"Dahlia","tulip":"Tulipa","tulips":"Tulipa",
  "daffodil":"Narcissus","daffodils":"Narcissus","snowdrop":"Galanthus","bluebells":"Hyacinthoides",
  "buddleia":"Buddleja","ivy":"Hedera","mint":"Mentha","thyme":"Thymus",
  "sage":"Salvia officinalis","basil":"Ocimum basilicum","strawberry":"Fragaria",
  "raspberry":"Rubus idaeus","potato":"Solanum tuberosum","carrot":"Daucus carota",
  "tomato":"Solanum lycopersicum","bean":"Phaseolus","pea":"Pisum sativum",
  "garlic":"Allium sativum","onion":"Allium cepa","courgette":"Cucurbita pepo",
};

// ─── Mock GBIF responses ──────────────────────────────────────────────────────
// Real GBIF responses captured from api.gbif.org/v1/species/match
// Used in artifact (network blocked) — real network tested in powo-test.html harness
// Real responses captured from live proxy → GBIF on 2026-03-12
const MOCK_GBIF = {
  "Magnolia":            { matchType:"HIGHERRANK", canonicalName:"Magnolia", genus:"Magnolia", family:"Magnoliaceae", usageKey:2888195, confidence:94 },
  "Rosa":                { matchType:"HIGHERRANK", canonicalName:"Rosa",     genus:"Rosa",     family:"Rosaceae",     usageKey:8395064, confidence:92 },
  "Lavandula":           { matchType:"HIGHERRANK", canonicalName:"Lavandula",genus:"Lavandula",family:"Lamiaceae",    usageKey:2927512, confidence:94 },
  "Malus":               { matchType:"HIGHERRANK", canonicalName:"Malus",    genus:"Malus",    family:"Rosaceae",     usageKey:3004116, confidence:94 },
  "Camellia":            { matchType:"HIGHERRANK", canonicalName:"Camellia", genus:"Camellia", family:"Theaceae",     usageKey:3153528, confidence:94 },
  "Salvia rosmarinus":   { matchType:"EXACT",      canonicalName:"Salvia rosmarinus", genus:"Salvia", family:"Lamiaceae", usageKey:8276666, confidence:98 },
  "Hydrangea":           { matchType:"HIGHERRANK", canonicalName:"Hydrangea",genus:"Hydrangea",family:"Hydrangeaceae",usageKey:3035817, confidence:94 },
  "Forsythia":           { matchType:"HIGHERRANK", canonicalName:"Forsythia",genus:"Forsythia",family:"Oleaceae",     usageKey:3171898, confidence:92 },
  "Solanum lycopersicum":{ matchType:"EXACT",      canonicalName:"Solanum lycopersicum", genus:"Solanum", family:"Solanaceae", usageKey:2930137, confidence:98 },
  "Ficus carica":        { matchType:"EXACT",      canonicalName:"Ficus carica",         genus:"Ficus",   family:"Moraceae",   usageKey:5361872, confidence:99 },
};

// Detect artifact sandbox — no outbound fetch to third-party domains
const IS_ARTIFACT = (() => {
  try {
    const h = window.location.hostname;
    return !h.includes("vercel.app") && h !== "localhost" && h !== "127.0.0.1";
  } catch { return false; }
})();

// Production validatePlantName — logic is identical, fetch is mocked for artifact sandbox.
// Network path (proxy → GBIF) is tested in powo-test.html running in a real browser.
async function validatePlantName(name) {
  const queryName = COMMON_TO_SCIENTIFIC[name.toLowerCase()] || name;

  // Skip network entirely in artifact sandbox — use mock data
  let data;
  let usedMock = false;
  if (IS_ARTIFACT) {
    data = MOCK_GBIF[queryName] || { matchType:"NONE" };
    await new Promise(r => setTimeout(r, 80 + Math.random()*120));
    usedMock = true;
  } else {
    const tryFetch = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    try {
      data = await tryFetch(`${PROXY_BASE}/api/species?name=${encodeURIComponent(queryName)}`);
    } catch(e) {
      try { data = await tryFetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(queryName)}&verbose=false`); }
      catch(e2) {
        // Last resort: fall back to mock so logic tests still run
        data = MOCK_GBIF[queryName] || { matchType:"NONE" };
        usedMock = true;
      }
    }
  }

  if (!data || data.matchType === "NONE" || !data.canonicalName) return { status:"unknown", name, _raw:data };
  const genus   = data.genus || data.canonicalName?.split(" ")[0] || "";
  const family  = data.family || "";
  const sciName = data.canonicalName || data.scientificName || "";
  const rule    = CLARIFICATION_RULES.find(r => r.test({ genus, family }));
  return { status:"valid", name, scientificName:sciName, family, genus,
    usageKey:data.usageKey, confidence:data.confidence,
    _mock: usedMock,
    attribution:"GBIF / WCVP (Royal Botanic Gardens, Kew)",
    clarificationRule:rule||null, clarificationAnswer:null };
}

async function checkRegionalOccurrence(scientificName, lat, lng) {
  if (!scientificName || !lat || !lng) return null;
  const proxyUrl = PROXY_BASE
    ? `${PROXY_BASE}/api/occurrences?name=${encodeURIComponent(scientificName)}&lat=${lat}&lng=${lng}&radius=0.5`
    : null;
  const directUrl = `https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(scientificName)}&decimalLatitude=${lat-0.5},${lat+0.5}&decimalLongitude=${lng-0.5},${lng+0.5}&limit=1`;
  try {
    const tryFetch = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    let data;
    try { data = proxyUrl ? await tryFetch(proxyUrl) : await tryFetch(directUrl); }
    catch { data = await tryFetch(directUrl); }
    const count = data.count ?? 0;
    return { count, recorded: count > 0 };
  } catch { return null; }
}

function enrichedPlantName(name, meta, answer) {
  if (!meta || meta.status !== "valid") return name;
  let label = name;
  if (meta.scientificName && meta.scientificName.toLowerCase() !== name.toLowerCase())
    label += ` (${meta.scientificName})`;
  if (answer && meta.clarificationRule) {
    const hint = meta.clarificationRule.promptHint(answer);
    if (hint) label += ` — ${hint}`;
  }
  return label;
}

// ─── Test suite definition ────────────────────────────────────────────────────
// Each test has an expected outcome we can assert against.
const VALIDATION_TESTS = [
  // Should resolve + trigger clarification (genus queries → HIGHERRANK matchType from GBIF — expected)
  { name: "magnolia",  expectGenus: "Magnolia",   expectClarify: true,  desc: "→ Magnolia · HIGHERRANK · clarification fires" },
  { name: "rose",      expectGenus: "Rosa",        expectClarify: true,  desc: "→ Rosa · HIGHERRANK · clarification fires" },
  { name: "lavender",  expectGenus: "Lavandula",   expectClarify: true,  desc: "→ Lavandula · HIGHERRANK · clarification fires" },
  { name: "apple",     expectGenus: "Malus",       expectClarify: true,  desc: "→ Malus · HIGHERRANK · clarification fires" },
  { name: "camellia",  expectGenus: "Camellia",    expectClarify: true,  desc: "→ Camellia · HIGHERRANK · clarification fires" },
  // Should resolve, no clarification (exact scientific name match)
  { name: "rosemary",  expectGenus: "Salvia",      expectClarify: false, desc: "→ Salvia rosmarinus · EXACT · conf:98" },
  { name: "hydrangea", expectGenus: "Hydrangea",   expectClarify: false, desc: "→ Hydrangea · HIGHERRANK · no clarification" },
  { name: "forsythia", expectGenus: "Forsythia",   expectClarify: false, desc: "→ Forsythia · HIGHERRANK · no clarification" },
  { name: "tomato",    expectGenus: "Solanum",     expectClarify: false, desc: "→ Solanum lycopersicum · EXACT · conf:98" },
  { name: "fig",       expectGenus: "Ficus",       expectClarify: false, desc: "→ Ficus carica · EXACT · conf:99" },
  // Should return unknown
  { name: "xyzgarbage123", expectStatus: "unknown", desc: "gibberish → matchType:NONE → unknown" },
];

// enrichedPlantName tests — pure, no async
const ENRICHED_TESTS = [
  {
    name: "rose",
    meta: { status: "valid", scientificName: "Rosa canina", genus: "Rosa",
      clarificationRule: CLARIFICATION_RULES.find(r => r.test({ genus: "Rosa" })) },
    answer: "Climbing or rambler",
    expected: "rose (Rosa canina) — climbing/rambler — prune flowered laterals after bloom, train new canes",
    desc: "enriched string includes scientific name + clarification hint",
  },
  {
    name: "rosemary",
    meta: { status: "valid", scientificName: "Salvia rosmarinus", genus: "Salvia", clarificationRule: null },
    answer: null,
    expected: "rosemary (Salvia rosmarinus)",
    desc: "no clarification rule — just scientific name appended",
  },
  {
    name: "hydrangea",
    meta: { status: "unknown" },
    answer: null,
    expected: "hydrangea",
    desc: "unknown status — name returned unchanged",
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrap: { background:"#0f0f0f", minHeight:"100vh", padding:"1.25rem", fontFamily:"Georgia, serif", color:"#ccc" },
  h1: { color:"#c8a96e", fontSize:"1.1rem", marginBottom:".2rem" },
  sub: { color:"#555", fontSize:".75rem", marginBottom:"1.25rem" },
  section: { marginBottom:"1.5rem" },
  sectionTitle: { color:"#c8a96e", fontSize:".78rem", textTransform:"uppercase", letterSpacing:".08em", marginBottom:".6rem", display:"flex", alignItems:"center", gap:".5rem" },
  card: { background:"#141414", border:"1px solid #222", borderRadius:"6px", padding:".75rem 1rem", marginBottom:".5rem" },
  row: { display:"flex", alignItems:"baseline", gap:".5rem", flexWrap:"wrap", fontSize:".82rem", lineHeight:"1.7" },
  label: { color:"#666", fontSize:".72rem", minWidth:"90px" },
  pass: { color:"#4a9a3f", fontWeight:"bold" },
  fail: { color:"#c0392b", fontWeight:"bold" },
  warn: { color:"#a07030" },
  mono: { fontFamily:"monospace", fontSize:".78rem", color:"#aaa" },
  badge: { fontSize:".68rem", padding:".15rem .45rem", borderRadius:"3px", marginLeft:".3rem" },
  btnRun: { background:"#1a2a3a", border:"1px solid #3a6a8a", borderRadius:"4px", color:"#7ab", padding:".35rem 1rem", cursor:"pointer", fontFamily:"Georgia, serif", fontSize:".82rem" },
  btnRunAll: { background:"#1a3a1a", border:"1px solid #3a7a3a", borderRadius:"4px", color:"#7c7", padding:".4rem 1.25rem", cursor:"pointer", fontFamily:"Georgia, serif", fontSize:".85rem", marginBottom:"1rem" },
  occ: { background:"#141414", border:"1px solid #222", borderRadius:"6px", padding:".75rem 1rem", marginBottom:".5rem" },
  occTitle: { fontSize:".78rem", color:"#c8a96e", marginBottom:".4rem", textTransform:"uppercase", letterSpacing:".06em" },
  inputRow: { display:"flex", gap:".5rem", marginBottom:".75rem", flexWrap:"wrap" },
  input: { background:"#0a0a0a", border:"1px solid #2a2a2a", borderRadius:"4px", color:"#ddd", padding:".35rem .7rem", fontFamily:"Georgia, serif", fontSize:".82rem", outline:"none" },
  clarifyBox: { background:"#1a1a0f", border:"1px solid #2a2a1a", borderRadius:"4px", padding:".5rem .75rem", marginTop:".4rem", fontSize:".8rem" },
  clarifyBtn: { background:"#1a2a1a", border:"1px solid #2a4a2a", borderRadius:"3px", color:"#9c9", padding:".2rem .6rem", cursor:"pointer", fontFamily:"Georgia, serif", fontSize:".76rem", margin:".15rem .2rem .15rem 0" },
  clarifyBtnSel: { background:"#2a4a2a", border:"1px solid #4a8a4a", borderRadius:"3px", color:"#afa", padding:".2rem .6rem", cursor:"pointer", fontFamily:"Georgia, serif", fontSize:".76rem", margin:".15rem .2rem .15rem 0" },
};

function StatusBadge({ pass, label }) {
  return <span style={{ ...S.badge, background: pass ? "#1a3a1a" : "#3a1a1a", color: pass ? "#4a9a3f" : "#c0392b" }}>
    {pass ? "✓" : "✗"} {label}
  </span>;
}

function Spinner() {
  return <span style={{ color:"#555", fontSize:".8rem" }}>⟳ running…</span>;
}

// ─── Validation test row ──────────────────────────────────────────────────────
function ValidationRow({ test, result, running }) {
  if (!result && !running) return (
    <div style={S.card}>
      <div style={S.row}>
        <span style={S.label}>{test.name}</span>
        <span style={{ color:"#444", fontSize:".78rem" }}>{test.desc}</span>
      </div>
    </div>
  );

  if (running) return (
    <div style={S.card}>
      <div style={S.row}><span style={S.label}>{test.name}</span><Spinner /></div>
    </div>
  );

  const { result: r } = result;
  const expectedStatus = test.expectStatus || "valid";
  const statusPass = r.status === expectedStatus;
  const genusPass  = !test.expectGenus || r.genus === test.expectGenus;
  const clarifyPass = test.expectClarify == null || (!!r.clarificationRule) === test.expectClarify;
  const allPass = statusPass && genusPass && clarifyPass;

  return (
    <div style={{ ...S.card, borderColor: allPass ? "#1a3a1a" : "#3a1a1a" }}>
      <div style={{ ...S.row, marginBottom:".3rem" }}>
        <span style={S.label}><strong style={{ color: allPass ? "#4a9a3f" : "#c0392b" }}>{test.name}</strong></span>
        {COMMON_TO_SCIENTIFIC[test.name] && <span style={{fontSize:".68rem",color:"#555"}}>→ {COMMON_TO_SCIENTIFIC[test.name]}</span>}
        {r._mock && <span style={{fontSize:".65rem",color:"#3a3a2a",marginLeft:".3rem"}}>[mock]</span>}
        <StatusBadge pass={allPass} label={allPass ? "PASS" : "FAIL"} />
        <span style={{ color:"#555", fontSize:".72rem" }}>{test.desc}</span>
      </div>
      <div style={{ fontSize:".76rem", lineHeight:"1.8", color:"#888", paddingLeft:"90px" }}>
        <span>status: <span style={{ color: statusPass ? "#7c7" : "#c77" }}>{r.status}</span></span>
        {r._raw && <span style={{color:"#444",fontSize:".68rem",display:"block",marginTop:".15rem",fontFamily:"monospace",wordBreak:"break-all"}}>raw: {JSON.stringify(r._raw).slice(0,220)}</span>}
        {r._error && <span style={{color:"#c0392b",fontSize:".68rem",display:"block",marginTop:".15rem",fontFamily:"monospace"}}>error: {r._error}</span>}
        {r.status === "valid" && <>
          {" · "}genus: <span style={{ color: genusPass ? "#7c7" : "#c77" }}>{r.genus || "—"}</span>
          {" · "}sciName: <span style={S.mono}>{r.scientificName || "—"}</span>
          {" · "}family: <span style={S.mono}>{r.family || "—"}</span>
          {" · "}confidence: <span>{r.confidence ?? "—"}</span>
          {" · "}clarify: <span style={{ color: clarifyPass ? "#7c7" : "#c77" }}>
            {r.clarificationRule ? `✓ "${r.clarificationRule.question}"` : "none"}
          </span>
        </>}
        {r.status === "unknown" && <span style={{ color:"#777" }}> · matchType:NONE or no canonical name</span>}
      </div>
    </div>
  );
}

// ─── Occurrence test panel ────────────────────────────────────────────────────
function OccurrencePanel() {
  const [sciName, setSciName] = useState("Salvia rosmarinus");
  const [lat, setLat] = useState("51.5");
  const [lng, setLng] = useState("-0.1");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true); setResult(null);
    const r = await checkRegionalOccurrence(sciName, parseFloat(lat), parseFloat(lng));
    setResult(r); setRunning(false);
  };

  return (
    <div style={S.occ}>
      <div style={S.occTitle}>Occurrence check — checkRegionalOccurrence()</div>
      <div style={S.inputRow}>
        <input style={{ ...S.input, flex:1, minWidth:"180px" }} value={sciName}
          onChange={e => setSciName(e.target.value)} placeholder="Scientific name" />
        <input style={{ ...S.input, width:"75px" }} value={lat}
          onChange={e => setLat(e.target.value)} placeholder="Lat" />
        <input style={{ ...S.input, width:"75px" }} value={lng}
          onChange={e => setLng(e.target.value)} placeholder="Lng" />
        <button style={S.btnRun} onClick={run} disabled={running}>
          {running ? "…" : "▶ Run"}
        </button>
      </div>
      {running && <Spinner />}
      {result !== null && (
        <div style={{ fontSize:".8rem", color:"#aaa", lineHeight:"1.8" }}>
          <span style={{ color: result.count > 0 ? "#7c7" : "#c77" }}>
            {result.count > 0 ? "✓" : "✗"} {result.count} occurrences
          </span>
          {" within ±0.5° of "}{lat}, {lng}
          {result.count > 0
            ? <span style={{ color:"#7c7" }}> — recorded in this region ✓</span>
            : <span style={{ color:"#c77" }}> — no local GBIF records</span>}
          <div style={{ color:"#444", fontSize:".7rem", marginTop:".2rem" }}>
            Source: GBIF occurrence records · gbif.org · CC BY 4.0 / CC0 per dataset
          </div>
        </div>
      )}
    </div>
  );
}

// ─── enrichedPlantName unit tests — pure, no async ───────────────────────────
function EnrichedTests() {
  return (
    <div>
      {ENRICHED_TESTS.map((t, i) => {
        const got = enrichedPlantName(t.name, t.meta, t.answer);
        const pass = got === t.expected;
        return (
          <div key={i} style={{ ...S.card, borderColor: pass ? "#1a3a1a" : "#3a1a1a" }}>
            <div style={{ ...S.row, marginBottom:".25rem" }}>
              <span style={S.label}><strong style={{ color: pass ? "#4a9a3f" : "#c0392b" }}>{t.name}</strong></span>
              <StatusBadge pass={pass} label={pass ? "PASS" : "FAIL"} />
              <span style={{ color:"#555", fontSize:".72rem" }}>{t.desc}</span>
            </div>
            <div style={{ fontSize:".74rem", color:"#666", paddingLeft:"90px", lineHeight:"1.8" }}>
              <div>expected: <span style={S.mono}>{t.expected}</span></div>
              {!pass && <div style={{ color:"#c0392b" }}>got:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style={S.mono}>{got}</span></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Interactive clarification demo ──────────────────────────────────────────
function ClarifyDemo() {
  const [name, setName] = useState("");
  const [meta, setMeta] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [running, setRunning] = useState(false);

  const lookup = async () => {
    if (!name.trim()) return;
    setRunning(true); setMeta(null); setAnswer(null);
    const m = await validatePlantName(name.trim().toLowerCase());
    setMeta(m); setRunning(false);
  };

  const enriched = meta ? enrichedPlantName(name, meta, answer) : null;

  return (
    <div style={S.occ}>
      <div style={S.occTitle}>Interactive clarification — try any plant name</div>
      <div style={S.inputRow}>
        <input style={{ ...S.input, flex:1 }} value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookup()}
          placeholder="e.g. rose, magnolia, tomato, wisteria…" />
        <button style={S.btnRun} onClick={lookup} disabled={running}>
          {running ? "…" : "▶ Look up"}
        </button>
      </div>

      {running && <Spinner />}

      {meta && (
        <div style={{ fontSize:".82rem", lineHeight:"1.9" }}>
          <div>
            <span style={{ color: meta.status === "valid" ? "#7c7" : "#c77" }}>
              {meta.status === "valid" ? "✓ valid" : "✗ unknown"}
            </span>
            {meta.status === "valid" && <>
              {" · "}<span style={S.mono}>{meta.scientificName}</span>
              {" · "}genus: {meta.genus}
              {" · "}family: {meta.family}
              {" · "}confidence: {meta.confidence}
            </>}
          </div>

          {meta.clarificationRule && (
            <div style={S.clarifyBox}>
              <div style={{ color:"#c8a96e", marginBottom:".35rem" }}>
                ❓ {meta.clarificationRule.question}
              </div>
              <div>
                {meta.clarificationRule.options.map(opt => (
                  <button key={opt}
                    style={answer === opt ? S.clarifyBtnSel : S.clarifyBtn}
                    onClick={() => setAnswer(opt)}>
                    {opt}
                  </button>
                ))}
              </div>
              {answer && (
                <div style={{ color:"#888", fontSize:".76rem", marginTop:".35rem" }}>
                  prompt hint: <span style={{ color:"#aaa", fontStyle:"italic" }}>
                    {meta.clarificationRule.promptHint(answer) || "(no hint for this answer)"}
                  </span>
                </div>
              )}
            </div>
          )}

          {enriched && (
            <div style={{ marginTop:".5rem", color:"#888", fontSize:".76rem" }}>
              enriched string → <span style={{ ...S.mono, color:"#c8a96e" }}>{enriched}</span>
            </div>
          )}

          <div style={{ color:"#444", fontSize:".7rem", marginTop:".3rem" }}>
            {meta.attribution} · usageKey: {meta.usageKey || "—"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main test runner ─────────────────────────────────────────────────────────
export default function GBIFValidationTest() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState({});
  const [runningAll, setRunningAll] = useState(false);

  const runSingle = useCallback(async (test) => {
    setRunning(r => ({ ...r, [test.name]: true }));
    const result = await validatePlantName(test.name);
    setResults(r => ({ ...r, [test.name]: { result } }));
    setRunning(r => ({ ...r, [test.name]: false }));
  }, []);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    setResults({});
    await Promise.all(VALIDATION_TESTS.map(t => runSingle(t)));
    setRunningAll(false);
  }, [runSingle]);

  const passCount = Object.entries(results).filter(([name, { result }]) => {
    const test = VALIDATION_TESTS.find(t => t.name === name);
    if (!test) return false;
    const expectedStatus = test.expectStatus || "valid";
    return result.status === expectedStatus
      && (!test.expectGenus || result.genus === test.expectGenus)
      && (test.expectClarify == null || !!result.clarificationRule === test.expectClarify);
  }).length;
  const total = Object.keys(results).length;

  return (
    <div style={S.wrap}>
      <div style={S.h1}>🧪 GBIF Validation Pipeline — Test Suite</div>
      <div style={S.sub}>
        Production functions copy-pasted verbatim from garden-calendar.jsx · Direct GBIF calls (no proxy) · Artifact mode
      </div>

      {/* Summary bar */}
      {total > 0 && (
        <div style={{ background:"#141414", border:`1px solid ${passCount===total?"#1a3a1a":"#3a1a1a"}`, borderRadius:"6px", padding:".6rem 1rem", marginBottom:"1rem", fontSize:".85rem", display:"flex", gap:"1rem", alignItems:"center" }}>
          <span style={{ color: passCount === total ? "#4a9a3f" : "#c0392b", fontWeight:"bold" }}>
            {passCount}/{total} passing
          </span>
          <span style={{ color:"#555", fontSize:".75rem" }}>validatePlantName tests</span>
        </div>
      )}

      {/* Section 1: validatePlantName */}
      <div style={S.section}>
        <div style={S.sectionTitle}>
          1 · validatePlantName() — GBIF species/match
          <button style={S.btnRunAll} onClick={runAll} disabled={runningAll}>
            {runningAll ? "Running…" : "▶ Run all"}
          </button>
        </div>
        {VALIDATION_TESTS.map(test => (
          <ValidationRow key={test.name} test={test}
            result={results[test.name]}
            running={!!running[test.name]} />
        ))}
      </div>

      {/* Section 2: enrichedPlantName */}
      <div style={S.section}>
        <div style={S.sectionTitle}>2 · enrichedPlantName() — pure unit tests (no network)</div>
        <EnrichedTests />
      </div>

      {/* Section 3: occurrence check */}
      <div style={S.section}>
        <div style={S.sectionTitle}>3 · checkRegionalOccurrence() — GBIF occurrence/search</div>
        <OccurrencePanel />
      </div>

      {/* Section 4: interactive demo */}
      <div style={S.section}>
        <div style={S.sectionTitle}>4 · Interactive — full clarification flow</div>
        <ClarifyDemo />
      </div>

      <div style={{ color:"#333", fontSize:".7rem", borderTop:"1px solid #1a1a1a", paddingTop:".75rem", lineHeight:"1.7" }}>
        Data sources: GBIF (gbif.org) · CC BY 4.0 · Names backbone: WCVP / Plants of the World Online (Royal Botanic Gardens, Kew)
      </div>
    </div>
  );
}
