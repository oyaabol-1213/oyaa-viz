<!-- header -->

&nbsp;

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:000000,100:ff2a3d&height=160&section=header&text=oyaa-viz&fontColor=ffffff&fontSize=56&fontAlignY=38" alt="oyaa-viz" />
</p>

&nbsp;

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=18&duration=3000&pause=1000&color=FF2A3D&background=00000000&center=true&vCenter=true&width=480&lines=Spicetify+custom+apps;Glitch+visualizers+%26+synced+lyrics;AMOLED+black+%2B+a+little+red" alt="typing" />
</p>

&nbsp;

<p align="center">
  <a href="https://github.com/oyaabol-1213/oyaa-viz/releases/latest"><img src="https://img.shields.io/github/v/release/oyaabol-1213/oyaa-viz?style=for-the-badge&labelColor=000000&color=ff2a3d" alt="latest release" /></a>
  <a href="https://github.com/oyaabol-1213/oyaa-viz/releases/latest"><img src="https://img.shields.io/github/downloads/oyaabol-1213/oyaa-viz/total?style=for-the-badge&labelColor=000000&color=ffffff" alt="downloads" /></a>
</p>

&nbsp;

---

### 👋 About me

- 🎧 I make custom apps for Spotify with **Spicetify**
- 🔴 Currently shipping [**oyaa-viz**](https://github.com/oyaabol-1213/oyaa-viz), a glitch spectrum visualizer with karaoke lyrics
- 🖤 I like simple designs, AMOLED black, and things that run smooth
- 🛠️ Always tweaking, always learning

---

![preview](preview.png)

## Features

- Glitch spectrum visualizer with "oyaa-viz" inside, switch between **red** and **white**
- Liquid Lyrics-style synced lyrics beside the oyaa visualizer, with a choice of **Karaoke** word timing or calmer **Block** display
- The glow pulses with the music, and flashes on every new word
- **RED** / **WHITE** recolor the visualizer *and* the lyrics
- Animated cover-art background with adjustable blur and opacity in **LIQUID LYRICS SETTINGS**
- **CINEMA** mode and dedicated **FULLSCREEN** viewing
- Liquid Lyrics **CREATE / EDIT SYNC** with block or word timing, preview, undo, seeking, and timestamp nudging
- Persistent settings for lyric display, size, smooth scrolling, background, and per-track sync offset
- Per-song **sync offset** (− / + in the top bar) if the lyrics run early or late
- Click any lyric line to jump to it
- Pure black AMOLED background with lightweight canvas rendering

---

## Tutorial

### Before you start

You need **Spotify desktop** and **Spicetify** installed. If you don't have Spicetify yet, follow the [official guide](https://spicetify.app/docs/getting-started).

To check it works, open a terminal (PowerShell on Windows) and run:

```
spicetify -v
```

If it prints a version number, you're ready.

### Step 1: Download

1. Go to the [Releases page](https://github.com/oyaabol-1213/oyaa-viz/releases/latest).
2. Under **Assets**, download `oyaa-viz-vX.X.X.zip`.
3. Unzip it. You should see a folder named `oyaa-viz` with `index.js`, `style.css`, `manifest.json`, and `oyaa-viz-button.js` inside.

### Step 2: Put it in CustomApps

Copy the whole `oyaa-viz` folder into your Spicetify `CustomApps` folder:

| System | Folder |
| :---- | :---- |
| Windows | `%appdata%\spicetify\CustomApps\` |
| Linux / macOS | `~/.config/spicetify/CustomApps/` |

Tip: on Windows, press `Win + R`, paste `%appdata%\spicetify\CustomApps` and press Enter to open it.

The path should end up like `CustomApps/oyaa-viz/index.js`. If it's `CustomApps/oyaa-viz/oyaa-viz/index.js`, you copied one folder too deep.

### Step 3: Enable it

Open a terminal and run:

```
spicetify config custom_apps oyaa-viz
spicetify apply
```

Spotify restarts. Oyaa Viz is available from its waveform button in Spotify's top bar and from the custom apps sidebar.

### Step 4: Use it

1. Play a song and open oyaa-viz from its top bar button beside the other Spotify controls.
2. Press **RED** or **WHITE** to change the visualizer and lyric color. It remembers your choice.
3. Lyrics from Spotify show automatically and follow the song.
4. Click a lyric line to seek to that part of the song.
5. Lyrics too early or too late? Use **−** / **+** in the top bar (0.1s per click). The number resets it. It is saved per song.
6. Open **SETTINGS** to adjust the animated artwork background, blur, opacity, lyric display style and size, scrolling, and per-track offset. **CINEMA** and **FULLSCREEN** provide the immersive views.
7. Use **CREATE / EDIT SYNC** to add lyrics for a song or adjust their line and word timing. Saved edits stay on this device.

### Updating

1. Download the new zip from [Releases](https://github.com/oyaabol-1213/oyaa-viz/releases/latest).
2. Delete the old `oyaa-viz` folder in `CustomApps` and copy in the new one.
3. Run `spicetify apply`.

### Uninstalling

```
spicetify config custom_apps oyaa-viz-
spicetify apply
```

Then delete the `oyaa-viz` folder from `CustomApps`.

---

## Troubleshooting

**The app doesn't show in the sidebar** Make sure the folder is named exactly `oyaa-viz`, has `manifest.json` directly inside it, and that you ran `spicetify apply` after the config command.

**"Something went wrong" page** Update to the latest release. If it still happens, reset and re-apply:

```
spicetify restore backup apply
```

The app shows its own error text in red when something breaks. Please include that in an issue.

**Spotify updated and my apps disappeared** Spotify updates remove Spicetify changes. Run:

```
spicetify backup apply
```

**No lyrics show for a song** Spotify does not provide live lyrics for every track.

**Visualizer doesn't react to the music** The spectrum uses Spotify's audio analysis data. The top bar says `spectrum · analysis` when it is in use and `spectrum · generic` when it isn't. In generic mode it shows a steady pulse that also bumps on every sung word, so the lyrics still drive it.

---

### 🧰 Tools I use

<p>
  <img src="https://img.shields.io/badge/JavaScript-000000?style=for-the-badge&logo=javascript&logoColor=ff2a3d" />
  <img src="https://img.shields.io/badge/CSS-000000?style=for-the-badge&logo=css3&logoColor=ff2a3d" />
  <img src="https://img.shields.io/badge/HTML-000000?style=for-the-badge&logo=html5&logoColor=ff2a3d" />
  <img src="https://img.shields.io/badge/React-000000?style=for-the-badge&logo=react&logoColor=ff2a3d" />
  <img src="https://img.shields.io/badge/Spicetify-000000?style=for-the-badge&logo=spotify&logoColor=ff2a3d" />
  <img src="https://img.shields.io/badge/Git-000000?style=for-the-badge&logo=git&logoColor=ff2a3d" />
</p>

&nbsp;

### 📊 GitHub stats

<p>
  <img height="165" src="https://github-readme-stats.vercel.app/api?username=oyaabol-1213&show_icons=true&hide_border=true&bg_color=000000&title_color=ff2a3d&text_color=ffffff&icon_color=ff2a3d&ring_color=ff2a3d" />
  <img height="165" src="https://github-readme-stats.vercel.app/api/top-langs/?username=oyaabol-1213&layout=compact&hide_border=true&bg_color=000000&title_color=ff2a3d&text_color=ffffff" />
</p>

&nbsp;

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:ff2a3d,100:000000&height=90&section=footer" alt="" /></p>
