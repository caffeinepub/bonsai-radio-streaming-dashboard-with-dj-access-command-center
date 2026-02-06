import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Playlist, TrackRecord, Track, TrackUpdate, BackgroundSettings } from '../backend';
import { ExternalBlob } from '../backend';

// Public queries - no authentication required
export function useGetPlaylists() {
  const { actor, isFetching } = useActor();

  return useQuery<Playlist[]>({
    queryKey: ['playlists'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPlaylists();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10000,
  });
}

export function useGetListenerCount() {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ['listenerCount'],
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getListenerCount();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
  });
}

export function useIncrementPlayCount() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, trackTitle }: { playlistId: string; trackTitle: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.incrementPlayCount(playlistId, trackTitle);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
}

export function useStartListenerSession() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.startListenerSession();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listenerCount'] });
    },
  });
}

export function useStopListenerSession() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async () => {
      if (!actor || !identity) throw new Error('Actor or identity not available');
      return actor.stopListenerSession(identity.getPrincipal());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listenerCount'] });
    },
  });
}

// Background GIF queries - public read, DJ-only write
export function useGetBackgroundGifs() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<[string, ExternalBlob]>>({
    queryKey: ['backgroundGifs'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getBackgroundGifs();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30000,
  });
}

export function useGetBackgroundSettings() {
  const { actor, isFetching } = useActor();

  return useQuery<BackgroundSettings>({
    queryKey: ['backgroundSettings'],
    queryFn: async () => {
      if (!actor) {
        return {
          transparency: BigInt(50),
          fadeDuration: BigInt(2000),
          animationIntensity: BigInt(3),
          randomizationEnabled: true,
        };
      }
      return actor.getBackgroundSettings();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30000,
  });
}

export function useUploadBackgroundGif() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ gifId, gifFile }: { gifId: string; gifFile: ExternalBlob }) => {
      if (!actor) throw new Error('Actor not available');
      try {
        return await actor.uploadBackgroundGif(gifId, gifFile);
      } catch (error: any) {
        // Check for cashier registration errors
        if (error.message?.includes('cashier') || error.message?.includes('403')) {
          throw new Error('Upload system not ready. Please wait and try again.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backgroundGifs'] });
    },
  });
}

export function useDeleteBackgroundGif() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gifId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteBackgroundGif(gifId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backgroundGifs'] });
    },
  });
}

export function useUpdateBackgroundSettings() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: BackgroundSettings) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateBackgroundSettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backgroundSettings'] });
    },
  });
}

// DJ-only queries - require authentication
export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<boolean>({
    queryKey: ['isCallerAdmin', identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor || !identity || identity.getPrincipal().isAnonymous()) return false;
      try {
        return await actor.isCallerAdmin();
      } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
    },
    enabled: !!actor && !!identity && !identity.getPrincipal().isAnonymous() && !isFetching,
    retry: false,
  });
}

export function useGetMediaLibrary() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Track[]>({
    queryKey: ['mediaLibrary'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSortedMediaLibrary();
    },
    enabled: !!actor && !!identity && !identity.getPrincipal().isAnonymous() && !isFetching,
    refetchInterval: 10000,
  });
}

export function useAddPlaylist() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, tracks }: { playlistId: string; tracks: TrackRecord[] }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addPlaylist(playlistId, tracks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
}

export function useCreatePlaylistFromLibrary() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, trackIds }: { playlistId: string; trackIds: string[] }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createPlaylistFromLibrary(playlistId, trackIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
}

export function useAddTrackToPlaylist() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addTrackToPlaylist(playlistId, trackId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
    },
  });
}

export function useAddTracksToPlaylist() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playlistId, trackIds }: { playlistId: string; trackIds: string[] }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addTracksToPlaylist(playlistId, trackIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
    },
  });
}

export function useAddMediaTrack() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      artist,
      album,
      duration,
      url,
    }: {
      title: string;
      artist: string;
      album: string | null;
      duration: bigint;
      url: ExternalBlob;
    }) => {
      if (!actor) throw new Error('Actor not available');
      try {
        return await actor.addMediaTrack(title, artist, album, duration, url);
      } catch (error: any) {
        // Check for cashier registration errors
        if (error.message?.includes('cashier') || error.message?.includes('403')) {
          throw new Error('Upload system not ready. Please wait and try again.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
    },
  });
}

export function useUpdateTrackMetadata() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trackId,
      title,
      artist,
      album,
      duration,
    }: {
      trackId: string;
      title: string;
      artist: string;
      album: string | null;
      duration: bigint;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateTrackMetadata(trackId, title, artist, album, duration);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
    },
  });
}

export function useUpdateTracksMetadata() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batch: TrackUpdate[]) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateTracksMetadata(batch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });
}

export function useDeleteTrack() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackId: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteTrack(trackId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaLibrary'] });
    },
  });
}

export function useSearchMediaLibrary(searchTerm: string) {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Track[]>({
    queryKey: ['mediaLibrary', 'search', searchTerm],
    queryFn: async () => {
      if (!actor || !searchTerm.trim()) return [];
      return actor.searchMediaLibrary(searchTerm);
    },
    enabled: !!actor && !!identity && !identity.getPrincipal().isAnonymous() && !isFetching && searchTerm.trim().length > 0,
  });
}
