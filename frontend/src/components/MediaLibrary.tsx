import { useState } from 'react';
import { useGetMediaLibrary, useDeleteTrack } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Search, Edit, Trash2, Music, Clock, Calendar, ListPlus, FolderPlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import MediaUploadDialog from './MediaUploadDialog';
import EditTrackDialog from './EditTrackDialog';
import BatchEditTrackDialog from './BatchEditTrackDialog';
import AddToPlaylistDialog from './AddToPlaylistDialog';
import CreatePlaylistFromLibraryDialog from './CreatePlaylistFromLibraryDialog';
import type { Track } from '../backend';

export default function MediaLibrary() {
  const { data: tracks = [], isLoading } = useGetMediaLibrary();
  const deleteTrack = useDeleteTrack();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCreatePlaylistDialog, setShowCreatePlaylistDialog] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'uploadDate'>('uploadDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Multi-select state - now using track.id instead of track.title
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [showBatchAddToPlaylist, setShowBatchAddToPlaylist] = useState(false);

  const filteredTracks = tracks.filter((track) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      track.title.toLowerCase().includes(term) ||
      track.artist.toLowerCase().includes(term) ||
      track.album?.toLowerCase().includes(term)
    );
  });

  const sortedTracks = [...filteredTracks].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === 'artist') {
      comparison = a.artist.localeCompare(b.artist);
    } else if (sortBy === 'uploadDate') {
      comparison = Number(a.uploadDate) - Number(b.uploadDate);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleDelete = async (trackId: string, trackTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${trackTitle}"?`)) return;

    try {
      await deleteTrack.mutateAsync(trackId);
      toast.success('Track deleted successfully');
      setSelectedTracks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(trackId);
        return newSet;
      });
    } catch (error: any) {
      console.error('Error deleting track:', error);
      toast.error(error.message || 'Failed to delete track');
    }
  };

  const formatDuration = (seconds: bigint) => {
    const mins = Math.floor(Number(seconds) / 60);
    const secs = Number(seconds) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: bigint) => {
    if (timestamp === BigInt(0)) return 'Recently';
    try {
      const date = new Date(Number(timestamp) / 1000000);
      return date.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  const toggleSort = (field: 'title' | 'artist' | 'uploadDate') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTracks(new Set(sortedTracks.map((track) => track.id)));
    } else {
      setSelectedTracks(new Set());
    }
  };

  const handleSelectTrack = (trackId: string, checked: boolean) => {
    setSelectedTracks((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(trackId);
      } else {
        newSet.delete(trackId);
      }
      return newSet;
    });
  };

  const handleBatchAddToPlaylist = () => {
    if (selectedTracks.size === 0) {
      toast.error('Please select at least one track');
      return;
    }
    setShowBatchAddToPlaylist(true);
  };

  const handleBatchEdit = () => {
    if (selectedTracks.size === 0) {
      toast.error('Please select at least one track');
      return;
    }
    setShowBatchEdit(true);
  };

  const getSelectedTracksData = (): Track[] => {
    return tracks.filter((track) => selectedTracks.has(track.id));
  };

  const allSelected = sortedTracks.length > 0 && selectedTracks.size === sortedTracks.length;
  const someSelected = selectedTracks.size > 0 && selectedTracks.size < sortedTracks.length;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tracks by title, artist, or album..."
            className="pl-10 bg-black/50 border-neon-cyan/50 text-white placeholder:text-gray-500 focus:border-neon-cyan"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreatePlaylistDialog(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg shadow-green-500/50"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Create Playlist
          </Button>
          <Button
            onClick={() => setShowUploadDialog(true)}
            className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold shadow-lg shadow-neon-cyan/50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Tracks
          </Button>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedTracks.size > 0 && (
        <div className="bg-gradient-to-r from-neon-purple/20 to-neon-cyan/20 border border-neon-cyan/50 rounded-lg p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-neon-cyan/20 rounded-full px-4 py-2 border border-neon-cyan/50">
              <span className="text-neon-cyan font-bold font-mono">
                {selectedTracks.size} track{selectedTracks.size > 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleBatchAddToPlaylist}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg shadow-green-500/50 transition-all hover:scale-105"
            >
              <ListPlus className="w-4 h-4 mr-2" />
              Add to Playlist
            </Button>
            <Button
              onClick={handleBatchEdit}
              className="bg-gradient-to-r from-neon-cyan to-neon-purple hover:from-neon-cyan/80 hover:to-neon-purple/80 text-white font-bold shadow-lg shadow-neon-cyan/50 transition-all hover:scale-105"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Metadata
            </Button>
            <Button
              onClick={() => setSelectedTracks(new Set())}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white transition-all"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-black/40 rounded-lg border border-neon-purple/30 p-4">
          <div className="flex items-center gap-3">
            <Music className="w-8 h-8 text-neon-cyan" />
            <div>
              <p className="text-sm text-gray-400 font-mono">Total Tracks</p>
              <p className="text-2xl font-bold text-white">{tracks.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-black/40 rounded-lg border border-neon-cyan/30 p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-neon-purple" />
            <div>
              <p className="text-sm text-gray-400 font-mono">Total Duration</p>
              <p className="text-2xl font-bold text-white">
                {Math.floor(tracks.reduce((sum, t) => sum + Number(t.duration), 0) / 60)} min
              </p>
            </div>
          </div>
        </div>
        <div className="bg-black/40 rounded-lg border border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-400 font-mono">Available</p>
              <p className="text-2xl font-bold text-green-500">{filteredTracks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks Table */}
      <div className="bg-black/40 rounded-lg border border-neon-cyan/30 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading media library...</div>
        ) : sortedTracks.length === 0 ? (
          <div className="p-8 text-center">
            <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">
              {searchTerm ? 'No tracks found matching your search' : 'No tracks in media library'}
            </p>
            <p className="text-sm text-gray-500">
              {!searchTerm && 'Upload audio files to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-neon-purple/30 hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      className="border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
                      aria-label="Select all tracks"
                      ref={(el) => {
                        if (el) {
                          (el as any).indeterminate = someSelected;
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead
                    className="text-neon-cyan font-mono cursor-pointer hover:text-neon-purple transition-colors"
                    onClick={() => toggleSort('title')}
                  >
                    Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="text-neon-cyan font-mono cursor-pointer hover:text-neon-purple transition-colors"
                    onClick={() => toggleSort('artist')}
                  >
                    Artist {sortBy === 'artist' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-neon-cyan font-mono">Album</TableHead>
                  <TableHead className="text-neon-cyan font-mono">Duration</TableHead>
                  <TableHead
                    className="text-neon-cyan font-mono cursor-pointer hover:text-neon-purple transition-colors"
                    onClick={() => toggleSort('uploadDate')}
                  >
                    Upload Date {sortBy === 'uploadDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-neon-cyan font-mono">Status</TableHead>
                  <TableHead className="text-neon-cyan font-mono text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTracks.map((track) => (
                  <TableRow
                    key={track.id}
                    className={`border-neon-purple/20 hover:bg-neon-purple/10 transition-colors ${
                      selectedTracks.has(track.id) ? 'bg-neon-cyan/10' : ''
                    }`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedTracks.has(track.id)}
                        onCheckedChange={(checked) => handleSelectTrack(track.id, checked as boolean)}
                        className="border-neon-cyan data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
                        aria-label={`Select ${track.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-white">{track.title}</TableCell>
                    <TableCell className="text-gray-300">{track.artist}</TableCell>
                    <TableCell className="text-gray-400">{track.album || '—'}</TableCell>
                    <TableCell className="text-gray-300 font-mono">
                      {formatDuration(track.duration)}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {formatDate(track.uploadDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-green-500/50 text-green-500 bg-green-500/10"
                      >
                        Available
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAddingTrack(track)}
                          className="text-green-500 hover:text-green-400 hover:bg-green-500/10 transition-all hover:scale-110"
                          title="Add to Playlist"
                        >
                          <ListPlus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingTrack(track)}
                          className="text-neon-cyan hover:text-neon-purple hover:bg-neon-cyan/10 transition-all hover:scale-110"
                          title="Edit Track"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(track.id, track.title)}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all hover:scale-110"
                          disabled={deleteTrack.isPending}
                          title="Delete Track"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <MediaUploadDialog open={showUploadDialog} onOpenChange={setShowUploadDialog} />
      <CreatePlaylistFromLibraryDialog
        open={showCreatePlaylistDialog}
        onOpenChange={setShowCreatePlaylistDialog}
      />
      {editingTrack && (
        <EditTrackDialog
          track={editingTrack}
          open={!!editingTrack}
          onOpenChange={(open) => !open && setEditingTrack(null)}
        />
      )}
      {showBatchEdit && (
        <BatchEditTrackDialog
          tracks={getSelectedTracksData()}
          open={showBatchEdit}
          onOpenChange={(open) => {
            setShowBatchEdit(open);
            if (!open) setSelectedTracks(new Set());
          }}
        />
      )}
      <AddToPlaylistDialog
        tracks={addingTrack ? [addingTrack] : showBatchAddToPlaylist ? getSelectedTracksData() : []}
        open={!!addingTrack || showBatchAddToPlaylist}
        onOpenChange={(open) => {
          if (!open) {
            setAddingTrack(null);
            setShowBatchAddToPlaylist(false);
            setSelectedTracks(new Set());
          }
        }}
      />
    </div>
  );
}
