var __oyaaViz = (function () {
// oyaa-viz — Spicetify custom app
const LS_L = "oyaa-viz:lyrics:", LS_C = "oyaa-viz:color", LS_O = "oyaa-viz:offset:", LS_R = "oyaa-viz:roman", N = 48, LAG = 150;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tms = (m, s) => (+m * 60 + parseFloat(String(s).replace(":", "."))) * 1000;
const isSp = (c) => /\s/.test(c);
const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
const romanCache = new Map();

/* ---------- time + word timing ---------- */

function fmt(ms) {
  const cs = Math.max(0, Math.round(ms / 10)), m = Math.floor(cs / 6000), s = (cs % 6000) / 100;
  return "[" + String(m).padStart(2, "0") + ":" + s.toFixed(2).padStart(5, "0") + "]";
}
function bpmOf(uri) {
  let h = 0;
  for (let i = 0; i < uri.length; i++) h = (h * 31 + uri.charCodeAt(i)) | 0;
  return 92 + (Math.abs(h) % 48);
}
function lyricLanguage(text) {
  if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return "ja";
  if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return "zh-CN";
  return null;
}
function splitWords(text, lang) {
  if (/\s/.test(text) || !lyricLanguage(text)) return text.split(/\s+/).filter(Boolean);
  const locale = lang || lyricLanguage(text);
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segments = new Intl.Segmenter(locale, { granularity: "word" }).segment(text);
    const words = [];
    for (const part of segments) {
      if (/^\s+$/.test(part.segment)) continue;
      if (part.isWordLike) words.push(part.segment);
      else if (words.length) words[words.length - 1] += part.segment;
      else words.push(part.segment);
    }
    if (words.length > 1) return words;
    if (locale === "ko" && Array.from(text).length > 1) return Array.from(text);
    if (words.length) return words;
  }
  return Array.from(text).filter((part) => !/\s/.test(part));
}
function splitTimedWords(words) {
  return words.flatMap((word, i) => {
    const parts = splitWords(word.s);
    if (parts.length < 2) return [word];
    const end = words[i + 1] ? words[i + 1].t : word.t + clamp(word.s.length * 120, 350, 1500);
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    let consumed = 0;
    return parts.map((part) => {
      const start = word.t + ((end - word.t) * consumed) / total;
      consumed += part.length;
      const finish = word.t + ((end - word.t) * consumed) / total;
      return { t: start, e: Math.max(finish, start + 1), s: part };
    });
  });
}
function lyricsVersion(lines) {
  return JSON.stringify(lines.map((line) => [line.words, line.t, line.end]));
}
function parseRomanization(data, original) {
  const candidates = [];
  const visit = (value) => {
    if (typeof value === "string") candidates.push(value.trim());
    else if (Array.isArray(value)) value.forEach(visit);
  };
  visit(data);
  const roman = candidates.find((value) =>
    value && value !== original && /[A-Za-z]/.test(value) &&
    !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value) &&
    !/[\u1100-\u11ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(value));
  if (!roman) throw new Error("Google Translate did not return romanization.");
  return roman;
}
async function fetchRomanization(text, lang, signal) {
  const query = new URLSearchParams({ client: "gtx", sl: lang, tl: lang, dt: "t", q: text });
  query.append("dt", "rm");
  const response = await fetch("https://translate.googleapis.com/translate_a/single?" + query.toString(), {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal
  });
  if (!response.ok) throw new Error("Google Translate request failed (" + response.status + ").");
  return parseRomanization(await response.json(), text);
}
async function fetchRomanizedLines(lines, lang, signal) {
  const result = Array(lines.length), workers = [];
  let next = 0;
  for (let n = 0; n < Math.min(4, lines.length); n++) {
    workers.push((async () => {
      while (next < lines.length) {
        const i = next++;
        result[i] = lyricLanguage(lines[i].words)
          ? await fetchRomanization(lines[i].words, lang, signal)
          : lines[i].words;
      }
    })());
  }
  await Promise.all(workers);
  return result;
}
function alignRomanized(text, original, lineEnd) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return original;
  if (!original.length) return estWords(text, 0, lineEnd);
  const timeAt = (progress) => {
    const position = progress * original.length;
    if (position >= original.length) return original[original.length - 1].e;
    const index = Math.floor(position), fraction = position - index, word = original[index];
    return word.t + (word.e - word.t) * fraction;
  };
  return words.map((word, i) => {
    const t = timeAt(i / words.length), e = timeAt((i + 1) / words.length);
    return { t, e: Math.max(e, t + 1), s: word };
  });
}
// glue text chunks that belong to the same word (syllables) into words
function addChunk(out, st, t, s) {
  for (const part of s.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) st.nw = true;
    else if (st.nw || !out.length) { out.push({ t, s: part }); st.nw = false; }
    else out[out.length - 1].s += part;
  }
}
// Spotify SYLLABLE_SYNCED: [{startTimeMs, numChars}] -> [{t, s}] words (null if it doesn't add up)
function fromSyl(text, syl) {
  if (!Array.isArray(syl) || !syl.length) return null;
  const ch = Array.from(text), all = ch.length, bare = ch.filter((c) => !isSp(c)).length;
  let tot = 0;
  for (const y of syl) tot += +y.numChars || 0;
  const skip = tot !== all;
  if (skip && tot !== bare) return null;
  const out = [], st = { nw: true };
  let p = 0, prev = 0;
  for (const y of syl) {
    let t = +y.startTimeMs, n = +y.numChars || 0, s = "";
    if (!isFinite(t)) return null;
    t = Math.max(t, prev); prev = t;
    if (skip) { while (p < all && n > 0) { const c = ch[p++]; s += c; if (!isSp(c)) n--; } }
    else { s = ch.slice(p, p + n).join(""); p += n; }
    addChunk(out, st, t, s);
  }
  return out.length ? splitTimedWords(out) : null;
}
// enhanced LRC: [00:12.00] <00:12.00>First <00:12.40>word
function fromTags(s, t0) {
  const parts = s.split(/<(\d+):(\d+(?:[.:]\d+)?)>/);
  if (parts.length < 4) return null;
  const out = [], st = { nw: true };
  addChunk(out, st, t0, parts[0]);
  for (let i = 1; i + 2 < parts.length; i += 3) addChunk(out, st, tms(parts[i], parts[i + 1]), parts[i + 2] || "");
  return out.length ? splitTimedWords(out) : null;
}
// no word timing available: spread the words over the part of the line that is really sung
function estWords(text, t0, t1) {
  if (text === "♪") return [{ t: t0, e: Math.max(t1, t0 + 1), s: text }];
  const ws = splitWords(text);
  if (!ws.length) return [];
  const chars = ws.reduce((a, w) => a + w.length, 0), gap = Math.max(1, t1 - t0);
  const sing = Math.min(gap, clamp(gap * 0.7, chars * 80, chars * 170)), tot = chars + ws.length;
  let acc = 0;
  return ws.map((w) => {
    const a = t0 + (sing * acc) / tot;
    acc += w.length + 1;
    return { t: a, e: t0 + (sing * acc) / tot, s: w };
  });
}
function buildW(l) {
  const b = l.tw;
  if (b && b.length)
    return b.map((x, i) => {
      const e = b[i + 1] ? b[i + 1].t : Math.min(l.end, x.t + clamp(x.s.length * 120, 350, 1500));
      return { t: x.t, e: Math.max(e, x.t + 1), s: x.s };
    });
  return estWords(l.words, l.t, l.end);
}
function finish(lines, dur) {
  lines.sort((a, b) => a.t - b.t);
  lines.forEach((l, i) => {
    l.end = i < lines.length - 1 ? lines[i + 1].t : Math.max(dur, l.t + 4000);
    l.w = buildW(l);
  });
  return lines;
}
function spread(arr, dur) {
  const step = dur / Math.max(arr.length, 1);
  return finish(arr.map((w, i) => ({ t: i * step, words: w })), dur);
}
function parseText(text, dur) {
  const re = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g, raw = text.split(/\r?\n/), out = [];
  let timed = false;
  for (const l of raw) {
    const tags = [...l.matchAll(re)];
    if (!tags.length) continue;
    timed = true;
    const rest = l.replace(re, "").trim();
    for (const t of tags) {
      const t0 = tms(t[1], t[2]), tw = fromTags(rest, t0);
      out.push({ t: t0, tw, words: rest.replace(/<[^>]*>/g, "").trim() || "♪" });
    }
  }
  if (timed) return finish(out, dur);
  const arr = raw.map((s) => s.trim()).filter(Boolean);
  return arr.length ? spread(arr, dur) : [];
}
// LRC maker rows: [{text, t|null}]
function toRows(text) {
  const re = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g, rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const tags = [...raw.matchAll(re)], txt = raw.replace(re, "").replace(/<[^>]*>/g, "").trim();
    if (!tags.length) { if (txt) rows.push({ text: txt, t: null }); continue; }
    for (const t of tags) rows.push({ text: txt || "♪", t: tms(t[1], t[2]) });
  }
  return rows;
}
function rowsText(rows, only) {
  if (only && rows.some((r) => r.t != null))
    return rows.filter((r) => r.t != null).sort((a, b) => a.t - b.t).map((r) => fmt(r.t) + " " + r.text).join("\n");
  return rows.map((r) => (r.t != null ? fmt(r.t) + " " : "") + r.text).join("\n");
}

