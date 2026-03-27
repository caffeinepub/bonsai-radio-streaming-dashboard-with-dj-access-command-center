import { Clock, Music } from "lucide-react";
import type { Playlist } from "../backend";

interface PlaylistListProps {
  playlists: Playlist[];
}

export default function PlaylistList({ playlists }: PlaylistListProps) {
  if (playlists.length === 0) {
    return (
      <div className="text-center py-12">
        <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 font-mono">No playlists created yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {playlists.map((playlist) => (
        <div
          key={playlist.id}
          className="bg-black/40 rounded-lg border border-neon-purple/30 p-6 hover:border-neon-purple/60 transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-neon-cyan mb-1">
                {playlist.id}
              </h3>
              <p className="text-sm text-gray-400 font-mono">
                {playlist.tracks.length} track
                {playlist.tracks.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 text-neon-purple">
              <Music className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-2">
            {playlist.tracks.map((track, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">
                    {track.title}
                  </p>
                  <p className="text-sm text-gray-400 truncate">
                    {track.artist}
                  </p>
                  {track.album && (
                    <p className="text-xs text-gray-500 truncate">
                      {track.album}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="flex items-center gap-1 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {Math.floor(Number(track.duration) / 60)}:
                      {String(Number(track.duration) % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="text-sm text-neon-purple font-mono">
                    {track.playCount.toString()} plays
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
