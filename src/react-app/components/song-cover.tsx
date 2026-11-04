import { useState } from "react";

import { cn } from "@/lib/utils";
import { getThumbnailUrl } from "@/react-app/lib/queries";
import { getSongTitle } from "@/react-app/lib/songs";
import type { PlaylistSong } from "@/react-app/lib/types";

// Stable hue per title, so songs without cover art still get a distinct tile.
const hueFor = (text: string) => {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return hash % 360;
};

type SongCoverProps = {
  song: PlaylistSong;
  className?: string;
};

/** Album art, or a muted tile with the title's initial when there is none. */
export function SongCover({ song, className }: SongCoverProps) {
  const [failed, setFailed] = useState(false);
  const title = getSongTitle(song);
  const showImage = Boolean(song.thumbnail_path) && !failed;
  const hue = hueFor(title);

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[3px] @container-size",
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              background: `oklch(0.36 0.05 ${hue})`,
            }
      }
    >
      {showImage ? (
        <img
          src={getThumbnailUrl(song.thumbnail_path!, "small")}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[50cqh] leading-none font-bold text-white/60">
          {/\p{L}|\p{N}/u.exec(title)?.[0]?.toUpperCase() ?? "♪"}
        </span>
      )}
    </div>
  );
}