/* ---------- data ---------- */

async function fetchSpotify(id, dur) {
  try {
    const r = await Spicetify.CosmosAsync.get(
      `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`,
      null, { "app-platform": "WebPlayer" });
    const L = r && r.lyrics;
    if (!L || !L.lines || !L.lines.length) return null;
    if (L.syncType === "LINE_SYNCED" || L.syncType === "SYLLABLE_SYNCED")
      return finish(L.lines.map((l) => {
        const raw = l.words || "", tw = raw.trim() ? fromSyl(raw, l.syllables) : null;
        return { t: +l.startTimeMs, tw, words: raw.trim() || "♪" };
      }), dur);
    return spread(L.lines.map((l) => l.words).filter(Boolean), dur);
  } catch (e) { return null; }
}
const aCache = new Map();
async function loadAnalysis(uri) {
  if (aCache.has(uri)) return aCache.get(uri);
  let segs = null;
  for (let a = 0; a < 2 && !segs; a++) {
    try {
      const d = await Spicetify.getAudioData(uri);
      if (d && d.segments && d.segments.length)
        segs = d.segments.map((g) => ({ start: g.start, loudness_max: g.loudness_max, pitches: g.pitches }));
      else break;
    } catch (e) { if (a === 0) await new Promise((r) => setTimeout(r, 1200)); }
  }
  if (segs) { aCache.set(uri, segs); if (aCache.size > 12) aCache.delete(aCache.keys().next().value); }
  return segs;
}
function getTrack() {
  const it = Spicetify.Player.data && Spicetify.Player.data.item;
  if (!it) return null;
  const artist = (it.artists && it.artists.map((a) => a.name).join(", ")) || (it.metadata && it.metadata.artist_name) || "";
  return { uri: it.uri, name: it.name, artist, dur: (it.duration && it.duration.milliseconds) || Spicetify.Player.getDuration() || 180000 };
}

