<!-- header -->

&nbsp;

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:000000,100:ff2a3d&height=160&section=header&text=oyaa-viz&fontColor=ffffff&fontSize=56&fontAlignY=38" alt="oyaa-viz" />
</p>

&nbsp;

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=18&duration=3000&pause=1000&color=FF2A3D&background=00000000&center=true&vCenter=true&width=520&lines=Spicetify+extension;Glitch+visualizer+%26+synced+karaoke+lyrics;AMOLED+black+%2B+a+little+red" alt="typing" />
</p>

&nbsp;

<p align="center">
  <a href="https://github.com/oyaabol-1213/oyaa-viz/releases/latest"><img src="https://img.shields.io/github/v/release/oyaabol-1213/oyaa-viz?style=for-the-badge&labelColor=000000&color=ff2a3d" alt="latest release" /></a>
  <a href="https://github.com/oyaabol-1213/oyaa-viz/releases/latest"><img src="https://img.shields.io/github/downloads/oyaabol-1213/oyaa-viz/total?style=for-the-badge&labelColor=000000&color=ffffff" alt="downloads" /></a>
</p>

&nbsp;

---

### 👋 About me

- 🎧 I make extensions and custom apps for Spotify with **Spicetify**
- 🔴 Currently shipping [**oyaa-viz**](https://github.com/oyaabol-1213/oyaa-viz), a glitch spectrum visualizer with word-by-word karaoke lyrics
- 🖤 I like simple designs, AMOLED black, and things that run smooth
- 🛠️ Always tweaking, always learning

---

![preview](preview.png)

## Features

- **Glitch spectrum visualizer** with "oyaa-viz" inside it, on an open area (no card or frame). Switch between **red** and **white**.
- **Word-by-word synced lyrics** from Spotify: the word being sung fills in and glows. The glow, past lines and the visualizer all follow your red / white choice.
- **Animated background**, tinted to match the theme
- **Create / edit sync**: make or fix word-level synced lyrics for any song with the built-in editor (pencil button)
- **Cinema mode** and **fullscreen**
- **Settings** window for fonts, sizes, background, romanization and more (gear button)
- **Per-song delay** (− / +) if the lyrics run early or late
- **Visualizer side**: move the visualizer to the left or the right of the lyrics
- Opens from a **button in the top bar**, next to the Marketplace cart
- Installs as a normal **Spicetify extension**, straight from Marketplace

---

## Tutorial

This guide goes from nothing to a working oyaa-viz. Skip any step you have already done.

### Step 1: Install Spotify

Install the **Spotify desktop app** from [spotify.com/download](https://www.spotify.com/download). On Windows, use the installer from the website, not the Microsoft Store version. Open it once, log in, then close it.

### Step 2: Install Spicetify

Open a terminal and run the command for your system.

**Windows** (PowerShell):

```powershell
iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex
```

**Linux / macOS**:

```bash
curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh | sh
```

The script will ask if you also want to install the **Marketplace**. Answer **Yes** (Y). You need it for the easy install below.

Check that it worked:

```
spicetify -v
```

If it prints a version number, Spicetify is ready. (If the command is not found, close the terminal and open a new one.)

Official guide, in case something is different on your system: [spicetify.app/docs/getting-started](https://spicetify.app/docs/getting-started)

### Step 3: Install the Marketplace (only if you skipped it)

**Windows** (PowerShell):

```powershell
iwr -useb https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.ps1 | iex
```

**Linux / macOS**:

```bash
curl -fsSL https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.sh | sh
```

Open Spotify. You should see a **Marketplace** item in the left sidebar. If you don't, run `spicetify apply` and restart Spotify.

### Step 4: Install oyaa-viz

#### Option A: From the Marketplace (easiest)

1. Open Spotify and click **Marketplace** in the sidebar.
2. Go to the **Extensions** tab.
3. Search for **oyaa-viz**.
4. Click **Install**. No zip file needed.
5. Spotify reloads and the oyaa-viz button appears in the top bar.

If oyaa-viz does not show up in the list, use Option B.

#### Option B: Manual install

1. Download `oyaa-viz.js` from the [latest release](https://github.com/oyaabol-1213/oyaa-viz/releases/latest) (or from the repo's file list).
2. Copy it into your Spicetify **Extensions** folder:

   | System | Folder |
   | :---- | :---- |
   | Windows | `%appdata%\spicetify\Extensions\` |
   | Linux / macOS | `~/.config/spicetify/Extensions/` |

   Tip: on Windows, press `Win + R`, paste `%appdata%\spicetify\Extensions` and press Enter. You can also run `spicetify path userdata` to see where your Spicetify folder is.

3. Enable it and apply:

   ```
   spicetify config extensions oyaa-viz.js
   spicetify apply
   ```

Spotify restarts and the oyaa-viz button appears in the top bar.

### Step 5: Use it

1. Play a song.
2. Click the **oyaa-viz button** in the top bar (beside the Marketplace cart). The page opens. Click it again to close.
3. The visualizer is on the left and the lyrics are on the right. Lyrics follow the song automatically. Click a line to jump to it.
4. In the top-right corner of the page:

   | Control | What it does |
   | :---- | :---- |
   | **− / +** | Lyrics earlier or later, 0.1 s per click. Click the number to reset. Saved per song. |
   | **RED / WHITE** | Changes the color of the visualizer and the lyrics. It remembers your choice. |
   | Side arrows | Moves the visualizer to the other side. |
   | Image icon | Turns the animated background on or off. |
   | Pencil | Opens the editor to create or edit synced lyrics. |
   | Clapper | Cinema mode. |
   | Corners icon | Fullscreen (press `Esc` to leave). |
   | Gear | Settings. |

### Creating or fixing synced lyrics

If a song has no lyrics, or the timing is off:

1. Click the **pencil** icon.
2. Paste or type the lyrics, then follow the editor's steps to stamp the timing while the song plays.
3. Save. Your version is kept for that song only.

### Updating

- **Marketplace install:** open Marketplace, go to the Extensions tab, and reinstall oyaa-viz to get the newest version.
- **Manual install:** download the new `oyaa-viz.js`, replace the old one in your `Extensions` folder, then run `spicetify apply`.
- **After a Spotify update:** if Spicetify and oyaa-viz disappear, run `spicetify backup apply`.

### Uninstalling oyaa-viz

#### If you installed it from the Marketplace

1. Open Marketplace and go to the **Extensions** tab.
2. Find oyaa-viz in your installed list and click **Remove** (or the trash / delete button).
3. Reload Spotify.

#### If you installed it manually

```
spicetify config extensions oyaa-viz.js-
spicetify apply
```

The `-` at the end removes it from the config. You can then delete `oyaa-viz.js` from your `Extensions` folder.

#### If you used the old oyaa-viz custom app (v1)

```
spicetify config custom_apps oyaa-viz-
spicetify apply
```

Then delete the `oyaa-viz` folder from `CustomApps`. Do this before installing the new version, otherwise you would have two copies.

### Uninstalling Spicetify completely (optional)

1. Put Spotify back to normal: `spicetify restore`
2. **Windows:** delete the `spicetify` folders in `%appdata%` and `%localappdata%`.
3. **Linux / macOS:** delete `~/.spicetify` and `~/.config/spicetify`, and remove the Spicetify lines that were added to your shell profile (`.bashrc`, `.zshrc`, etc.).

---

## Troubleshooting

| Problem | Try this |
| :---- | :---- |
| The top-bar button does not appear | Run `spicetify apply` and fully restart Spotify (quit it from the tray, then open it again). |
| Spicetify disappeared after a Spotify update | Run `spicetify backup apply`. |
| Changes to the file do not show | A Marketplace install keeps its own copy. Remove it in Marketplace and install it again. For a manual install, replace the file and run `spicetify apply`. |
| Laggy or stuttering | Make sure **Use hardware acceleration** is on in Spotify's settings. In the oyaa-viz settings, turn the animated background off. |
| Lyrics are early or late | Use **−** / **+** at the top right of the page. |
| Two copies running | Remove the old custom app and any other lyrics extension you installed before. |
| Marketplace is stuck or blank | See the Marketplace troubleshooting steps at [spicetify.app/docs/customization/marketplace](https://spicetify.app/docs/customization/marketplace). |

---

<details>
<summary>For maintainers: showing up in the Marketplace Extensions tab</summary>

&nbsp;

The Marketplace finds extensions through GitHub. For oyaa-viz to be listed:

- The repo must be **public**.
- The repo needs the topic **`spicetify-extensions`** (repo page → gear next to *About* → Topics).
- `manifest.json`, `oyaa-viz.js`, `README.md` and `preview.png` must be at the **root** of the default branch.
- The `main` link inside `manifest.json` must open the raw `oyaa-viz.js` file in a browser.

New repos can take a while to appear in the Marketplace.

</details>

---

MIT License. See [LICENSE](LICENSE).
