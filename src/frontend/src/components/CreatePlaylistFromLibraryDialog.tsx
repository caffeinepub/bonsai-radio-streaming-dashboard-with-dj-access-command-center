import { useState } from 'react';
import { useGetMediaLibrary, useCreatePlaylistFromLibrary } from '../hooks/useQueries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ListMusic, Loader2, Music, Search } from 'lucide-react';

interface CreatePlaylistFromLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreatePlaylistFromLibraryDialog({
  open,
  onOpenChange,
}: CreatePlaylistFromLibraryDialogProps) {
  const { data: tracks = [], isLoading: tracksLoading } = useGetMediaLibrary();
  const createPlaylist = useCreatePlaylistFromLibrary();
  const [playlistId, setPlaylistId] = useState('');
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTracks = tracks.filter((track) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      track.title.toLowerCase().includes(term) ||
      track.artist.toLowerCase().includes(term) ||
      track.album?.toLowerCase().includes(term)
    );
  });

  const handleClose = () => {
    setPlaylistId('');
    setSelectedTracks([]);
    setSearchTerm('');
    onOpenChange(false);
  };

  const handleToggleTrack = (trackId: string) => {
    setSelectedTracks((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTracks.length === filteredTracks.length) {
      setSelectedTracks([]);
    } else {
      setSelectedTracks(filteredTracks.map((track) => track.title));
    }
  };

  const handleCreatePlaylist = async () => {
    if (!playlistId.trim()) {
      toast.error('Please enter a playlist ID');
      return;
    }

    try {
      await createPlaylist.mutateAsync({
        playlistId: playlistId.trim(),
        trackIds: selectedTracks,
      });

      toast.success(
        selectedTracks.length > 0
          ? `Playlist "${playlistId}" created with ${selectedTracks.length} track${
              selectedTracks.length > 1 ? 's' : ''
            }`
          : `Empty playlist "${playlistId}" created successfully`
      );
      handleClose();
    } catch (error: any) {
      console.error('Error creating playlist:', error);
      toast.error(error.message || 'Failed to create playlist');
    }
  };

  const formatDuration = (seconds: bigint) => {
    const mins = Math.floor(Number(seconds) / 60);
    const secs = Number(seconds) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-neon-cyan/50 text-white max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-neon-cyan font-mono flex items-center gap-2">
            <ListMusic className="w-6 h-6" />
            Create Playlist from Library
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Create a new playlist and optionally add tracks from your media library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Playlist ID Input */}
          <div className="space-y-2">
            <Label htmlFor="playlist-id" className="text-neon-cyan font-mono">
              Playlist ID *
            </Label>
            <Input
              id="playlist-id"
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              placeholder="e.g., chill-vibes, workout-mix"
              className="bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan"
            />
          </div>

          {/* Track Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-neon-purple font-mono">
                Select Tracks (Optional)
              </Label>
              {tracks.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-neon-cyan hover:text-neon-purple hover:bg-neon-cyan/10 h-auto py-1"
                >
                  {selectedTracks.length === filteredTracks.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>

            {/* Search */}
            {tracks.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tracks..."
                  className="pl-10 bg-black/50 border-neon-purple/50 text-white placeholder:text-gray-500 focus:border-neon-purple"
                />
              </div>
            )}

            {tracksLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading tracks...
              </div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border border-neon-purple/30 rounded-lg bg-black/30">
                <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No tracks in media library</p>
                <p className="text-sm text-gray-500 mt-1">You can create an empty playlist</p>
              </div>
            ) : (
              <ScrollArea className="h-64 rounded-md border border-neon-purple/30 bg-black/30 p-4">
                {filteredTracks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No tracks found matching "{searchTerm}"</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTracks.map((track) => (
                      <div
                        key={track.title}
                        className="flex items-start space-x-3 p-3 rounded hover:bg-neon-purple/10 transition-colors border border-transparent hover:border-neon-purple/30"
                      >
                        <Checkbox
                          id={`track-${track.title}`}
                          checked={selectedTracks.includes(track.title)}
                          onCheckedChange={() => handleToggleTrack(track.title)}
                          className="mt-1 border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
                        />
                        <Label
                          htmlFor={`track-${track.title}`}
                          className="flex-1 cursor-pointer space-y-1"
                        >
                          <div className="text-white font-medium">{track.title}</div>
                          <div className="text-sm text-gray-400">
                            {track.artist}
                            {track.album && ` • ${track.album}`}
                            <span className="text-neon-cyan ml-2 font-mono">
                              {formatDuration(track.duration)}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}

            {selectedTracks.length > 0 && (
              <p className="text-sm text-neon-purple font-mono">
                {selectedTracks.length} track{selectedTracks.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
            disabled={createPlaylist.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreatePlaylist}
            disabled={createPlaylist.isPending || !playlistId.trim()}
            className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold shadow-lg shadow-neon-cyan/50"
          >
            {createPlaylist.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Playlist'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