/* ---------- LRC maker / editor ---------- */

function Clock() {
  const R = Spicetify.React, h = R.createElement;
  const [v, setV] = R.useState(Spicetify.Player.getProgress());
  R.useEffect(() => {
    const id = setInterval(() => setV(Spicetify.Player.getProgress()), 80);
    return () => clearInterval(id);
  }, []);
  return h("span", { className: "mk-clock" }, fmt(v).slice(1, -1));
}

function Editor(p) {
  const R = Spicetify.React, h = R.createElement;
  const [tab, setTab] = R.useState("text");
  const [draft, setDraft] = R.useState(p.initial);
  const [rows, setRows] = R.useState([]);
  const [cur, setCur] = R.useState(0);
  const [pos, setPos] = R.useState(0);
  const ref = R.useRef({ rows: [], cur: 0 }), list = R.useRef(null), act = R.useRef({});
  ref.current.rows = rows; ref.current.cur = cur;

  const commit = (r, c) => { ref.current = { rows: r, cur: c }; setRows(r); setCur(c); };
  const tap = () => {
    const { rows: r, cur: c } = ref.current;
    if (c >= r.length) return;
    const n = r.slice();
    n[c] = { text: n[c].text, t: Math.max(0, Spicetify.Player.getProgress() - LAG) };
    commit(n, c + 1);
  };
  const undo = () => {
    const { rows: r, cur: c } = ref.current, k = Math.min(c, r.length) - 1;
    if (k < 0) return;
    const old = r[k].t, n = r.slice();
    n[k] = { text: n[k].text, t: null };
    commit(n, k);
    if (old != null) Spicetify.Player.seek(Math.max(0, old - 2500));
  };
  const jump = (d) => Spicetify.Player.seek(Math.max(0, Spicetify.Player.getProgress() + d));
  const pick = (k) => {
    const r = ref.current.rows[k];
    commit(ref.current.rows, k);
    if (r && r.t != null) Spicetify.Player.seek(Math.max(0, r.t - 2500));
  };
  const nudge = (k, d) => {
    const n = ref.current.rows.slice();
    n[k] = { text: n[k].text, t: Math.max(0, n[k].t + d) };
    commit(n, ref.current.cur);
  };
  act.current = { tap, undo, jump };

  const toMaker = () => {
    const r = toRows(draft);
    let c = r.findIndex((x) => x.t == null);
    if (c < 0) c = r.length;
    commit(r, c); setTab("maker");
  };
  const toText = () => { setDraft(rowsText(rows, false)); setTab("text"); };

  R.useEffect(() => {
    if (tab !== "maker") return;
    const id = setInterval(() => setPos(Spicetify.Player.getProgress()), 250);
    return () => clearInterval(id);
  }, [tab]);

  R.useEffect(() => {
    if (tab !== "maker") return;
    const k = (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const a = act.current;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!e.repeat) a.tap(); }
      else if (e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); if (!e.repeat) a.undo(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); a.jump(-5000); }
      else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); a.jump(5000); }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [tab]);

  R.useEffect(() => {
    const box = list.current, el = box && box.children[cur];
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: "smooth" });
  }, [cur, tab]);

  const stamped = rows.filter((r) => r.t != null).length;
  let playIdx = -1, bt = -1;
  rows.forEach((r, k) => { if (r.t != null && r.t <= pos && r.t >= bt) { bt = r.t; playIdx = k; } });
  const save = () => p.onSave(tab === "maker" ? rowsText(rows, true) : draft);

  const tabs = h("div", { className: "oyaa-row", style: { justifyContent: "flex-start" } },
    h("button", { className: "oyaa-btn" + (tab === "text" ? " on" : ""), onClick: () => tab !== "text" && toText() }, "text"),
    h("button", { className: "oyaa-btn" + (tab === "maker" ? " on" : ""), onClick: () => tab !== "maker" && toMaker() }, "lrc maker"));
  const foot = h("div", { className: "oyaa-row" },
    h("button", { className: "oyaa-btn", onClick: p.onReset }, "use spotify lyrics"),
    h("button", { className: "oyaa-btn", onClick: p.onCancel }, "cancel"),
    h("button", { className: "oyaa-btn on", onClick: save }, "save"));

  if (tab === "text")
    return h("div", { className: "oyaa-modal" }, tabs,
      h("div", { className: "oyaa-hint" },
        "Paste lyrics. With timestamps like [01:23.45] text they sync exactly. Plain lines (no timestamps) are spread evenly across the song. Word timing like [01:23.45] <01:23.45>one <01:23.90>two is supported too. Use LRC MAKER to stamp the lines while the song plays."),
      h("textarea", { value: draft, onChange: (e) => setDraft(e.target.value), spellCheck: false, placeholder: "[00:12.00] first line\n[00:16.50] second line" }),
      foot);

  const nxt = cur < rows.length ? rows[cur].text : "";
  return h("div", { className: "oyaa-modal" }, tabs,
    h("div", { className: "mk-bar" },
      h(Clock),
      h("div", { className: "mk-stat" }, stamped + " / " + rows.length + " stamped"),
      h("button", { className: "oyaa-btn", onClick: () => Spicetify.Player.seek(0) }, "restart"),
      h("button", { className: "oyaa-btn", onClick: () => jump(-5000) }, "−5s"),
      h("button", { className: "oyaa-btn", onClick: () => Spicetify.Player.togglePlay() }, "play / pause"),
      h("button", { className: "oyaa-btn", onClick: () => jump(5000) }, "+5s")),
    h("div", { className: "mk-bar" },
      h("button", { className: "oyaa-btn big", onClick: tap, disabled: !rows.length || cur >= rows.length }, cur >= rows.length && rows.length ? "done" : "tap · enter"),
      h("button", { className: "oyaa-btn", onClick: undo }, "undo · ⌫"),
      h("div", { className: "mk-next" }, nxt ? "next: " + nxt : rows.length ? "all lines stamped, press SAVE" : "Paste lyrics in the TEXT tab first")),
    h("div", { className: "mk-list", ref: list },
      rows.map((r, k) => h("div", { key: k, className: "mk-row" + (k === cur ? " cur" : "") + (k === playIdx ? " play" : ""), onClick: () => pick(k) },
        h("span", { className: "mk-t" + (r.t == null ? " none" : "") }, r.t == null ? "--:--.--" : fmt(r.t).slice(1, -1)),
        h("span", { className: "mk-x" }, r.text),
        r.t != null && h("span", { className: "mk-nudge" },
          h("button", { className: "mk-n", title: "0.1s earlier", onClick: (e) => { e.stopPropagation(); nudge(k, -100); } }, "−"),
          h("button", { className: "mk-n", title: "0.1s later", onClick: (e) => { e.stopPropagation(); nudge(k, 100); } }, "+"))))),
    h("div", { className: "oyaa-hint" },
      "Play the song and press ENTER (or TAP) the moment each line starts. ⌫ removes the last stamp and rewinds 2.5s so you can redo it. Click a line to re-stamp it, − / + nudges it by 0.1s. Taps are placed 0.15s early to cover your reaction time." +
      (stamped && stamped < rows.length ? " Lines without a stamp are left out when you save." : "")),
    foot);
}

