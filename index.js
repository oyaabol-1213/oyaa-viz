var __oyaaViz = (function () {
// oyaa-viz — Spicetify custom app
const LS_L = "oyaa-viz:lyrics:", LS_C = "oyaa-viz:color", LS_O = "oyaa-viz:offset:",
  LS_BG = "oyaa-viz:liquid-background", LS_BB = "oyaa-viz:liquid-blur", LS_BO = "oyaa-viz:liquid-opacity",
  LS_LS = "oyaa-viz:liquid-lyrics-style", LS_SCR = "oyaa-viz:liquid-smooth-scroll",
  LS_LF = "oyaa-viz:liquid-lyrics-size", LS_CM = "oyaa-viz:cinema", N = 48, LAG = 150;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isSp = (c) => /\s/.test(c);
const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };

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
    return Array.from(new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text), (part) => part.segment);
  }
  const parts = [];
  for (const part of Array.from(text)) {
    if (/\s/.test(part)) continue;
    if (parts.length && (/\p{Mark}|\uFE00-\uFE0F/u.test(part) || parts[parts.length - 1] === "\u200d")) parts[parts.length - 1] += part;
    else parts.push(part);
  }
  return parts;
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
  const syllabic = !!lyricLanguage(text) && !/\s/.test(text);
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
    const end = +y.endTimeMs;
    if (syllabic) {
      if (s) out.push({ t, e: isFinite(end) && end > t ? end : null, s });
    } else addChunk(out, st, t, s);
  }
  return out.length ? (syllabic ? out : splitTimedWords(out)) : null;
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
function buildW(l, finalLine) {
  const b = l.tw;
  if (b && b.length)
    return b.map((x, i) => {
      const lastEnd = finalLine ? Math.min(l.end, x.t + 4000) : l.end;
      const e = x.e || (b[i + 1] ? b[i + 1].t : lastEnd);
      return { t: x.t, e: Math.max(e, x.t + 1), s: x.s };
    });
  return estWords(l.words, l.t, l.end);
}
function finish(lines, dur) {
  lines.sort((a, b) => a.t - b.t);
  lines.forEach((l, i) => {
    l.end = i < lines.length - 1 ? lines[i + 1].t : Math.max(dur, l.t + 4000);
    l.w = buildW(l, i === lines.length - 1);
  });
  return lines;
}
function spread(arr, dur) {
  const step = dur / Math.max(arr.length, 1);
  return finish(arr.map((w, i) => ({ t: i * step, words: w })), dur);
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
function buildW(l, finalLine) {
  const b = l.tw;
  if (b && b.length)
    return b.map((x, i) => {
      const lastEnd = finalLine ? Math.min(l.end, x.t + 4000) : l.end;
      const e = x.e || (b[i + 1] ? b[i + 1].t : lastEnd);
      return { t: x.t, e: Math.max(e, x.t + 1), s: x.s };
    });
  return estWords(l.words, l.t, l.end);
}
function finish(lines, dur) {
  lines.sort((a, b) => a.t - b.t);
  lines.forEach((l, i) => {
    l.end = i < lines.length - 1 ? lines[i + 1].t : Math.max(dur, l.t + 4000);
    l.w = buildW(l, i === lines.length - 1);
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
/* ---------- data ---------- */

async function fetchLiquidLyrics(id, dur) {
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
  const metadata = it.metadata || {};
  const imageValue = (it.album && it.album.images && it.album.images[0] && it.album.images[0].url) ||
    metadata.image_url || Object.keys(metadata).filter((key) => /^image_x?/.test(key)).map((key) => metadata[key]).find((value) => typeof value === "string") || "";
  const image = typeof imageValue === "string" ? imageValue : "";
  const artwork = image.startsWith("spotify:image:")
    ? "https://i.scdn.co/image/" + image.slice("spotify:image:".length)
    : image;
  return { uri: it.uri, name: it.name, artist, artwork, dur: (it.duration && it.duration.milliseconds) || Spicetify.Player.getDuration() || 180000 };
}

/* ---------- Liquid Lyrics sync editor ---------- */

function Clock() {
  const R = Spicetify.React, h = R.createElement;
  const [v, setV] = R.useState(Spicetify.Player.getProgress());
  R.useEffect(() => {
    const id = setInterval(() => setV(Spicetify.Player.getProgress()), 80);
    return () => clearInterval(id);
  }, []);
  return h("span", { className: "mk-clock" }, fmt(v).slice(1, -1));
}

function editorTokens(text) {
  const tokens = [];
  let separator = "";
  for (const part of String(text || "").match(/\s+|[^\s]+/g) || []) {
    if (/^\s+$/.test(part)) {
      separator = tokens.length ? " " : "";
      continue;
    }
    const pieces = lyricLanguage(part) ? splitWords(part) : [part];
    pieces.forEach((value, i) => {
      tokens.push({ text: value, t: null, sep: i === 0 ? separator : "" });
      separator = "";
    });
  }
  return tokens;
}

function parseEditorRows(text) {
  const lineTime = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g;
  return String(text || "").split(/\r?\n/).flatMap((raw) => {
    const times = [...raw.matchAll(lineTime)];
    let content = raw.replace(lineTime, "").trim();
    if (!content) return [];
    const timedSegments = content.split(/<(\d+):(\d+(?:[.:]\d+)?)>/);
    const tokens = [];
    let trailingSpace = false;
    const append = (segmentText, time) => {
      const segment = editorTokens(segmentText);
      if (tokens.length && segment.length && (trailingSpace || /^\s/.test(segmentText))) segment[0].sep = " ";
      if (time != null && segment.length) segment[0].t = time;
      tokens.push(...segment);
      trailingSpace = /\s$/.test(segmentText);
    };
    if (timedSegments.length > 1) {
      append(timedSegments[0]);
      for (let i = 1; i + 2 < timedSegments.length; i += 3) {
        append(timedSegments[i + 2], tms(timedSegments[i], timedSegments[i + 1]));
      }
    } else append(content);
    if (!tokens.length) return [];
    const time = times.length ? tms(times[0][1], times[0][2]) : null;
    return [{ text: content.replace(/<[^>]*>/g, "").trim(), t: time, tokens }];
  });
}

function editorRowsText(rows) {
  return rows.filter((row) => row.text.trim()).map((row) => {
    const firstWordTime = row.tokens.find((word) => word.t != null);
    const lineTime = row.t != null ? row.t : firstWordTime && firstWordTime.t;
    const hasWordTiming = row.tokens.some((word) => word.t != null);
    const text = hasWordTiming ? row.tokens.map((word) =>
      word.sep + (word.t == null ? "" : "<" + fmt(word.t).slice(1, -1) + ">") + word.text
    ).join("") : row.text;
    return (lineTime == null ? "" : fmt(lineTime) + " ") + text;
  }).join("\n");
}

function lyricTextForEditor(lines) {
  return lines.map((line) => {
    const separator = /\s/.test(line.words) ? " " : "";
    const words = line.w.map((word) => "<" + fmt(word.t).slice(1, -1) + ">" + word.s);
    return fmt(line.t) + " " + words.join(separator);
  }).join("\n");
}

function LiquidSyncEditor(p) {
  const R = Spicetify.React, h = R.createElement;
  const [stage, setStage] = R.useState("text");
  const [mode, setMode] = R.useState("line");
  const [draft, setDraft] = R.useState(p.initial);
  const [rows, setRows] = R.useState([]);
  const [cursor, setCursor] = R.useState(0);
  const [pos, setPos] = R.useState(0);
  const list = R.useRef(null), act = R.useRef({});
  const targets = rows.flatMap((row, rowIndex) => mode === "line"
    ? [{ rowIndex, wordIndex: -1, text: row.text, t: row.t }]
    : row.tokens.map((word, wordIndex) => ({ rowIndex, wordIndex, text: word.text, t: word.t })));
  const targetRef = R.useRef([]);
  targetRef.current = targets;
  const currentRef = R.useRef({ rows, cursor });
  currentRef.current = { rows, cursor };

  const commit = (nextRows, nextCursor) => {
    currentRef.current = { rows: nextRows, cursor: nextCursor };
    setRows(nextRows);
    setCursor(nextCursor);
  };
  const tap = () => {
    const { rows: currentRows, cursor: currentCursor } = currentRef.current;
    const target = targetRef.current[currentCursor];
    if (!target) return;
    const nextRows = currentRows.map((row, i) => {
      if (i !== target.rowIndex) return row;
      if (target.wordIndex < 0) return { ...row, t: Math.max(0, Spicetify.Player.getProgress() - LAG) };
      return {
        ...row,
        tokens: row.tokens.map((word, j) => j === target.wordIndex
          ? { ...word, t: Math.max(0, Spicetify.Player.getProgress() - LAG) }
          : word)
      };
    });
    commit(nextRows, currentCursor + 1);
  };
  const undo = () => {
    const { rows: currentRows, cursor: currentCursor } = currentRef.current;
    const index = Math.min(currentCursor, targetRef.current.length) - 1;
    const target = targetRef.current[index];
    if (!target) return;
    const nextRows = currentRows.map((row, i) => {
      if (i !== target.rowIndex) return row;
      if (target.wordIndex < 0) return { ...row, t: null };
      return {
        ...row,
        tokens: row.tokens.map((word, j) => j === target.wordIndex ? { ...word, t: null } : word)
      };
    });
    if (target.t != null) Spicetify.Player.seek(Math.max(0, target.t - 2500));
    commit(nextRows, index);
  };
  const jump = (d) => Spicetify.Player.seek(Math.max(0, Spicetify.Player.getProgress() + d));
  const pick = (index) => {
    const target = targetRef.current[index];
    if (!target) return;
    setCursor(index);
    if (target.t != null) Spicetify.Player.seek(Math.max(0, target.t - 2500));
  };
  const nudge = (index, d) => {
    const target = targetRef.current[index];
    if (!target || target.t == null) return;
    const { rows: currentRows, cursor: currentCursor } = currentRef.current;
    const nextRows = currentRows.map((row, i) => {
      if (i !== target.rowIndex) return row;
      if (target.wordIndex < 0) return { ...row, t: Math.max(0, row.t + d) };
      return {
        ...row,
        tokens: row.tokens.map((word, j) => j === target.wordIndex
          ? { ...word, t: Math.max(0, word.t + d) }
          : word)
      };
    });
    commit(nextRows, currentCursor);
  };
  act.current = { tap, undo, jump };

  const beginSync = () => {
    const nextRows = parseEditorRows(draft);
    const nextTargets = nextRows.flatMap((row, rowIndex) => mode === "line"
      ? [{ rowIndex, t: row.t }]
      : row.tokens.map((word, wordIndex) => ({ rowIndex, wordIndex, t: word.t })));
    const c = nextTargets.findIndex((target) => target.t == null);
    commit(nextRows, c < 0 ? nextTargets.length : c);
    setStage("sync");
  };
  const toText = () => { setDraft(editorRowsText(rows)); setStage("text"); };

  R.useEffect(() => {
    if (stage !== "sync") return;
    const id = setInterval(() => setPos(Spicetify.Player.getProgress()), 250);
    return () => clearInterval(id);
  }, [stage]);

  R.useEffect(() => {
    if (stage !== "sync") return;
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
  }, [stage]);

  R.useEffect(() => {
    const box = list.current, el = box && box.children[cursor];
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: "smooth" });
  }, [cursor, stage]);

  const stamped = targets.filter((target) => target.t != null).length;
  let playIdx = -1, bt = -1;
  targets.forEach((target, k) => { if (target.t != null && target.t <= pos && target.t >= bt) { bt = target.t; playIdx = k; } });
  const save = () => p.onSave(stage === "text" ? draft : editorRowsText(rows));

  const tabs = h("div", { className: "ll-editor-steps" },
    ["text", "sync", "preview"].map((item, index) => h("button", {
      key: item,
      className: "ll-editor-step" + (stage === item ? " active" : ""),
      onClick: () => {
        if (item === "text") toText();
        else if (item === "sync") beginSync();
        else {
          if (stage === "text") {
            const parsed = parseEditorRows(draft);
            commit(parsed, 0);
          }
          setStage("preview");
        }
      }
    }, (index + 1) + " · " + item)));
  const foot = h("div", { className: "oyaa-row" },
    h("button", { className: "oyaa-btn", onClick: p.onReset }, "use live lyrics"),
    h("button", { className: "oyaa-btn", onClick: p.onCancel }, "cancel"),
    h("button", { className: "oyaa-btn on", onClick: save }, "save"));

  if (stage === "text")
    return h("div", { className: "oyaa-modal ll-sync-editor" },
      h("div", { className: "ll-editor-heading" },
        h("div", null, h("strong", null, "Sync Editor"), h("span", null, trackLabel(p.track))),
        tabs),
      h("div", { className: "oyaa-hint" },
        "Paste lyrics, import timestamped LRC text, then choose Block or Karaoke sync. Karaoke mode stamps each word as the song plays."),
      h("textarea", { value: draft, onChange: (e) => setDraft(e.target.value), spellCheck: false, placeholder: "Paste lyrics here, one line per lyric." }),
      foot);

  const nxt = cursor < targets.length ? targets[cursor].text : "";
  const content = stage === "preview"
    ? h("div", { className: "ll-editor-preview" },
        rows.map((row, i) => h("div", { key: i, className: "ll-preview-line" },
          h("time", null, fmt(row.t != null ? row.t : (row.tokens.find((word) => word.t != null) || {}).t || 0).slice(1, -1)),
          row.text)))
    : h("div", { className: "ll-editor-sync-body" },
        h("div", { className: "ll-editor-mode-switch" },
          ["line", "word"].map((item) => h("button", {
            key: item,
            className: "oyaa-btn" + (mode === item ? " on" : ""),
            onClick: () => { setMode(item); setCursor(0); }
          }, item === "line" ? "block sync" : "karaoke sync"))),
        h("div", { className: "mk-bar" },
          h(Clock),
          h("div", { className: "mk-stat" }, stamped + " / " + targets.length + (mode === "line" ? " lines synced" : " words synced")),
          h("button", { className: "oyaa-btn", onClick: () => Spicetify.Player.seek(0) }, "restart"),
          h("button", { className: "oyaa-btn", onClick: () => jump(-5000) }, "−5s"),
          h("button", { className: "oyaa-btn", onClick: () => Spicetify.Player.togglePlay() }, "play / pause"),
          h("button", { className: "oyaa-btn", onClick: () => jump(5000) }, "+5s")),
        h("div", { className: "mk-bar" },
          h("button", { className: "oyaa-btn big", onClick: tap, disabled: !targets.length || cursor >= targets.length }, cursor >= targets.length && targets.length ? "done" : "tap · enter"),
          h("button", { className: "oyaa-btn", onClick: undo }, "undo · ⌫"),
          h("div", { className: "mk-next" }, nxt ? "next: " + nxt : rows.length ? "all lines stamped, press SAVE" : "Paste lyrics in the TEXT tab first")),
        h("div", { className: "mk-list", ref: list },
          targets.map((target, k) => h("div", { key: k, className: "mk-row" + (k === cursor ? " cur" : "") + (k === playIdx ? " play" : ""), onClick: () => pick(k) },
            h("span", { className: "mk-t" + (target.t == null ? " none" : "") }, target.t == null ? "--:--.--" : fmt(target.t).slice(1, -1)),
            h("span", { className: "mk-x" }, target.text),
            target.t != null && h("span", { className: "mk-nudge" },
              h("button", { className: "mk-n", title: "0.1s earlier", onClick: (e) => { e.stopPropagation(); nudge(k, -100); } }, "−"),
              h("button", { className: "mk-n", title: "0.1s later", onClick: (e) => { e.stopPropagation(); nudge(k, 100); } }, "+"))))),
        h("div", { className: "oyaa-hint" },
          mode === "line"
            ? "Play the song and press ENTER (or TAP) when each line starts. Click a line to seek; use − / + to adjust its timestamp."
            : "Play the song and press ENTER (or TAP) on every sung word. Use ⌫ to undo and rewind, or click a word to seek and adjust it."),
        foot);
  return h("div", { className: "oyaa-modal ll-sync-editor" },
    h("div", { className: "ll-editor-heading" },
      h("div", null, h("strong", null, "Sync Editor"), h("span", null, trackLabel(p.track))),
      tabs),
    content,
    stage === "preview" && h("div", { className: "ll-editor-preview-actions" },
      h("button", { className: "oyaa-btn", onClick: () => setStage("sync") }, "back to sync"),
      foot));
}

function trackLabel(track) { return track ? track.name + " · " + track.artist : "No track playing"; }

function LiquidSettings(p) {
  const R = Spicetify.React, h = R.createElement;
  return h("div", { className: "oyaa-settings", role: "dialog", "aria-label": "Liquid Lyrics settings" },
    h("div", { className: "oyaa-settings-head" },
      h("strong", null, "Liquid Lyrics settings"),
      h("button", { className: "oyaa-btn ghost", onClick: p.onClose, "aria-label": "Close settings" }, "×")),
    h("div", { className: "ll-settings-section" }, "Background"),
    h("label", { className: "oyaa-setting" },
      h("span", null, "animated cover-art background"),
      h("input", { type: "checkbox", checked: p.background, onChange: (e) => p.onBackground(e.target.checked) })),
    h("label", { className: "oyaa-setting oyaa-setting-range" },
      h("span", null, "background blur"),
      h("input", { type: "range", min: 0, max: 48, step: 2, value: p.blur, onChange: (e) => p.onBlur(+e.target.value) }),
      h("output", null, p.blur + "px")),
    h("label", { className: "oyaa-setting oyaa-setting-range" },
      h("span", null, "background opacity"),
      h("input", { type: "range", min: 10, max: 80, step: 5, value: p.opacity, onChange: (e) => p.onOpacity(+e.target.value) }),
      h("output", null, p.opacity + "%")),
    h("div", { className: "ll-settings-section" }, "Lyrics"),
    h("label", { className: "oyaa-setting" },
      h("span", null, "display"),
      h("select", { value: p.lyricStyle, onChange: (e) => p.onLyricStyle(e.target.value) },
        h("option", { value: "karaoke" }, "Karaoke"),
        h("option", { value: "block" }, "Block"))),
    h("label", { className: "oyaa-setting oyaa-setting-range" },
      h("span", null, "lyric size"),
      h("input", { type: "range", min: 22, max: 56, step: 2, value: p.lyricSize, onChange: (e) => p.onLyricSize(+e.target.value) }),
      h("output", null, p.lyricSize + "px")),
    h("label", { className: "oyaa-setting" },
      h("span", null, "smooth scrolling"),
      h("input", { type: "checkbox", checked: p.smoothScroll, onChange: (e) => p.onSmoothScroll(e.target.checked) })),
    h("label", { className: "oyaa-setting oyaa-setting-range" },
      h("span", null, "track sync offset"),
      h("input", { type: "range", min: -10000, max: 10000, step: 100, value: p.offset, onChange: (e) => p.onOffset(+e.target.value) }),
      h("output", null, (p.offset > 0 ? "+" : "") + (p.offset / 1000).toFixed(1) + "s")),
    h("div", { className: "oyaa-settings-note" }, "Settings save on this device."));
}

/* ---------- app ---------- */

function App() {
  const R = Spicetify.React, h = R.createElement;
  const root = R.useRef(null), cv = R.useRef(null), lyr = R.useRef(null);
  const [lines, setLines] = R.useState([]);
  const [rev, setRev] = R.useState(0);
  const [src, setSrc] = R.useState("none");
  const [ana, setAna] = R.useState("wait");
  const [mode, setMode] = R.useState(localStorage.getItem(LS_C) === "white" ? "white" : "red");
  const savedBackgroundBlur = Number(localStorage.getItem(LS_BB));
  const savedBackgroundOpacity = Number(localStorage.getItem(LS_BO));
  const savedLyricsSize = Number(localStorage.getItem(LS_LF));
  const [background, setBackground] = R.useState(localStorage.getItem(LS_BG) !== "0");
  const [backgroundBlur, setBackgroundBlur] = R.useState(localStorage.getItem(LS_BB) === null || !Number.isFinite(savedBackgroundBlur) ? 24 : clamp(savedBackgroundBlur, 0, 48));
  const [backgroundOpacity, setBackgroundOpacity] = R.useState(localStorage.getItem(LS_BO) === null || !Number.isFinite(savedBackgroundOpacity) ? 48 : clamp(savedBackgroundOpacity, 10, 80));
  const [lyricStyle, setLyricStyle] = R.useState(localStorage.getItem(LS_LS) === "block" ? "block" : "karaoke");
  const [smoothScroll, setSmoothScroll] = R.useState(localStorage.getItem(LS_SCR) !== "0");
  const [lyricSize, setLyricSize] = R.useState(localStorage.getItem(LS_LF) === null || !Number.isFinite(savedLyricsSize) ? 42 : clamp(savedLyricsSize, 22, 56));
  const [cinema, setCinema] = R.useState(localStorage.getItem(LS_CM) === "1");
  const [fullscreen, setFullscreen] = R.useState(!!document.fullscreenElement);
  const [settings, setSettings] = R.useState(false);
  const [viewError, setViewError] = R.useState("");
  const [edit, setEdit] = R.useState(null);
  const [track, setTrack] = R.useState(getTrack());
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

  R.useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
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
        L = await fetchLiquidLyrics(track.uri.split(":")[2], track.dur);
        if (L) s = "live";
      }
      if (dead) return;
      setLines(L || []); setSrc(L && L.length ? s : "none");
    })();
    return () => { dead = true; };
  }, [uri, rev]);

  const shownLines = lines;

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
          const y = (Math.random() * H) | 0, hh = (2 + Math.random() * H * 0.025) | 0;
          ctx.fillRect(0, y, W * (0.12 + Math.random() * 0.28), hh);
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
        for (let k = 0; k < els.length; k++) els[k].className = "ll-line" + (k < i ? " past" : k === i ? " active" : "");
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
        for (let k = 0; k < sp.length; k++) sp[k].className = "ll-word" + (k < j ? " d" : k === j ? " c" : "");
        if (j >= 0 && sp[j]) {
          sp[j].style.setProperty("--p", "0");
          sp[j].style.setProperty("--lift", "2px");
          sp[j].style.setProperty("--scale", "0.97");
        }
      }
      if (j >= 0 && sp[j]) {
        const w = ws[j], p = clamp((pos - w.t) / Math.max(1, w.e - w.t), 0, 1) * 100;
        if (Math.abs(p - s.lastP) > 0.8 || (p === 100 && s.lastP !== 100)) {
          s.lastP = p;
          sp[j].style.setProperty("--p", p.toFixed(1));
          sp[j].style.setProperty("--lift", (2 - p * 0.04).toFixed(2) + "px");
          sp[j].style.setProperty("--scale", (0.97 + p * 0.0003).toFixed(3));
        }
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
  const setBackgroundEnabled = (enabled) => { setBackground(enabled); store(LS_BG, enabled ? "1" : "0"); };
  const setBlur = (value) => { setBackgroundBlur(value); store(LS_BB, String(value)); };
  const setBackgroundAlpha = (value) => { setBackgroundOpacity(value); store(LS_BO, String(value)); };
  const setLyricsStyle = (value) => { setLyricStyle(value); store(LS_LS, value); };
  const setScrollEnabled = (enabled) => { setSmoothScroll(enabled); store(LS_SCR, enabled ? "1" : "0"); };
  const setLyricsSize = (value) => { setLyricSize(value); store(LS_LF, String(value)); };
  const toggleCinema = () => {
    const next = !cinema;
    setCinema(next);
    store(LS_CM, next ? "1" : "0");
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current) await root.current.requestFullscreen();
      setViewError("");
    } catch (e) {
      console.error("oyaa-viz fullscreen error", e);
      setViewError("Fullscreen is unavailable in this Spotify view.");
    }
  };
  const bump = (d) => {
    const v = d === 0 ? 0 : clamp(Math.round((off + d) / 10) * 10, -10000, 10000);
    setOff(v); if (uri) store(LS_O + uri, v ? String(v) : null);
  };
  const openEdit = () => {
    if (!track) return;
    const saved = localStorage.getItem(LS_L + track.uri);
    setEdit(saved || (lines.length ? lyricTextForEditor(lines) : ""));
  };
  const save = (text) => {
    store(LS_L + track.uri, text.trim() ? text : null);
    setEdit(null); setRev((r) => r + 1);
  };
  const reset = () => { store(LS_L + track.uri, null); setEdit(null); setRev((r) => r + 1); };

  const title = [
    src !== "none" ? "lyrics · " + src : "no lyrics",
    ana === "ok" ? "spectrum · analysis" : ana === "none" ? "spectrum · generic" : "",
    viewError
  ].filter(Boolean).join("  |  ");

  return h("div", {
    ref: root,
    className: "oyaa liquid-lyrics-app " + mode + (background && track && track.artwork ? " has-background" : "") + (cinema ? " cinema" : "") + (lyricStyle === "block" ? " block-lyrics" : "") + (!smoothScroll ? " still-scroll" : ""),
    style: {
      "--oyaa-bg-blur": backgroundBlur + "px",
      "--oyaa-bg-opacity": backgroundOpacity / 100,
      "--ll-lyrics-size": lyricSize + "px"
    }
  },
    h("div", {
      className: "oyaa-backdrop",
      "aria-hidden": true,
      style: { backgroundImage: background && track && track.artwork ? "url(" + JSON.stringify(track.artwork) + ")" : "none" }
    }),
    h("div", { className: "oyaa-top" },
      h("div", { className: "oyaa-title" }, title),
      h("div", { className: "oyaa-sync", title: "Lyric timing for this song. + shows lyrics later, − earlier. Click the number to reset." },
        h("button", { className: "oyaa-btn", onClick: () => bump(-100) }, "−"),
        h("button", { className: "oyaa-btn ghost", onClick: () => bump(0) }, (off > 0 ? "+" : "") + (off / 1000).toFixed(1) + "s"),
        h("button", { className: "oyaa-btn", onClick: () => bump(100) }, "+")),
      h("button", { className: "oyaa-btn" + (mode === "red" ? " on" : ""), onClick: () => setColor("red") }, "red"),
      h("button", { className: "oyaa-btn" + (mode === "white" ? " on" : ""), onClick: () => setColor("white") }, "white"),
      h("button", { className: "oyaa-btn", onClick: openEdit }, "create / edit sync"),
      h("button", {
        className: "oyaa-btn oyaa-cinema-toggle" + (cinema ? " on" : ""),
        onClick: toggleCinema,
        "aria-pressed": cinema,
        title: cinema ? "Exit cinema mode" : "Cinema mode"
      }, cinema ? "exit cinema" : "cinema"),
      h("button", {
        className: "oyaa-btn oyaa-fullscreen-toggle",
        onClick: toggleFullscreen,
        title: fullscreen ? "Exit fullscreen" : "Fullscreen"
      }, fullscreen ? "window" : "fullscreen"),
      h("button", {
        className: "oyaa-btn oyaa-settings-toggle" + (settings ? " on" : ""),
        onClick: () => setSettings(!settings),
        "aria-expanded": settings,
        title: "Lyrics settings"
      }, "settings")),
    h("div", { className: "oyaa-body" },
      h("div", { className: "oyaa-left" },
        h("div", { className: "oyaa-viz", "aria-label": "Audio visualizer" }, h("canvas", { ref: cv })),
        h("div", { className: "oyaa-name" }, track ? track.name : "nothing playing"),
        h("div", { className: "oyaa-artist" }, track ? track.artist : "")),
        h("div", { className: "liquid-lyrics-panel" },
          lines.length
          ? h("div", { className: "liquid-lyrics-scroll", ref: lyr },
              lines.map((l, i) => {
                const sep = l.sep != null ? l.sep : /\s/.test(l.words) ? " " : "";
                return h("div", { key: track.uri + "|" + i, className: "ll-line", onClick: () => Spicetify.Player.seek(Math.max(0, l.t + st.current.off)) },
                  l.w.flatMap((w, j) => (j && sep ? [sep, h("span", { key: j, className: "ll-word" }, w.s)] : [h("span", { key: j, className: "ll-word" }, w.s)])));
              }))
          : h("div", { className: "liquid-lyrics-empty" }, track ? "No lyrics available for this track. Use Create / Edit Sync to add your own." : "Play a song to start."))),
    settings && h(LiquidSettings, {
      background,
      blur: backgroundBlur,
      opacity: backgroundOpacity,
      lyricStyle,
      lyricSize,
      smoothScroll,
      offset: off,
      onBackground: setBackgroundEnabled,
      onBlur: setBlur,
      onOpacity: setBackgroundAlpha,
      onLyricStyle: setLyricsStyle,
      onLyricSize: setLyricsSize,
      onSmoothScroll: setScrollEnabled,
      onOffset: (value) => { setOff(value); if (uri) store(LS_O + uri, value ? String(value) : null); },
      onClose: () => setSettings(false)
    }),
    edit !== null && h(LiquidSyncEditor, { key: uri, initial: edit, track, onSave: save, onReset: reset, onCancel: () => setEdit(null) }));
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
