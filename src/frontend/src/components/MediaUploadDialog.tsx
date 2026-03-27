import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalBlob } from "../backend";
import { useAddMediaTrack } from "../hooks/useQueries";
import { useUploadSystemReadiness } from "../hooks/useUploadSystemReadiness";
import {
  extractAudioDuration,
  formatDuration,
  isValidAudioFile,
  parseDurationString,
} from "../utils/audioFileUtils";

interface UploadingTrack {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  duration: number;
  durationManuallySet: boolean;
  uploadProgress: number;
  uploadStatus: "pending" | "uploading" | "complete" | "error" | "queued";
  errorMessage?: string;
  trackId?: string;
}

interface MediaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MediaUploadDialog({
  open,
  onOpenChange,
}: MediaUploadDialogProps) {
  const [tracks, setTracks] = useState<UploadingTrack[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const addMediaTrack = useAddMediaTrack();
  const queryClient = useQueryClient();

  // Check upload system readiness when dialog opens
  const { data: readiness, isLoading: checkingReadiness } =
    useUploadSystemReadiness(open);

  // Keep refs so the canUpload effect can read latest values without
  // needing them as trigger dependencies.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const isUploadingRef = useRef(isUploading);
  isUploadingRef.current = isUploading;

  // Auto-retry queued uploads when system becomes ready.
  // We intentionally only trigger on canUpload changes; we read tracks and
  // isUploading via refs to avoid spurious retries on every state update.
  useEffect(() => {
    if (readiness?.canUpload && !isUploadingRef.current) {
      const queued = tracksRef.current.filter(
        (t) => t.uploadStatus === "queued",
      );
      if (queued.length > 0) {
        toast.info("Upload system ready! Retrying queued uploads...");
        // Call handleRetryQueued via the ref so it always uses current state.
        handleRetryQueuedRef.current();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness?.canUpload]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTracks: UploadingTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type (checks both MIME type and extension)
      const validation = isValidAudioFile(file);
      if (!validation.valid) {
        toast.error(
          validation.reason || `${file.name} is not a supported audio file`,
        );
        continue;
      }

      try {
        // Extract duration with fallback methods
        const duration = await extractAudioDuration(file);

        // Try to extract metadata from file name
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const parts = fileName.split(" - ");

        newTracks.push({
          id: crypto.randomUUID(),
          file,
          title: parts.length > 1 ? parts[1].trim() : fileName,
          artist: parts.length > 1 ? parts[0].trim() : "Unknown Artist",
          album: "",
          duration: duration || 0,
          durationManuallySet: false,
          uploadProgress: 0,
          uploadStatus: "pending",
        });

        // Show warning if duration couldn't be detected
        if (!duration || duration === 0) {
          toast.warning(`Could not detect duration for ${file.name}`, {
            description: "Please enter the duration manually",
          });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setTracks((prev) => [...prev, ...newTracks]);
  };

  const updateTrack = (id: string, updates: Partial<UploadingTrack>) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const uploadTrack = async (track: UploadingTrack): Promise<boolean> => {
    updateTrack(track.id, { uploadStatus: "uploading", uploadProgress: 0 });

    try {
      const arrayBuffer = await track.file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const blob = ExternalBlob.fromBytes(uint8Array).withUploadProgress(
        (percentage) => {
          updateTrack(track.id, { uploadProgress: percentage });
        },
      );

      // Add to backend and get the stable track ID
      const addedTrack = await addMediaTrack.mutateAsync({
        title: track.title,
        artist: track.artist,
        album: track.album || null,
        duration: BigInt(track.duration),
        url: blob,
      });

      updateTrack(track.id, {
        uploadStatus: "complete",
        uploadProgress: 100,
        trackId: addedTrack.id,
      });
      return true;
    } catch (error: any) {
      console.error("Upload error:", error);

      const errorMessage = error.message || "Upload failed";

      // Check if it's a system initialization error
      if (
        errorMessage.includes("initializing") ||
        errorMessage.includes("not ready")
      ) {
        updateTrack(track.id, {
          uploadStatus: "queued",
          uploadProgress: 0,
          errorMessage: "Queued - will retry when system is ready",
        });
        return false;
      }

      // Check if it's an authorization error
      if (
        errorMessage.includes("permission") ||
        errorMessage.includes("Unauthorized")
      ) {
        updateTrack(track.id, {
          uploadStatus: "error",
          uploadProgress: 0,
          errorMessage: "You do not have permission to upload tracks",
        });
        return false;
      }

      updateTrack(track.id, {
        uploadStatus: "error",
        uploadProgress: 0,
        errorMessage,
      });
      return false;
    }
  };

  const handleUploadAll = async () => {
    const pendingTracks = tracks.filter(
      (t) => t.uploadStatus === "pending" || t.uploadStatus === "error",
    );

    if (pendingTracks.length === 0) {
      toast.error("No tracks to upload");
      return;
    }

    // Check readiness before starting
    if (!readiness?.canUpload) {
      toast.error(readiness?.message || "Upload system not ready");
      return;
    }

    // Validate all tracks have required fields
    const invalidTracks = pendingTracks.filter(
      (t) => !t.title || !t.artist || t.duration === 0,
    );
    if (invalidTracks.length > 0) {
      toast.error(
        "Please fill in all track details and ensure duration is set",
      );
      return;
    }

    setIsUploading(true);

    let successCount = 0;
    let failCount = 0;
    let queuedCount = 0;

    // Upload tracks in parallel (max 3 at a time)
    const batchSize = 3;
    for (let i = 0; i < pendingTracks.length; i += batchSize) {
      const batch = pendingTracks.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((track) => uploadTrack(track)),
      );
      successCount += results.filter((r) => r).length;

      // Count queued vs failed
      const failedInBatch = results.filter((r) => !r).length;
      const queuedInBatch = batch.filter((t) => {
        const currentTrack = tracks.find((tr) => tr.id === t.id);
        return currentTrack?.uploadStatus === "queued";
      }).length;

      queuedCount += queuedInBatch;
      failCount += failedInBatch - queuedInBatch;
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} track(s) uploaded successfully`);
    }
    if (queuedCount > 0) {
      toast.warning(`${queuedCount} track(s) queued for retry`, {
        description: "Will retry automatically when system is ready",
      });
    }
    if (failCount > 0) {
      toast.error(`${failCount} track(s) failed to upload`);
    }

    // Close dialog if all uploads succeeded
    if (failCount === 0 && queuedCount === 0) {
      setTimeout(() => {
        setTracks([]);
        onOpenChange(false);
      }, 1000);
    }
  };

  const handleRetryQueued = async () => {
    const queuedTracks = tracksRef.current.filter(
      (t) => t.uploadStatus === "queued",
    );

    if (queuedTracks.length === 0) return;

    setIsUploading(true);

    for (const track of queuedTracks) {
      await uploadTrack(track);
    }

    setIsUploading(false);
  };

  // Stable ref so the canUpload effect always calls the latest version.
  const handleRetryQueuedRef = useRef(handleRetryQueued);
  handleRetryQueuedRef.current = handleRetryQueued;

  const handleRetryFailed = async () => {
    const failedTracks = tracks.filter((t) => t.uploadStatus === "error");

    if (failedTracks.length === 0) {
      toast.error("No failed tracks to retry");
      return;
    }

    setIsUploading(true);

    for (const track of failedTracks) {
      await uploadTrack(track);
    }

    setIsUploading(false);
  };

  const handleDurationChange = (id: string, durationStr: string) => {
    // Parse duration string (mm:ss format)
    const duration = parseDurationString(durationStr);
    updateTrack(id, { duration, durationManuallySet: true });
  };

  const handleClose = () => {
    if (isUploading) {
      if (!confirm("Upload in progress. Are you sure you want to close?"))
        return;
    }
    setTracks([]);
    onOpenChange(false);
  };

  const handleCheckAgain = () => {
    queryClient.invalidateQueries({ queryKey: ["uploadSystemReadiness"] });
  };

  const completedCount = tracks.filter(
    (t) => t.uploadStatus === "complete",
  ).length;
  const queuedCount = tracks.filter((t) => t.uploadStatus === "queued").length;
  const failedCount = tracks.filter((t) => t.uploadStatus === "error").length;
  const totalCount = tracks.length;

  const getStatusIcon = (status: UploadingTrack["uploadStatus"]) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "uploading":
        return <Loader2 className="w-5 h-5 text-neon-cyan animate-spin" />;
      case "queued":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getReadinessAlert = () => {
    if (checkingReadiness) {
      return (
        <Alert className="border-neon-cyan/50 bg-neon-cyan/10">
          <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
          <AlertDescription className="text-white ml-2">
            Checking upload system status...
          </AlertDescription>
        </Alert>
      );
    }

    if (!readiness) return null;

    switch (readiness.status) {
      case "ready":
        return (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-white ml-2">
              {readiness.message}
            </AlertDescription>
          </Alert>
        );
      case "initializing":
        return (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <Loader2 className="h-4 w-4 animate-spin text-yellow-500 shrink-0" />
            <AlertDescription className="text-white ml-2 flex flex-col gap-2">
              <span>
                Blob storage account is being set up. This may take a moment —
                please check back shortly.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckAgain}
                className="self-start border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 gap-1"
                data-ocid="upload.check_again.button"
              >
                <RefreshCw className="w-3 h-3" />
                Check Again
              </Button>
            </AlertDescription>
          </Alert>
        );
      case "unauthorized":
        return (
          <Alert className="border-red-500/50 bg-red-500/10">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-white ml-2">
              {readiness.message}
            </AlertDescription>
          </Alert>
        );
      case "unavailable":
        return (
          <Alert className="border-orange-500/50 bg-orange-500/10">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-white ml-2">
              {readiness.message}
            </AlertDescription>
          </Alert>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-black/95 border-neon-cyan/50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">
            Upload Audio Tracks
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Add multiple audio files to your media library
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Readiness Status */}
          {getReadinessAlert()}

          {/* File Input */}
          <div className="border-2 border-dashed border-neon-cyan/30 rounded-lg p-8 text-center hover:border-neon-cyan/50 transition-colors">
            <Input
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus,.wma,.aiff,.ape"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id="audio-upload"
              disabled={!readiness?.canUpload || isUploading}
            />
            <Label
              htmlFor="audio-upload"
              className={`cursor-pointer flex flex-col items-center gap-3 ${
                !readiness?.canUpload || isUploading
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              <Upload className="w-12 h-12 text-neon-cyan" />
              <div>
                <p className="text-lg font-semibold text-white">
                  Click to select audio files
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  or drag and drop (MP3, WAV, FLAC, M4A, AAC, OGG, etc.)
                </p>
              </div>
            </Label>
          </div>

          {/* Upload Progress Summary */}
          {totalCount > 0 && (
            <div className="bg-black/50 rounded-lg border border-neon-purple/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-gray-400">
                  {completedCount} / {totalCount} completed
                </span>
                {queuedCount > 0 && (
                  <span className="text-sm font-mono text-yellow-500">
                    {queuedCount} queued
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="text-sm font-mono text-red-500">
                    {failedCount} failed
                  </span>
                )}
              </div>
              <Progress
                value={(completedCount / totalCount) * 100}
                className="h-2"
              />
            </div>
          )}

          {/* Track List */}
          {tracks.length > 0 && (
            <div className="space-y-3">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-black/50 rounded-lg border border-neon-purple/30 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(track.uploadStatus)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {track.file.name}
                        </p>
                        {track.errorMessage && (
                          <p className="text-sm text-red-400 mt-1">
                            {track.errorMessage}
                          </p>
                        )}
                        {track.duration === 0 &&
                          track.uploadStatus === "pending" && (
                            <p className="text-sm text-yellow-400 mt-1">
                              ⚠ Duration required - please enter manually
                            </p>
                          )}
                      </div>
                    </div>
                    {track.uploadStatus !== "uploading" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTrack(track.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {track.uploadStatus === "uploading" && (
                    <Progress value={track.uploadProgress} className="h-2" />
                  )}

                  {(track.uploadStatus === "pending" ||
                    track.uploadStatus === "error" ||
                    track.uploadStatus === "queued") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-400">Title</Label>
                        <Input
                          value={track.title}
                          onChange={(e) =>
                            updateTrack(track.id, { title: e.target.value })
                          }
                          className="mt-1 bg-black/50 border-neon-cyan/30 text-white"
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Artist</Label>
                        <Input
                          value={track.artist}
                          onChange={(e) =>
                            updateTrack(track.id, { artist: e.target.value })
                          }
                          className="mt-1 bg-black/50 border-neon-cyan/30 text-white"
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">
                          Album (optional)
                        </Label>
                        <Input
                          value={track.album}
                          onChange={(e) =>
                            updateTrack(track.id, { album: e.target.value })
                          }
                          className="mt-1 bg-black/50 border-neon-cyan/30 text-white"
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">
                          Duration (mm:ss){" "}
                          {track.duration === 0 && (
                            <span className="text-yellow-400">*</span>
                          )}
                        </Label>
                        <Input
                          value={formatDuration(track.duration)}
                          onChange={(e) =>
                            handleDurationChange(track.id, e.target.value)
                          }
                          placeholder="0:00"
                          className={`mt-1 bg-black/50 text-white ${
                            track.duration === 0
                              ? "border-yellow-500/50 focus:border-yellow-500"
                              : "border-neon-cyan/30"
                          }`}
                          disabled={isUploading}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-neon-purple/30">
          <div className="flex gap-2">
            {failedCount > 0 && (
              <Button
                onClick={handleRetryFailed}
                disabled={isUploading || !readiness?.canUpload}
                variant="outline"
                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
              >
                Retry Failed
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleClose}
              disabled={isUploading}
              variant="outline"
              className="border-neon-purple/50 text-white hover:bg-neon-purple/10"
            >
              {isUploading ? "Cancel" : "Close"}
            </Button>
            <Button
              onClick={handleUploadAll}
              disabled={
                isUploading || tracks.length === 0 || !readiness?.canUpload
              }
              className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload All
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
