import { useState } from 'react';
import { useUpdateTracksMetadata } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Loader2, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import type { Track, TrackUpdate } from '../backend';

interface BatchEditTrackDialogProps {
  tracks: Track[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BatchEditTrackDialog({ tracks, open, onOpenChange }: BatchEditTrackDialogProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [duration, setDuration] = useState('');

  const [applyTitle, setApplyTitle] = useState(false);
  const [applyArtist, setApplyArtist] = useState(false);
  const [applyAlbum, setApplyAlbum] = useState(false);
  const [applyDuration, setApplyDuration] = useState(false);

  const updateTracksMetadata = useUpdateTracksMetadata();

  const handleClose = () => {
    setTitle('');
    setArtist('');
    setAlbum('');
    setDuration('');
    setApplyTitle(false);
    setApplyArtist(false);
    setApplyAlbum(false);
    setApplyDuration(false);
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!applyTitle && !applyArtist && !applyAlbum && !applyDuration) {
      toast.error('Please select at least one field to update');
      return;
    }

    if (applyTitle && !title.trim()) {
      toast.error('Title cannot be empty when applying');
      return;
    }

    if (applyArtist && !artist.trim()) {
      toast.error('Artist cannot be empty when applying');
      return;
    }

    if (applyDuration && (!duration || parseInt(duration) <= 0)) {
      toast.error('Duration must be greater than 0 when applying');
      return;
    }

    try {
      const batch: Array<[string, TrackUpdate]> = tracks.map((track) => {
        const update: TrackUpdate = {
          title: applyTitle ? title.trim() : track.title,
          artist: applyArtist ? artist.trim() : track.artist,
          album: applyAlbum ? (album.trim() || undefined) : (track.album || undefined),
          duration: applyDuration ? BigInt(parseInt(duration)) : track.duration,
        };
        return [track.id, update];
      });

      await updateTracksMetadata.mutateAsync(batch);
      toast.success(`Successfully updated ${tracks.length} track${tracks.length > 1 ? 's' : ''}`);
      handleClose();
    } catch (error: any) {
      console.error('Error updating tracks:', error);
      toast.error(error.message || 'Failed to update tracks metadata');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-purple-900/95 to-blue-900/95 border-2 border-neon-cyan/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-neon-cyan font-mono flex items-center gap-2">
            <Edit3 className="w-6 h-6" />
            Batch Edit Metadata
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Update metadata for <span className="text-neon-purple font-semibold">{tracks.length} tracks</span>.
            Select which fields to apply to all selected tracks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Selected Tracks Preview */}
          <div className="space-y-2">
            <Label className="text-neon-purple font-mono">Selected Tracks</Label>
            <ScrollArea className="h-32 rounded-md border border-neon-purple/30 bg-black/30 p-3">
              <div className="space-y-1">
                {tracks.map((track, idx) => (
                  <div key={track.id} className="text-sm text-gray-300 font-mono">
                    {idx + 1}. {track.title} - {track.artist}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Batch Edit Fields */}
          <div className="space-y-4">
            {/* Title */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-black/30 border border-neon-cyan/20">
              <Checkbox
                id="apply-title"
                checked={applyTitle}
                onCheckedChange={(checked) => setApplyTitle(checked as boolean)}
                className="mt-2 border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="title" className="text-neon-purple font-mono flex items-center gap-2">
                  Title
                  {applyTitle && <span className="text-xs text-neon-cyan">(will be applied)</span>}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="New title for all selected tracks"
                  disabled={!applyTitle}
                  className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan disabled:opacity-50"
                />
              </div>
            </div>

            {/* Artist */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-black/30 border border-neon-cyan/20">
              <Checkbox
                id="apply-artist"
                checked={applyArtist}
                onCheckedChange={(checked) => setApplyArtist(checked as boolean)}
                className="mt-2 border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="artist" className="text-neon-purple font-mono flex items-center gap-2">
                  Artist
                  {applyArtist && <span className="text-xs text-neon-cyan">(will be applied)</span>}
                </Label>
                <Input
                  id="artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="New artist for all selected tracks"
                  disabled={!applyArtist}
                  className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan disabled:opacity-50"
                />
              </div>
            </div>

            {/* Album */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-black/30 border border-neon-cyan/20">
              <Checkbox
                id="apply-album"
                checked={applyAlbum}
                onCheckedChange={(checked) => setApplyAlbum(checked as boolean)}
                className="mt-2 border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="album" className="text-neon-purple font-mono flex items-center gap-2">
                  Album
                  {applyAlbum && <span className="text-xs text-neon-cyan">(will be applied)</span>}
                </Label>
                <Input
                  id="album"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  placeholder="New album for all selected tracks (optional)"
                  disabled={!applyAlbum}
                  className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan disabled:opacity-50"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-black/30 border border-neon-cyan/20">
              <Checkbox
                id="apply-duration"
                checked={applyDuration}
                onCheckedChange={(checked) => setApplyDuration(checked as boolean)}
                className="mt-2 border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="duration" className="text-neon-purple font-mono flex items-center gap-2">
                  Duration (seconds)
                  {applyDuration && <span className="text-xs text-neon-cyan">(will be applied)</span>}
                </Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="New duration for all selected tracks"
                  disabled={!applyDuration}
                  className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={updateTracksMetadata.isPending}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTracksMetadata.isPending}
            className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold shadow-lg shadow-neon-cyan/50"
          >
            {updateTracksMetadata.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Update {tracks.length} Track{tracks.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
