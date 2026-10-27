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
- Synced lyrics from Spotify with **word-by-word karaoke**: the word being sung fills left to right and glows  
- Optional persistent **ROMAN** toggle for Japanese, Korean, and Chinese lyrics, with karaoke timing retained
- Romanization is fetched from Google Translate only when enabled; the lyric text is sent to Google, not Spotify credentials, account details, or track IDs
- The glow pulses with the music, and flashes on every new word  
- **RED** / **WHITE** recolor the visualizer *and* the lyrics  
- Animated album-art background with adjustable blur in **SETTINGS**
- **CINEMA** mode and **FULLSCREEN** viewing for an immersive lyrics layout
- Built-in **LRC maker**: stamp your own lyrics while the song plays  
- Per-song **sync offset** (− / + in the top bar) if the lyrics run early or late  
- Song has no lyrics? Add your own with **EDIT LYRICS**  
- Click any lyric line to jump to it  
- Pure black AMOLED background, light on resources

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
3. Unzip it. You should see a folder named `oyaa-viz` with `index.js`, `style.css` and `manifest.json` inside.

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

Spotify restarts, and you'll see the **oyaa-viz** icon in the left sidebar.

### Step 4: Use it

1. Play a song and open oyaa-viz from the sidebar.  
2. Press **RED** or **WHITE** to change the visualizer and lyric color. It remembers your choice.  
3. Lyrics from Spotify show automatically and follow the song.  
4. Click a lyric line to seek to that part of the song.  
5. Lyrics too early or too late? Use **−** / **+** in the top bar (0.1s per click). The number resets it. It is saved per song.
6. For Japanese, Korean, or Chinese lyrics, turn on **ROMAN** to show romanized text. The preference is saved. Romanization sends lyric text only to Google Translate; it does not send Spotify credentials, account details, or track IDs. Turning ROMAN off keeps the original script visible.

Romanization requests are opt-in and use Google Translate's public endpoint. Google receives the selected lyric text and detected source language to produce romanization. If the request fails, the original lyrics remain available.

### Adding your own lyrics

If a song has no lyrics, or you want to use your own:

1. Press **EDIT LYRICS** at the top right.  
2. Paste your lyrics. There are two ways to write them.

**With timestamps (exact sync):**

```
[00:12.00] First line of the song
[00:16.50] Second line
[00:21.00] Third line
```

**Without timestamps (spread evenly across the song):**

```
First line of the song
Second line
Third line
```

3. Press **SAVE**. Your lyrics are saved for that song only.  
4. To go back to Spotify's lyrics, open **EDIT LYRICS** and press **USE SPOTIFY LYRICS**.

### LRC maker (stamp lyrics while the song plays)

1. Press **EDIT LYRICS**, paste plain lyrics (one line per row), then press **LRC MAKER**.  
2. Play the song. Press **ENTER** (or **TAP**) the moment each line starts. The next line is selected automatically.  
3. Made a mistake? **Backspace** (or **UNDO**) removes the last stamp and rewinds 2.5 seconds so you can redo it. Click any line to re-stamp it. **−** / **+** on a line nudges it by 0.1s.  
4. **←** / **→** jump 5 seconds. Taps are placed 0.15s early to cover your reaction time.  
5. Press **SAVE**. Lines without a stamp are left out.

Word timing is estimated from the line timing. If you want exact words, write them by hand in the TEXT tab:

```
[00:12.00] <00:12.00>First <00:12.50>line <00:13.10>here
```

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

**No lyrics show for a song** Not every song has lyrics on Spotify. Use **EDIT LYRICS** to add your own.

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