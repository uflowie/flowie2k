# Playback

## Starting playback

- Clicking a song plays it and sets the queue: the open playlist exactly as shown at that moment, in its current sort order and limited to the current search.
- Clicking the song that's already playing restarts it.
- The play button, with nothing loaded, starts the open playlist as shown: from the first song, or from a random song when shuffle is on.

## The queue

- The queue is fixed when playback starts. Searching, re-sorting, switching playlists or listening stats updating don't change it.
- To play in a new order or with a new search, click a song again.
- Songs added to the playing playlist afterwards aren't queued until playback is restarted from that playlist.
- Deleted songs, and songs removed from the playing playlist, are taken out of the queue. If the removed song is playing, the song after it starts, or playback stops if it was the only one.

## Next and previous

- Next plays the song after the current one in the queue; after the last song it continues with the first.
- Previous plays the song before the current one; before the first song it continues with the last.
- When a song ends, the next song plays.

## Shuffle

- With shuffle on, the clicked song plays first, followed by the rest of the queue in random order.
- Turning shuffle on mid-queue keeps the current song and shuffles the rest; turning it off returns to the order the songs were listed in, continuing from the current song.
- Shuffle only reorders the queue; it never adds songs that weren't in it.

## Repeat

- Repeat replays the current song when it ends, indefinitely. Next and previous still move through the queue.

## Sort and search

- Each playlist remembers its sort order permanently.
- Each playlist keeps its search until the page is reloaded.
- Neither affects what's playing; they only matter when playback is started from that playlist.
