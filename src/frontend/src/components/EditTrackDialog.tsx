import { useState } from 'react';
import { useUpdateTrackMetadata } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Track } from '../backend';

interface EditTrackDialogProps {
  track: Track;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditTrackDialog({ track, open, onOpenChange }: EditTrackDialogProps) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album || '');
  const [duration, setDuration] = useState(Number(track.duration));
  const updateTrackMetadata = useUpdateTrackMetadata();

  const handleSave = async () => {
    if (!title.trim() || !artist.trim()) {
      toast.error('Title and Artist are required');
      return;
    }

    if (duration <= 0) {
      toast.error('Duration must be greater than 0');
      return;
    }

    try {
      await updateTrackMetadata.mutateAsync({
        trackId: track.title, // Using title as ID
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() || null,
        duration: BigInt(duration),
      });
      toast.success('Track metadata updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating track:', error);
      toast.error(error.message || 'Failed to update track metadata');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-br from-purple-900/95 to-blue-900/95 border-2 border-neon-cyan/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-neon-cyan font-mono">
            Edit Track Metadata
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Update the metadata for this track
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-neon-purple font-mono">
              Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Track title"
              className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artist" className="text-neon-purple font-mono">
              Artist *
            </Label>
            <Input
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist name"
              className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="album" className="text-neon-purple font-mono">
              Album
            </Label>
            <Input
              id="album"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="Album name (optional)"
              className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration" className="text-neon-purple font-mono">
              Duration (seconds) *
            </Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              placeholder="Duration in seconds"
              className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateTrackMetadata.isPending}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTrackMetadata.isPending}
            className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold shadow-lg shadow-neon-cyan/50"
          >
            {updateTrackMetadata.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
