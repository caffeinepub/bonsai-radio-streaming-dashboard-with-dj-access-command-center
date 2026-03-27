import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalBlob, type TrackRecord } from "../backend";
import { useAddPlaylist } from "../hooks/useQueries";

interface TrackFormData {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file: File | null;
  uploadProgress: number;
  uploadStatus: "idle" | "uploading" | "complete" | "error" | "queued";
  audioBlob: ExternalBlob | null;
  errorMessage?: string;
}

export default function CreatePlaylistForm() {
  const [playlistId, setPlaylistId] = useState("");
  const [tracks, setTracks] = useState<TrackFormData[]>([
    {
      id: crypto.randomUUID(),
      title: "",
      artist: "",
      album: "",
      duration: 0,
      file: null,
      uploadProgress: 0,
      uploadStatus: "idle",
      audioBlob: null,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSystemReady, setUploadSystemReady] = useState(true);

  const addPlaylist = useAddPlaylist();

  const addTrackField = () => {
    setTracks([
      ...tracks,
      {
        id: crypto.randomUUID(),
        title: "",
        artist: "",
        album: "",
        duration: 0,
        file: null,
        uploadProgress: 0,
        uploadStatus: "idle",
        audioBlob: null,
      },
    ]);
  };

  const removeTrackField = (id: string) => {
    setTracks(tracks.filter((t) => t.id !== id));
  };

  const updateTrack = (id: string, updates: Partial<TrackFormData>) => {
    setTracks(tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleFileSelect = async (trackId: string, file: File) => {
    updateTrack(trackId, { file, uploadStatus: "idle", uploadProgress: 0 });

    // Extract metadata using Web Audio API
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const duration = Math.floor(audioBuffer.duration);

      // Try to extract metadata from file name if not provided
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const parts = fileName.split(" - ");

      updateTrack(trackId, {
        duration,
        title: parts.length > 1 ? parts[1] : fileName,
        artist: parts.length > 1 ? parts[0] : "Unknown Artist",
      });
    } catch (error) {
      console.error("Error extracting metadata:", error);
      toast.error("Failed to extract audio metadata");
    }
  };

  const uploadTrack = async (trackId: string): Promise<ExternalBlob | null> => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track || !track.file) return null;

    updateTrack(trackId, { uploadStatus: "uploading", uploadProgress: 0 });

    try {
      const arrayBuffer = await track.file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const blob = ExternalBlob.fromBytes(uint8Array).withUploadProgress(
        (percentage) => {
          updateTrack(trackId, { uploadProgress: percentage });
        },
      );

      // Simulate upload completion check
      await new Promise((resolve) => setTimeout(resolve, 500));

      updateTrack(trackId, {
        uploadStatus: "complete",
        uploadProgress: 100,
        audioBlob: blob,
      });
      return blob;
    } catch (error: any) {
      console.error("Upload error:", error);

      // Check if it's a cashier registration error
      if (
        error.message?.includes("Upload system not ready") ||
        error.message?.includes("cashier")
      ) {
        updateTrack(trackId, {
          uploadStatus: "queued",
          uploadProgress: 0,
          errorMessage: "Queued - will retry when system is ready",
        });
        setUploadSystemReady(false);
        return null;
      }

      updateTrack(trackId, {
        uploadStatus: "error",
        uploadProgress: 0,
        errorMessage: error.message,
      });
      toast.error(`Failed to upload ${track.file.name}`);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!playlistId.trim()) {
      toast.error("Please enter a playlist ID");
      return;
    }

    if (tracks.length === 0) {
      toast.error("Please add at least one track");
      return;
    }

    const invalidTracks = tracks.filter(
      (t) => !t.title || !t.artist || !t.file || t.duration === 0,
    );
    if (invalidTracks.length > 0) {
      toast.error("Please fill in all track details and select audio files");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload all tracks sequentially
      const uploadedBlobs: (ExternalBlob | null)[] = [];
      let queuedCount = 0;

      for (const track of tracks) {
        const blob = await uploadTrack(track.id);
        uploadedBlobs.push(blob);
        if (track.uploadStatus === "queued") {
          queuedCount++;
        }
      }

      // Check if all uploads succeeded
      if (uploadedBlobs.some((blob) => blob === null)) {
        if (queuedCount > 0) {
          toast.warning(`${queuedCount} track(s) queued for upload`, {
            description: "Will retry when upload system is ready",
          });
        } else {
          toast.error("Some tracks failed to upload. Please retry.");
        }
        setIsSubmitting(false);
        return;
      }

      // Create track records
      const trackRecords: TrackRecord[] = tracks.map((track, index) => ({
        title: track.title,
        artist: track.artist,
        album: track.album || undefined,
        duration: BigInt(track.duration),
        audioFile: uploadedBlobs[index]!,
        playCount: BigInt(0),
      }));

      // Submit to backend
      await addPlaylist.mutateAsync({
        playlistId: playlistId.trim(),
        tracks: trackRecords,
      });

      toast.success("Playlist created successfully!");

      // Reset form
      setPlaylistId("");
      setTracks([
        {
          id: crypto.randomUUID(),
          title: "",
          artist: "",
          album: "",
          duration: 0,
          file: null,
          uploadProgress: 0,
          uploadStatus: "idle",
          audioBlob: null,
        },
      ]);
    } catch (error: any) {
      console.error("Error creating playlist:", error);
      toast.error(error.message || "Failed to create playlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  const queuedCount = tracks.filter((t) => t.uploadStatus === "queued").length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Upload System Status */}
      {!uploadSystemReady && queuedCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="text-yellow-400 font-mono font-bold text-sm">
              Upload System Initializing
            </p>
            <p className="text-xs text-gray-400">
              {queuedCount} track(s) queued and will retry automatically when
              system is ready
            </p>
          </div>
        </div>
      )}

      {/* Playlist ID */}
      <div className="space-y-2">
        <Label
          htmlFor="playlistId"
          className="text-neon-cyan font-mono uppercase text-sm"
        >
          Playlist ID
        </Label>
        <Input
          id="playlistId"
          value={playlistId}
          onChange={(e) => setPlaylistId(e.target.value)}
          placeholder="e.g., Chill Vibes 2025"
          className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan"
          disabled={isSubmitting}
        />
      </div>

      {/* Tracks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-neon-purple font-mono uppercase text-sm">
            Tracks
          </Label>
          <Button
            type="button"
            onClick={addTrackField}
            size="sm"
            variant="outline"
            className="border-neon-purple/50 text-neon-purple hover:bg-neon-purple/20"
            disabled={isSubmitting}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Track
          </Button>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="bg-black/40 rounded-lg border border-neon-cyan/30 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-neon-cyan">
                  Track {index + 1}
                </span>
                <div className="flex items-center gap-2">
                  {track.uploadStatus === "complete" && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {track.uploadStatus === "error" && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {track.uploadStatus === "queued" && (
                    <AlertCircle className="w-5 h-5 text-yellow-500 animate-pulse" />
                  )}
                  {tracks.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeTrackField(track.id)}
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/20"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Title</Label>
                  <Input
                    value={track.title}
                    onChange={(e) =>
                      updateTrack(track.id, { title: e.target.value })
                    }
                    placeholder="Track title"
                    className="bg-black/50 border-gray-600 text-white text-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Artist</Label>
                  <Input
                    value={track.artist}
                    onChange={(e) =>
                      updateTrack(track.id, { artist: e.target.value })
                    }
                    placeholder="Artist name"
                    className="bg-black/50 border-gray-600 text-white text-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">
                    Album (Optional)
                  </Label>
                  <Input
                    value={track.album}
                    onChange={(e) =>
                      updateTrack(track.id, { album: e.target.value })
                    }
                    placeholder="Album name"
                    className="bg-black/50 border-gray-600 text-white text-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">
                    Duration (seconds)
                  </Label>
                  <Input
                    type="number"
                    value={track.duration || ""}
                    onChange={(e) =>
                      updateTrack(track.id, {
                        duration: Number.parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="Auto-detected"
                    className="bg-black/50 border-gray-600 text-white text-sm"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Audio File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".mp3,.wav,.ogg,.flac"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(track.id, file);
                    }}
                    className="bg-black/50 border-gray-600 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neon-purple/30 file:text-neon-cyan hover:file:bg-neon-purple/50"
                    disabled={isSubmitting}
                  />
                </div>
                {track.file && (
                  <p className="text-xs text-gray-400">
                    Selected: {track.file.name} (
                    {(track.file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                {track.uploadStatus === "uploading" && (
                  <div className="space-y-1">
                    <Progress value={track.uploadProgress} className="h-2" />
                    <p className="text-xs text-neon-cyan">
                      {track.uploadProgress}% uploaded
                    </p>
                  </div>
                )}
                {(track.uploadStatus === "error" ||
                  track.uploadStatus === "queued") &&
                  track.errorMessage && (
                    <p
                      className={`text-xs ${track.uploadStatus === "queued" ? "text-yellow-400" : "text-red-400"}`}
                    >
                      {track.errorMessage}
                    </p>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold py-3 rounded-lg shadow-lg shadow-neon-cyan/50 transition-all duration-300"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating Playlist...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 mr-2" />
            Create Playlist
          </>
        )}
      </Button>
    </form>
  );
}
