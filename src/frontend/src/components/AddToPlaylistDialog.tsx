import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListMusic, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Track } from "../backend";
import {
  useAddTrackToPlaylist,
  useAddTracksToPlaylist,
  useGetPlaylists,
} from "../hooks/useQueries";

interface AddToPlaylistDialogProps {
  tracks: Track[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddToPlaylistDialog({
  tracks,
  open,
  onOpenChange,
}: AddToPlaylistDialogProps) {
  const { data: playlists = [], isLoading: playlistsLoading } =
    useGetPlaylists();
  const addTrackToPlaylist = useAddTrackToPlaylist();
  const addTracksToPlaylist = useAddTracksToPlaylist();
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [singlePlaylist, setSinglePlaylist] = useState<string>("");

  const isBatchMode = tracks.length > 1;

  const handleClose = () => {
    setSelectedPlaylists([]);
    setSinglePlaylist("");
    setMode("single");
    onOpenChange(false);
  };

  const handleTogglePlaylist = (playlistId: string) => {
    setSelectedPlaylists((prev) =>
      prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId)
        : [...prev, playlistId],
    );
  };

  const handleAddToPlaylists = async () => {
    if (tracks.length === 0) return;

    const targetPlaylists =
      mode === "single" ? [singlePlaylist] : selectedPlaylists;

    if (
      targetPlaylists.length === 0 ||
      (mode === "single" && !singlePlaylist)
    ) {
      toast.error("Please select at least one playlist");
      return;
    }

    try {
      const trackIds = tracks.map((track) => track.title);

      if (isBatchMode) {
        // Batch mode: add multiple tracks to playlists
        const promises = targetPlaylists.map((playlistId) =>
          addTracksToPlaylist.mutateAsync({ playlistId, trackIds }),
        );
        await Promise.all(promises);
      } else {
        // Single track mode
        const promises = targetPlaylists.map((playlistId) =>
          addTrackToPlaylist.mutateAsync({ playlistId, trackId: trackIds[0] }),
        );
        await Promise.all(promises);
      }

      const trackText = isBatchMode
        ? `${tracks.length} tracks`
        : `"${tracks[0].title}"`;
      toast.success(
        `Successfully added ${trackText} to ${targetPlaylists.length} playlist${
          targetPlaylists.length > 1 ? "s" : ""
        }`,
      );
      handleClose();
    } catch (error: any) {
      console.error("Error adding tracks to playlist:", error);
      toast.error(error.message || "Failed to add tracks to playlist");
    }
  };

  const isPending =
    addTrackToPlaylist.isPending || addTracksToPlaylist.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-neon-cyan/50 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-neon-cyan font-mono flex items-center gap-2">
            <ListMusic className="w-6 h-6" />
            Add to Playlist
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            {isBatchMode ? (
              <span>
                Add{" "}
                <span className="text-neon-purple font-semibold">
                  {tracks.length} tracks
                </span>{" "}
                to your playlists
              </span>
            ) : tracks.length === 1 ? (
              <span>
                Add{" "}
                <span className="text-neon-purple font-semibold">
                  "{tracks[0].title}"
                </span>{" "}
                by <span className="text-neon-cyan">{tracks[0].artist}</span> to
                your playlists
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mode Selection */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "single" ? "default" : "outline"}
              onClick={() => setMode("single")}
              className={
                mode === "single"
                  ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30"
                  : "border-gray-600 text-gray-400 hover:bg-gray-800"
              }
              size="sm"
            >
              Single Playlist
            </Button>
            <Button
              type="button"
              variant={mode === "multiple" ? "default" : "outline"}
              onClick={() => setMode("multiple")}
              className={
                mode === "multiple"
                  ? "bg-neon-purple/20 border-neon-purple text-neon-purple hover:bg-neon-purple/30"
                  : "border-gray-600 text-gray-400 hover:bg-gray-800"
              }
              size="sm"
            >
              Multiple Playlists
            </Button>
          </div>

          {playlistsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading playlists...
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ListMusic className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No playlists available</p>
              <p className="text-sm text-gray-500 mt-1">
                Create a playlist first
              </p>
            </div>
          ) : mode === "single" ? (
            <div className="space-y-2">
              <Label
                htmlFor="playlist-select"
                className="text-neon-cyan font-mono"
              >
                Select Playlist
              </Label>
              <Select value={singlePlaylist} onValueChange={setSinglePlaylist}>
                <SelectTrigger
                  id="playlist-select"
                  className="bg-black/50 border-neon-cyan/50 text-white focus:border-neon-cyan"
                >
                  <SelectValue placeholder="Choose a playlist..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-neon-cyan/50">
                  {playlists.map((playlist) => (
                    <SelectItem
                      key={playlist.id}
                      value={playlist.id}
                      className="text-white hover:bg-neon-cyan/20 focus:bg-neon-cyan/20"
                    >
                      {playlist.id} ({playlist.tracks.length} tracks)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-neon-cyan font-mono">
                Select Playlists
              </Label>
              <ScrollArea className="h-64 rounded-md border border-neon-purple/30 bg-black/30 p-4">
                <div className="space-y-3">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-neon-purple/10 transition-colors"
                    >
                      <Checkbox
                        id={`playlist-${playlist.id}`}
                        checked={selectedPlaylists.includes(playlist.id)}
                        onCheckedChange={() =>
                          handleTogglePlaylist(playlist.id)
                        }
                        className="border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
                      />
                      <Label
                        htmlFor={`playlist-${playlist.id}`}
                        className="flex-1 cursor-pointer text-white font-medium"
                      >
                        {playlist.id}
                        <span className="text-sm text-gray-400 ml-2">
                          ({playlist.tracks.length} tracks)
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selectedPlaylists.length > 0 && (
                <p className="text-sm text-neon-purple font-mono">
                  {selectedPlaylists.length} playlist
                  {selectedPlaylists.length > 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAddToPlaylists}
            disabled={
              isPending ||
              (mode === "single" && !singlePlaylist) ||
              (mode === "multiple" && selectedPlaylists.length === 0)
            }
            className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold shadow-lg shadow-neon-cyan/50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add to Playlist"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
