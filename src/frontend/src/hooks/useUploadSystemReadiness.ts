import { useQuery } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';

export type UploadSystemStatus = 
  | 'checking'
  | 'ready'
  | 'initializing'
  | 'unauthorized'
  | 'unavailable';

export interface UploadSystemReadiness {
  status: UploadSystemStatus;
  message: string;
  canUpload: boolean;
}

export function useUploadSystemReadiness(enabled: boolean = true) {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<UploadSystemReadiness>({
    queryKey: ['uploadSystemReadiness'],
    queryFn: async (): Promise<UploadSystemReadiness> => {
      // Check if user is authenticated
      if (!identity || identity.getPrincipal().isAnonymous()) {
        return {
          status: 'unauthorized',
          message: 'Please log in to upload tracks',
          canUpload: false,
        };
      }

      if (!actor) {
        return {
          status: 'unavailable',
          message: 'System unavailable. Please try again.',
          canUpload: false,
        };
      }

      try {
        // Check if user is admin/DJ
        const isAdmin = await actor.isCallerAdmin();
        if (!isAdmin) {
          return {
            status: 'unauthorized',
            message: 'Only DJs can upload tracks',
            canUpload: false,
          };
        }

        // Try a lightweight test to see if blob storage is ready
        // We'll attempt to get the media library as a proxy for system readiness
        await actor.getMediaLibrary();

        return {
          status: 'ready',
          message: 'Upload system ready',
          canUpload: true,
        };
      } catch (error: any) {
        console.error('Upload readiness check error:', error);

        // Check for specific error patterns
        if (error.message?.includes('cashier') || error.message?.includes('403')) {
          return {
            status: 'initializing',
            message: 'Upload system is initializing. Please wait a moment and try again.',
            canUpload: false,
          };
        }

        if (error.message?.includes('Unauthorized')) {
          return {
            status: 'unauthorized',
            message: 'You do not have permission to upload tracks',
            canUpload: false,
          };
        }

        return {
          status: 'unavailable',
          message: 'Upload system temporarily unavailable',
          canUpload: false,
        };
      }
    },
    enabled: enabled && !!actor && !actorFetching,
    retry: false,
    refetchInterval: (query) => {
      // Poll every 3 seconds if initializing, otherwise don't refetch
      return query.state.data?.status === 'initializing' ? 3000 : false;
    },
  });
}
