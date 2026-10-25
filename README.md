# oyaa-viz

A Spicetify custom app: glitch audio spectrum visualizer with synced karaoke lyrics.

- AMOLED black, simple design, red or white visualizer
- "oyaa-viz" name inside the visualizer
- Synced lyrics from Spotify, glowing red gradient that fills top to bottom
- No lyrics for a song? Add your own with **EDIT LYRICS** (`[mm:ss.xx] text` for exact sync, or plain lines to spread evenly)
- Click a lyric line to seek

![preview](preview.png)

## Install

1. Copy this folder into your Spicetify `CustomApps` folder, named `oyaa-viz`
   (Windows: `%appdata%\spicetify\CustomApps\`, Linux/macOS: `~/.config/spicetify/CustomApps/`)
2. Run:
   ```
   spicetify config custom_apps oyaa-viz
   spicetify apply
   ```

## License

MIT
