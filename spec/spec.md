# UI
## Sidebar
The Sidebar is split into sections. Sections don't include a header.

### First Section
1. Upload Song
2. Upload Folder
2. Add New Playlist

### Second Section
1. All Songs
2. Most Popular (All Songs ordered by seconds listened)
3. Most Recent (All Songs ordered by date added)
4. Most Popular 30 days (All Songs that were played in the last 30 days ordered by seconds listened)
5. Most Popular 90 days
6. Most Popular 365 days

### Third Section
All Custom Playlists ordered by last played

## Playback Controls
Playback controls stay visible (sticky) and do not move when scrolling a long list.

Layout:
- Left: current song title only.
- Middle: Shuffle, Previous, Play/Pause, Next, Repeat.
- Right: remaining controls (playback speed, volume, etc).

Controls:
1. Pause/Play (same button)
2. Next/Previous Song
3. Shuffle (on/off)
4. Repeat Song (on/off)
5. Playback Speed (slider, 50% - 150%, default 100%) - important: we do NOT want to preserve pitch
6. Volume (slider)
7. Seek
Volume, Playback Speed, Shuffle and Repeat song need to be persisted in localstorage

## Playback Behavior
1. There is always an active playlist if there is a song playing - songs never play in isolation. 
2. If a playlist is not custom made, we do not need to log events for it though (All songs, Top X Songs etc)
3. If a song ends, the next song in the active playlist is played
4. Playlists always loop - if the last song in a playlist ends, the first song starts playing
5. Switching playlists (navigation or creation) must never change the currently playing song. Only explicitly clicking a song starts playback.
6. If no song has been selected yet, pressing Play starts the first song in the current playlist.

# Data
## Listening Events
- Seconds listened
- Started listening timestamp

## Song Metadata
- Name
- Artist
- Duration
- Album
- Date Added

## Song Statistics
These should be updated on analytics calls rather than being calculated from the listening events:
- Last Played
- Seconds Listened
