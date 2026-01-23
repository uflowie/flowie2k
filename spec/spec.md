# UI
## Sidebar
The Sidebar is split into sections. Sections don't include a header.

### First Section
1. All Songs
2. Upload Song
3. Add New Playlist

### Second Section
1. Most Popular (All Songs ordered by seconds listened)
2. Most Recent (All Songs ordered by date added)
3. Most Popular 30 days (All Songs that were played in the last 30 days ordered by seconds listened)
4. Most Popular 90 days
5. Most Popular 365 days

### Third Section
All Custom Playlists ordered by last played

## Playback Controls
1. Pause/Play (same button)
2. Volume
3. Next/Previous Song
4. Playback Speed (slider, 50% - 150%, default 100%)
5. Shuffle (on/off)
6. Repeat Song (on/off)

## Playback Behavior
1. There is always an active playlist if there is a song playing - songs never play in isolation
2. If a song ends, the next song in the active playlist is played
3. Playlists always loop - if the last song in a playlist ends, the first song starts playing

# Data
## Song Metadata
- Name
- Artist
- Duration
- Album
- Date Added

## Song Statistics
- Last Played
- Seconds Listened
