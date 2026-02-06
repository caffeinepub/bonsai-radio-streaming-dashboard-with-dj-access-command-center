import { useState } from 'react';
import { useAddMediaTrack } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Upload, X, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { ExternalBlob } from '../backend';
import { toast } from 'sonner';

interface UploadingTrack {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  duration: number;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'complete' | 'error' | 'queued';
  errorMessage?: string;
}

interface MediaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MediaUploadDialog({ open, onOpenChange }: MediaUploadDialogProps) {
  const [tracks, setTracks] = useState<UploadingTrack[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSystemReady, setUploadSystemReady] = useState(true);
  const addMediaTrack = useAddMediaTrack();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTracks: UploadingTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        toast.error(`${file.name} is not an audio file`);
        continue;
      }

      try {
        // Extract metadata using Web Audio API
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const duration = Math.floor(audioBuffer.duration);

        // Try to extract metadata from file name
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        const parts = fileName.split(' - ');

        newTracks.push({
          id: crypto.randomUUID(),
          file,
          title: parts.length > 1 ? parts[1].trim() : fileName,
          artist: parts.length > 1 ? parts[0].trim() : 'Unknown Artist',
          album: '',
          duration,
          uploadProgress: 0,
          uploadStatus: 'pending',
        });
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setTracks((prev) => [...prev, ...newTracks]);
  };

  const updateTrack = (id: string, updates: Partial<UploadingTrack>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const uploadTrack = async (track: UploadingTrack): Promise<boolean> => {
    updateTrack(track.id, { uploadStatus: 'uploading', uploadProgress: 0 });

    try {
      const arrayBuffer = await track.file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const blob = ExternalBlob.fromBytes(uint8Array).withUploadProgress((percentage) => {
        updateTrack(track.id, { uploadProgress: percentage });
      });

      // Wait for upload to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Add to backend
      await addMediaTrack.mutateAsync({
        title: track.title,
        artist: track.artist,
        album: track.album || null,
        duration: BigInt(track.duration),
        url: blob,
      });

      updateTrack(track.id, { uploadStatus: 'complete', uploadProgress: 100 });
      return true;
    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Check if it's a cashier registration error
      if (error.message?.includes('Upload system not ready')) {
        updateTrack(track.id, {
          uploadStatus: 'queued',
          uploadProgress: 0,
          errorMessage: 'Queued - will retry when system is ready',
        });
        setUploadSystemReady(false);
        return false;
      }
      
      updateTrack(track.id, {
        uploadStatus: 'error',
        uploadProgress: 0,
        errorMessage: error.message || 'Upload failed',
      });
      return false;
    }
  };

  const handleUploadAll = async () => {
    const pendingTracks = tracks.filter((t) => t.uploadStatus === 'pending' || t.uploadStatus === 'error' || t.uploadStatus === 'queued');
    
    if (pendingTracks.length === 0) {
      toast.error('No tracks to upload');
      return;
    }

    // Validate all tracks have required fields
    const invalidTracks = pendingTracks.filter((t) => !t.title || !t.artist || t.duration === 0);
    if (invalidTracks.length > 0) {
      toast.error('Please fill in all track details');
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
      const results = await Promise.all(batch.map((track) => uploadTrack(track)));
      successCount += results.filter((r) => r).length;
      
      // Count queued vs failed
      const failedInBatch = results.filter((r) => !r).length;
      const queuedInBatch = batch.filter((t) => 
        tracks.find((tr) => tr.id === t.id)?.uploadStatus === 'queued'
      ).length;
      
      queuedCount += queuedInBatch;
      failCount += failedInBatch - queuedInBatch;
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} track(s) uploaded successfully`);
    }
    if (queuedCount > 0) {
      toast.warning(`${queuedCount} track(s) queued for retry`, {
        description: 'Will retry when upload system is ready',
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

  const handleClose = () => {
    if (isUploading) {
      if (!confirm('Upload in progress. Are you sure you want to close?')) return;
    }
    setTracks([]);
    onOpenChange(false);
  };

  const completedCount = tracks.filter((t) => t.uploadStatus === 'complete').length;
  const queuedCount = tracks.filter((t) => t.uploadStatus === 'queued').length;
  const totalCount = tracks.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-gradient-to-br from-purple-900/95 to-blue-900/95 border-2 border-neon-cyan/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-neon-cyan font-mono">
            Upload Media Tracks
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Select multiple audio files to upload to your media library
          </DialogDescription>
        </DialogHeader>

        {/* Upload System Status */}
        {!uploadSystemReady && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-yellow-400 font-mono font-bold text-sm">Upload System Initializing</p>
              <p className="text-xs text-gray-400">
                {queuedCount > 0 
                  ? `${queuedCount} track(s) queued and will retry automatically`
                  : 'Some uploads may be queued until system is ready'
                }
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
          {/* File Input */}
          <div className="space-y-2">
            <Label className="text-neon-purple font-mono">Select Audio Files</Label>
            <Input
              type="file"
              accept=".mp3,.wav,.ogg,.flac,audio/*"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              disabled={isUploading}
              className="bg-black/50 border-neon-cyan/50 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neon-purple/30 file:text-neon-cyan hover:file:bg-neon-purple/50"
            />
          </div>

          {/* Track List */}
          {tracks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-neon-cyan font-mono">
                  Tracks ({completedCount}/{totalCount} uploaded{queuedCount > 0 ? `, ${queuedCount} queued` : ''})
                </Label>
                {completedCount > 0 && completedCount < totalCount && (
                  <Progress value={(completedCount / totalCount) * 100} className="w-32 h-2" />
                )}
              </div>

              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-black/40 rounded-lg border border-neon-purple/30 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-neon-cyan truncate">{track.file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(track.file.size / 1024 / 1024).toFixed(2)} MB • {track.duration}s
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {track.uploadStatus === 'complete' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {track.uploadStatus === 'error' && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      {track.uploadStatus === 'queued' && (
                        <AlertCircle className="w-5 h-5 text-yellow-500 animate-pulse" />
                      )}
                      {track.uploadStatus === 'uploading' && (
                        <Loader2 className="w-5 h-5 text-neon-cyan animate-spin" />
                      )}
                      {track.uploadStatus === 'pending' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeTrack(track.id)}
                          disabled={isUploading}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {track.uploadStatus === 'uploading' && (
                    <div className="space-y-1">
                      <Progress value={track.uploadProgress} className="h-2" />
                      <p className="text-xs text-neon-cyan">{track.uploadProgress}% uploaded</p>
                    </div>
                  )}

                  {(track.uploadStatus === 'error' || track.uploadStatus === 'queued') && track.errorMessage && (
                    <p className={`text-xs ${track.uploadStatus === 'queued' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {track.errorMessage}
                    </p>
                  )}

                  {(track.uploadStatus === 'pending' || track.uploadStatus === 'error' || track.uploadStatus === 'queued') && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-400">Title *</Label>
                        <Input
                          value={track.title}
                          onChange={(e) => updateTrack(track.id, { title: e.target.value })}
                          placeholder="Track title"
                          className="bg-black/50 border-gray-600 text-white text-sm h-8"
                          disabled={isUploading}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-400">Artist *</Label>
                        <Input
                          value={track.artist}
                          onChange={(e) => updateTrack(track.id, { artist: e.target.value })}
                          placeholder="Artist name"
                          className="bg-black/50 border-gray-600 text-white text-sm h-8"
                          disabled={isUploading}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-400">Album</Label>
                        <Input
                          value={track.album}
                          onChange={(e) => updateTrack(track.id, { album: e.target.value })}
                          placeholder="Album name"
                          className="bg-black/50 border-gray-600 text-white text-sm h-8"
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neon-purple/30">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            {isUploading ? 'Cancel' : 'Close'}
          </Button>
          <Button
            onClick={handleUploadAll}
            disabled={isUploading || tracks.length === 0}
            className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold shadow-lg shadow-neon-cyan/50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload All ({tracks.filter((t) => t.uploadStatus === 'pending' || t.uploadStatus === 'error' || t.uploadStatus === 'queued').length})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
