var __oyaaViz = (function () {
// oyaa-viz — Spicetify custom app
const LS_L = "oyaa-viz:lyrics:", LS_C = "oyaa-viz:color", N = 48;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function finish(lines, dur) {
  lines.sort((a, b) => a.t - b.t);
  lines.forEach((l, i) => (l.end = i < lines.length - 1 ? lines[i + 1].t : Math.max(dur, l.t + 4000)));
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
    const w = l.replace(re, "").trim() || "♪";
    for (const t of tags) out.push({ t: (+t[1] * 60 + parseFloat(t[2].replace(":", "."))) * 1000, words: w });
  }
  if (timed) return finish(out, dur);
  const arr = raw.map((s) => s.trim()).filter(Boolean);
  return arr.length ? spread(arr, dur) : [];
}
function fmt(ms) {
  const s = ms / 1000, m = Math.floor(s / 60);
  return "[" + String(m).padStart(2, "0") + ":" + (s - m * 60).toFixed(2).padStart(5, "0") + "]";
}
async function fetchSpotify(id, dur) {
  try {
    const r = await Spicetify.CosmosAsync.get(
      `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`,
      null, { "app-platform": "WebPlayer" });
    const L = r && r.lyrics;
    if (!L || !L.lines || !L.lines.length) return null;
    const words = (l) => (l.words && l.words.trim() ? l.words : "♪");
    if (L.syncType === "LINE_SYNCED" || L.syncType === "SYLLABLE_SYNCED")
      return finish(L.lines.map((l) => ({ t: +l.startTimeMs, words: words(l) })), dur);
    return spread(L.lines.map((l) => l.words).filter(Boolean), dur);
  } catch (e) { return null; }
}
async function loadAnalysis(uri) {
  try {
    const d = await Spicetify.getAudioData(uri);
    return d && d.segments && d.segments.length ? d.segments : null;
  } catch (e) { return null; }
}
function getTrack() {
  const it = Spicetify.Player.data && Spicetify.Player.data.item;
  if (!it) return null;
  const artist = (it.artists && it.artists.map((a) => a.name).join(", ")) || (it.metadata && it.metadata.artist_name) || "";
  return { uri: it.uri, name: it.name, artist, dur: (it.duration && it.duration.milliseconds) || Spicetify.Player.getDuration() || 180000 };
}

function App() {
  const R = Spicetify.React, h = R.createElement;
  const cv = R.useRef(null), lyr = R.useRef(null);
  const [lines, setLines] = R.useState([]);
  const [src, setSrc] = R.useState("none");
  const [mode, setMode] = R.useState(localStorage.getItem(LS_C) || "red");
  const [edit, setEdit] = R.useState(false);
  const [draft, setDraft] = R.useState("");
  const [track, setTrack] = R.useState(getTrack());
  const [rev, setRev] = R.useState(0);
  const st = R.useRef({ segs: null, lines: [], mode: "red", bars: new Float32Array(N), si: 0, lidx: -99, glitch: 0, prevE: 0, lastP: -1 });
  st.current.mode = mode;

  R.useEffect(() => {
    const f = () => setTrack(getTrack());
    Spicetify.Player.addEventListener("songchange", f);
    return () => Spicetify.Player.removeEventListener("songchange", f);
  }, []);

  R.useEffect(() => {
    let dead = false;
    st.current.segs = null; st.current.si = 0;
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
    loadAnalysis(track.uri).then((s) => { if (!dead) st.current.segs = s; });
    return () => { dead = true; };
  }, [track && track.uri, rev]);

  R.useEffect(() => { st.current.lines = lines; st.current.lidx = -99; st.current.lastP = -1; }, [lines]);

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
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(c.parentElement);

    const spectrum = (pos, playing, dt) => {
      const t = pos / 1000, segs = s.segs, b = s.bars;
      let energy = 0, g = null;
      if (playing && segs) {
        let i = s.si;
        if (i >= segs.length || segs[i].start > t) i = 0;
        while (i < segs.length - 1 && segs[i + 1].start <= t) i++;
        s.si = i; g = segs[i];
        energy = clamp((g.loudness_max + 38) / 38, 0, 1) * (0.55 + 0.45 * Math.exp(-(t - g.start) * 7));
      } else if (playing) energy = 0.5 + 0.2 * Math.sin(t * 5);
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
      }
      if (energy > s.prevE * 1.3 + 0.08) s.glitch = 1;
      else if (Math.random() < 0.003) s.glitch = Math.max(s.glitch, 0.5);
      s.prevE += (energy - s.prevE) * 0.1;
      s.glitch = Math.max(0, s.glitch - dt * 3.5);
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

    const lyricsUpdate = (pos) => {
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
        s.lidx = i; s.lastP = -1;
        for (let k = 0; k < els.length; k++) els[k].className = "ln" + (k < i ? " past" : k === i ? " active" : "");
        const el = els[Math.max(0, i)];
        if (el) box.style.transform = `translateY(${box.parentElement.clientHeight / 2 - (el.offsetTop + el.offsetHeight / 2)}px)`;
      }
      if (i >= 0) {
        const p = clamp((pos - L[i].t) / Math.max(1, L[i].end - L[i].t), 0, 1) * 100;
        if (Math.abs(p - s.lastP) > 0.4) { s.lastP = p; els[i].style.setProperty("--p", p.toFixed(1)); }
      }
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      try {
        const playing = Spicetify.Player.isPlaying(), pos = Spicetify.Player.getProgress();
        spectrum(pos, playing, dt); draw(); lyricsUpdate(pos);
      } catch (e) { console.error("oyaa-viz frame error", e); }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const setColor = (m) => { setMode(m); localStorage.setItem(LS_C, m); };
  const openEdit = () => {
    if (!track) return;
    const saved = localStorage.getItem(LS_L + track.uri);
    setDraft(saved || (lines.length ? lines.map((l) => fmt(l.t) + " " + l.words).join("\n") : ""));
    setEdit(true);
  };
  const save = () => {
    if (draft.trim()) localStorage.setItem(LS_L + track.uri, draft); else localStorage.removeItem(LS_L + track.uri);
    setEdit(false); setRev((r) => r + 1);
  };
  const reset = () => { localStorage.removeItem(LS_L + track.uri); setEdit(false); setRev((r) => r + 1); };

  return h("div", { className: "oyaa" },
    h("div", { className: "oyaa-top" },
      h("div", { className: "oyaa-title" }, src !== "none" ? "lyrics · " + src : ""),
      h("button", { className: "oyaa-btn" + (mode === "red" ? " on" : ""), onClick: () => setColor("red") }, "red"),
      h("button", { className: "oyaa-btn" + (mode === "white" ? " on" : ""), onClick: () => setColor("white") }, "white"),
      h("button", { className: "oyaa-btn", onClick: openEdit }, "edit lyrics")),
    h("div", { className: "oyaa-body" },
      h("div", { className: "oyaa-left" },
        h("div", { className: "oyaa-viz" }, h("canvas", { ref: cv })),
        h("div", { className: "oyaa-name" }, track ? track.name : "nothing playing"),
        h("div", { className: "oyaa-artist" }, track ? track.artist : "")),
      h("div", { className: "oyaa-lyrics" },
        lines.length
          ? h("div", { className: "oyaa-scroll", ref: lyr },
              lines.map((l, i) => h("div", { key: track.uri + i, className: "ln", onClick: () => Spicetify.Player.seek(l.t) }, l.words)))
          : h("div", { className: "oyaa-empty" }, track ? "No lyrics found. Press EDIT LYRICS to add your own." : "Play a song to start."))),
    edit && h("div", { className: "oyaa-modal" },
      h("div", { className: "oyaa-hint" },
        "Paste lyrics. With timestamps like [01:23.45] text they sync exactly. Plain lines (no timestamps) are spread evenly across the song."),
      h("textarea", { value: draft, onChange: (e) => setDraft(e.target.value), spellCheck: false, placeholder: "[00:12.00] first line\n[00:16.50] second line" }),
      h("div", { className: "oyaa-row" },
        h("button", { className: "oyaa-btn", onClick: reset }, "use spotify lyrics"),
        h("button", { className: "oyaa-btn", onClick: () => setEdit(false) }, "cancel"),
        h("button", { className: "oyaa-btn on", onClick: save }, "save"))));
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
