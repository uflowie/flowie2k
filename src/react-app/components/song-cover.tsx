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

/** Album art, or a generated gradient tile with the title's initial when there is none. */
export function SongCover({ song, className }: SongCoverProps) {
  const [failed, setFailed] = useState(false);
  const title = getSongTitle(song);
  const showImage = Boolean(song.thumbnail_path) && !failed;
  const hue = hueFor(title);

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[3px] [container-type:size]",
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              background: `linear-gradient(135deg, oklch(0.55 0.11 ${hue}), oklch(0.3 0.07 ${(hue + 50) % 360}))`,
            }
      }
    >
      {showImage ? (
        <img
          src={getThumbnailUrl(song.thumbnail_path!)}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[50cqh] leading-none font-bold text-white/85">
          {/\p{L}|\p{N}/u.exec(title)?.[0]?.toUpperCase() ?? "♪"}
        </span>
      )}
    </div>
  );
}