/* ---------- app ---------- */

function App() {
  const R = Spicetify.React, h = R.createElement;
  const cv = R.useRef(null), lyr = R.useRef(null);
  const [lines, setLines] = R.useState([]);
  const [src, setSrc] = R.useState("none");
  const [ana, setAna] = R.useState("wait");
  const [mode, setMode] = R.useState(localStorage.getItem(LS_C) === "white" ? "white" : "red");
  const [romanize, setRomanize] = R.useState(localStorage.getItem(LS_R) === "1");
  const [romanText, setRomanText] = R.useState(null);
  const [romanStatus, setRomanStatus] = R.useState("idle");
  const [romanError, setRomanError] = R.useState("");
  const [edit, setEdit] = R.useState(null);
  const [track, setTrack] = R.useState(getTrack());
  const [rev, setRev] = R.useState(0);
  const [off, setOff] = R.useState(0);
  const st = R.useRef({
    segs: null, lines: [], mode: "red", off: 0, bars: new Float32Array(N), si: 0, bpm: 110,
    lidx: -99, widx: -2, glitch: 0, prevE: 0, lvl: 0, avg: 0, flash: 0, mx: 1, dirty: true, drawn: "",
    lastP: -1, lastE: -1, lastEt: 0
  });
  st.current.mode = mode; st.current.off = off;
  const uri = track && track.uri;

  R.useEffect(() => {
    const f = () => setTrack(getTrack());
    Spicetify.Player.addEventListener("songchange", f);
    return () => Spicetify.Player.removeEventListener("songchange", f);
  }, []);

  // audio analysis (cached) — drives the spectrum + glow
  R.useEffect(() => {
    let dead = false;
    const s = st.current;
    s.segs = null; s.si = 0; s.bpm = bpmOf(uri || ""); setAna(uri ? "wait" : "none");
    if (!uri) return;
    loadAnalysis(uri).then((g) => { if (dead) return; s.segs = g; setAna(g ? "ok" : "none"); });
    return () => { dead = true; };
  }, [uri]);

  // per-song lyric timing offset
  R.useEffect(() => { setOff(uri ? +localStorage.getItem(LS_O + uri) || 0 : 0); setEdit(null); }, [uri]);

  // lyrics
  R.useEffect(() => {
    let dead = false;
    setLines([]); setSrc("none");
    if (!track) return;
    (async () => {
      const saved = localStorage.getItem(LS_L + track.uri);
      let L = null, s = "none";
      if (saved) { L = parseText(saved, track.dur); s = "custom"; }
      else if (track.uri.startsWith("spotify:track:")) {
        L = await fetchSpotify(track.uri.split(":")[2], track.dur);
        if (L) s = "spotify";
      }
      if (dead) return;
      setLines(L || []); setSrc(L && L.length ? s : "none");
    })();
    return () => { dead = true; };
  }, [uri, rev]);

  const textVersion = lyricsVersion(lines);
  const lang = lyricLanguage(lines.map((line) => line.words).join("\n"));
  const romanSupported = !!lang;
  R.useEffect(() => {
    let dead = false;
    const controller = new AbortController();
    setRomanText(null);
    setRomanError("");
    setRomanStatus("idle");
    if (!romanize || !lang || !lines.length || !uri) return () => controller.abort();
    const key = uri + "\n" + lang + "\n" + textVersion;
    if (romanCache.has(key)) {
      setRomanText(romanCache.get(key));
      setRomanStatus("ready");
      return () => controller.abort();
    }
    setRomanStatus("loading");
    (async () => {
      try {
        const result = await fetchRomanizedLines(lines, lang, controller.signal);
        if (dead) return;
        romanCache.set(key, result);
        if (romanCache.size > 16) romanCache.delete(romanCache.keys().next().value);
        setRomanText(result);
        setRomanStatus("ready");
      } catch (e) {
        if (dead || controller.signal.aborted) return;
        controller.abort();
        setRomanError(e && e.message ? e.message : "Could not romanize these lyrics.");
        setRomanStatus("error");
      }
    })();
    return () => { dead = true; controller.abort(); };
  }, [uri, textVersion, lang, romanize]);

  const shownLines = R.useMemo(() => {
    if (!romanize || !romanText || romanText.length !== lines.length) return lines;
    return lines.map((line, i) => ({
      ...line,
      sep: lyricLanguage(line.words) ? " " : "",
      w: lyricLanguage(line.words) ? alignRomanized(romanText[i], line.w, line.end) : line.w
    }));
  }, [lines, romanize, romanText]);

  R.useEffect(() => {
    const s = st.current;
    s.lines = shownLines; s.lidx = -99; s.widx = -2; s.lastP = -1; s.lastE = -1;
  }, [shownLines]);

  R.useEffect(() => {
    const c = cv.current, ctx = c.getContext("2d", { alpha: false }), s = st.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0, raf, last = performance.now();
    const fit = () => {
      const r = c.parentElement.getBoundingClientRect();
      W = Math.max(200, r.width); H = Math.max(120, r.height);
      c.width = (W * dpr) | 0; c.height = (H * dpr) | 0;
      c.style.width = W + "px"; c.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.dirty = true; s.lidx = -99; // redraw + re-center the lyrics after a resize
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(c.parentElement);

    const spectrum = (pos, playing, dt) => {
      const t = pos / 1000, segs = s.segs, b = s.bars;
      let energy = 0, g = null, mx = 0;
      s.flash = Math.max(0, s.flash - dt * 4);
      if (playing && segs) {
        let i = s.si;
        if (i >= segs.length || segs[i].start > t) i = 0;
        while (i < segs.length - 1 && segs[i + 1].start <= t) i++;
        s.si = i; g = segs[i];
        energy = clamp((g.loudness_max + 38) / 38, 0, 1) * (0.55 + 0.45 * Math.exp(-(t - g.start) * 7));
      } else if (playing) {
        // no analysis for this track: steady pulse + a bump on every sung word
        energy = clamp(0.4 + 0.32 * Math.exp(-((t * s.bpm / 60) % 1) * 5) + 0.14 * s.flash, 0, 1);
      }
      for (let k = 0; k < N; k++) {
        const f = k / (N - 1), center = 1 - Math.abs(f - 0.5) * 0.5;
        let v = 0;
        if (playing) {
          if (g) {
            const fp = f * 11, i0 = fp | 0, i1 = Math.min(11, i0 + 1), p = g.pitches[i0] * (1 - (fp - i0)) + g.pitches[i1] * (fp - i0);
            v = (0.3 + 0.7 * p) * energy * center + Math.random() * 0.12 * energy;
          } else v = (0.35 + 0.65 * Math.abs(Math.sin(k * 0.5 + t * 6) * Math.sin(k * 0.17 - t * 3))) * energy * center;
        }
        const a = v > b[k] ? 0.55 : 0.14;
        b[k] += (clamp(v, 0, 1) - b[k]) * (1 - Math.pow(1 - a, dt * 60));
        if (b[k] > mx) mx = b[k];
      }
      s.mx = mx;
      if (energy > s.prevE * 1.3 + 0.08) s.glitch = 1;
      else if (Math.random() < 0.003) s.glitch = Math.max(s.glitch, 0.5);
      s.prevE += (energy - s.prevE) * 0.1;
      s.glitch = Math.max(0, s.glitch - dt * 3.5);
      // level used by the lyric glow: fast attack, slower release, compared with a running average
      s.lvl += (energy - s.lvl) * (1 - Math.pow(1 - (energy > s.lvl ? 0.5 : 0.12), dt * 60));
      s.avg += (s.lvl - s.avg) * (1 - Math.pow(0.98, dt * 60));
    };

    const draw = () => {
      const red = s.mode === "red", main = red ? "#ff2a3d" : "#ffffff", ghost = red ? "#ffffff" : "#ff2a3d", g = s.glitch;
      ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const fs = clamp(H * 0.11, 16, 54), band = fs * 0.75, cy = H / 2;
      const maxH = H / 2 - band - 6, blk = Math.max(4, H / 48), bw = W / N, rows = Math.max(1, Math.floor(maxH / blk));
      const bars = (ox, color, alpha) => {
        ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
        const w = Math.max(1, bw - 3);
        for (let k = 0; k < N; k++) {
          const n = Math.min(rows, Math.max(1, Math.round(s.bars[k] * rows))), x = k * bw + 1.5 + ox;
          for (let y = 0; y < n; y++) {
            ctx.rect(x, cy - band - (y + 1) * blk, w, blk - 2);
            ctx.rect(x, cy + band + y * blk + 2, w, blk - 2);
          }
        }
        ctx.fill();
      };
      if (g > 0.05) { bars((Math.random() - 0.5) * g * 24, ghost, 0.45 * g); }
      bars(0, main, 1);
      ctx.globalAlpha = 1;
      if (g > 0.15) {
        ctx.fillStyle = main;
        for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 8 + Math.random() * 50 * g, 2 + Math.random() * 4);
        for (let i = 0; i < 3; i++) {
          const y = (Math.random() * H) | 0, hh = (4 + Math.random() * H * 0.12) | 0, dx = (Math.random() - 0.5) * g * 70;
          ctx.drawImage(c, 0, y * dpr, c.width, hh * dpr, dx, y, W, hh);
        }
      }
      ctx.font = `800 ${fs}px "Courier New", monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if ("letterSpacing" in ctx) ctx.letterSpacing = fs * 0.2 + "px";
      if (g > 0.2) { ctx.fillStyle = ghost; ctx.globalAlpha = 0.7; ctx.fillText("oyaa-viz", W / 2 + (Math.random() - 0.5) * g * 16, cy); ctx.globalAlpha = 1; }
      ctx.fillStyle = main; ctx.fillText("oyaa-viz", W / 2, cy);
    };

    const lyricsUpdate = (pos, playing, now) => {
      const L = s.lines, box = lyr.current;
      if (!L.length || !box || box.children.length !== L.length) return;
      let i = -1;
      if (pos >= L[0].t) {
        i = Math.max(0, s.lidx);
        if (L[i].t > pos) i = 0;
        while (i < L.length - 1 && L[i + 1].t <= pos) i++;
      }
      const els = box.children;
      if (i !== s.lidx) {
        const old = s.lidx;
        if (old >= 0 && els[old]) els[old].style.removeProperty("--e");
        s.lidx = i; s.widx = -2; s.lastP = -1; s.lastE = -1;
        for (let k = 0; k < els.length; k++) els[k].className = "ln" + (k < i ? " past" : k === i ? " active" : "");
        const el = els[Math.max(0, i)];
        if (el) box.style.transform = `translateY(${box.parentElement.clientHeight / 2 - (el.offsetTop + el.offsetHeight / 2)}px)`;
      }
      if (i < 0) return;
      const el = els[i], ws = L[i].w, sp = el.children;
      // which word is being sung
      let j = s.widx < -1 ? -1 : s.widx;
      if (j >= ws.length || (j >= 0 && ws[j].t > pos)) j = -1;
      while (j < ws.length - 1 && ws[j + 1].t <= pos) j++;
      if (j !== s.widx) {
        if (j >= 0 && j > s.widx) s.flash = 1; // a new word starts: flash
        s.widx = j; s.lastP = -1;
        for (let k = 0; k < sp.length; k++) sp[k].className = "w" + (k < j ? " d" : k === j ? " c" : "");
        if (j >= 0 && sp[j]) sp[j].style.setProperty("--p", "0");
      }
      if (j >= 0 && sp[j]) {
        const w = ws[j], p = clamp((pos - w.t) / Math.max(1, w.e - w.t), 0, 1) * 100;
        if (Math.abs(p - s.lastP) > 0.8 || (p === 100 && s.lastP !== 100)) { s.lastP = p; sp[j].style.setProperty("--p", p.toFixed(1)); }
      }
      // glow strength follows the music (and flashes on each word); ~30 updates/s on one element only
      if (now - s.lastEt > 33) {
        s.lastEt = now;
        const e = playing ? clamp(0.35 + (s.lvl - s.avg) * 2.6 + s.flash * 0.45, 0, 1) : 0;
        if (Math.abs(e - s.lastE) > 0.03) { s.lastE = e; el.style.setProperty("--e", e.toFixed(2)); }
      }
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      try {
        const playing = Spicetify.Player.isPlaying(), pos = Spicetify.Player.getProgress();
        spectrum(pos, playing, dt);
        // paused and fully faded out: nothing changes, so don't redraw the canvas
        if (playing || s.glitch > 0.01 || s.mx > 0.004 || s.dirty || s.drawn !== s.mode) { draw(); s.dirty = false; s.drawn = s.mode; }
        lyricsUpdate(pos - s.off, playing, now);
      } catch (e) { console.error("oyaa-viz frame error", e); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const setColor = (m) => { setMode(m); store(LS_C, m); };
  const setRoman = (enabled) => { setRomanize(enabled); store(LS_R, enabled ? "1" : "0"); };
  const bump = (d) => {
    const v = d === 0 ? 0 : clamp(Math.round((off + d) / 10) * 10, -10000, 10000);
    setOff(v); if (uri) store(LS_O + uri, v ? String(v) : null);
  };
  const openEdit = () => {
    if (!track) return;
    const saved = localStorage.getItem(LS_L + track.uri);
    setEdit(saved || (lines.length ? lines.map((l) => fmt(l.t) + " " + l.words).join("\n") : ""));
  };
  const save = (text) => {
    store(LS_L + track.uri, text.trim() ? text : null);
    setEdit(null); setRev((r) => r + 1);
  };
  const reset = () => { store(LS_L + track.uri, null); setEdit(null); setRev((r) => r + 1); };

  const title = [
    src !== "none" ? "lyrics · " + src : "no lyrics",
    ana === "ok" ? "spectrum · analysis" : ana === "none" ? "spectrum · generic" : "",
    romanStatus === "loading" ? "romanizing lyrics…" : romanStatus === "error" ? "romanization failed" : ""
  ].filter(Boolean).join("  |  ");

  return h("div", { className: "oyaa " + mode },
    h("div", { className: "oyaa-top" },
      h("div", {
        className: "oyaa-title",
        title: romanStatus === "error" ? romanError : "",
        role: romanStatus === "loading" || romanStatus === "error" ? "status" : null,
        "aria-live": romanStatus === "loading" || romanStatus === "error" ? "polite" : null
      }, title),
      h("div", { className: "oyaa-sync", title: "Lyric timing for this song. + shows lyrics later, − earlier. Click the number to reset." },
        h("button", { className: "oyaa-btn", onClick: () => bump(-100) }, "−"),
        h("button", { className: "oyaa-btn ghost", onClick: () => bump(0) }, (off > 0 ? "+" : "") + (off / 1000).toFixed(1) + "s"),
        h("button", { className: "oyaa-btn", onClick: () => bump(100) }, "+")),
      h("button", { className: "oyaa-btn" + (mode === "red" ? " on" : ""), onClick: () => setColor("red") }, "red"),
      h("button", { className: "oyaa-btn" + (mode === "white" ? " on" : ""), onClick: () => setColor("white") }, "white"),
      romanSupported && h("button", {
        className: "oyaa-btn" + (romanize ? " on" : ""),
        title: "Sends lyric text to Google Translate for romanization.",
        "aria-pressed": romanize,
        onClick: () => setRoman(!romanize)
      }, "roman"),
      h("button", { className: "oyaa-btn", onClick: openEdit }, "edit lyrics")),
    h("div", { className: "oyaa-body" },
      h("div", { className: "oyaa-left" },
        h("div", { className: "oyaa-viz" }, h("canvas", { ref: cv })),
        h("div", { className: "oyaa-name" }, track ? track.name : "nothing playing"),
        h("div", { className: "oyaa-artist" }, track ? track.artist : "")),
        h("div", { className: "oyaa-lyrics" },
          lines.length
          ? h("div", { className: "oyaa-scroll", ref: lyr },
              shownLines.map((l, i) => {
                const sep = l.sep != null ? l.sep : /\s/.test(l.words) ? " " : "";
                return h("div", { key: track.uri + "|" + rev + "|" + i, className: "ln", onClick: () => Spicetify.Player.seek(Math.max(0, l.t + st.current.off)) },
                  l.w.flatMap((w, j) => (j && sep ? [sep, h("span", { key: j, className: "w" }, w.s)] : [h("span", { key: j, className: "w" }, w.s)])));
              }))
          : h("div", { className: "oyaa-empty" }, track ? "No lyrics found. Press EDIT LYRICS to add your own." : "Play a song to start."))),
    edit !== null && h(Editor, { key: uri, initial: edit, onSave: save, onReset: reset, onCancel: () => setEdit(null) }));
}


let Boundary = null;
return function build() {
  const R = Spicetify.React;
  if (!Boundary) {
    Boundary = class extends R.Component {
      constructor(p) { super(p); this.state = { e: null }; }
      static getDerivedStateFromError(e) { return { e }; }
      render() {
        return this.state.e
          ? R.createElement("pre", { style: { color: "#ff2a3d", background: "#000", padding: 20, whiteSpace: "pre-wrap", fontSize: 12 } }, "oyaa-viz error:\n" + (this.state.e.stack || this.state.e))
          : this.props.children;
      }
    };
  }
  return R.createElement(Boundary, null, R.createElement(App));
};
})();

function render() { return __oyaaViz(); }