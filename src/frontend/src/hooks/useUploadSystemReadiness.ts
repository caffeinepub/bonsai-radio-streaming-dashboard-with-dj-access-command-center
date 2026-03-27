import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

export type UploadSystemStatus =
  | "checking"
  | "ready"
  | "initializing"
  | "unauthorized"
  | "unavailable";

export interface UploadSystemReadiness {
  status: UploadSystemStatus;
  message: string;
  canUpload: boolean;
}

export function useUploadSystemReadiness(enabled = true) {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<UploadSystemReadiness>({
    queryKey: ["uploadSystemReadiness"],
    queryFn: async (): Promise<UploadSystemReadiness> => {
      // Check if user is authenticated
      if (!identity || identity.getPrincipal().isAnonymous()) {
        return {
          status: "unauthorized",
          message: "Please log in to upload tracks",
          canUpload: false,
        };
      }

      if (!actor) {
        return {
          status: "unavailable",
          message: "System unavailable. Please try again.",
          canUpload: false,
        };
      }

      try {
        // Check if user is admin/DJ
        const isAdmin = await actor.isCallerAdmin();
        if (!isAdmin) {
          return {
            status: "unauthorized",
            message: "Only DJs can upload tracks",
            canUpload: false,
          };
        }

        // Use _caffeineStorageUpdateGatewayPrincipals as a real blob storage probe.
        // If the cashier account isn't ready it throws a 403/cashier error,
        // which means uploads will fail — so we return 'initializing' instead of
        // falsely showing 'ready'.
        try {
          await actor._caffeineStorageUpdateGatewayPrincipals();
        } catch (storageError: any) {
          const msg = storageError?.message || String(storageError);
          if (
            msg.includes("cashier") ||
            msg.includes("403") ||
            msg.includes("does not have an account")
          ) {
            return {
              status: "initializing",
              message:
                "Blob storage account is being set up. This may take a moment — please check back shortly.",
              canUpload: false,
            };
          }
          // Any other storage error: treat as ready (don't block on non-cashier issues)
        }

        return {
          status: "ready",
          message: "Upload system ready",
          canUpload: true,
        };
      } catch (error: any) {
        console.error("Upload readiness check error:", error);

        // Check for specific error patterns
        if (
          error.message?.includes("cashier") ||
          error.message?.includes("403") ||
          error.message?.includes("does not have an account")
        ) {
          return {
            status: "initializing",
            message:
              "Blob storage account is being set up. This may take a moment — please check back shortly.",
            canUpload: false,
          };
        }

        if (error.message?.includes("Unauthorized")) {
          return {
            status: "unauthorized",
            message: "You do not have permission to upload tracks",
            canUpload: false,
          };
        }

        return {
          status: "unavailable",
          message: "Upload system temporarily unavailable",
          canUpload: false,
        };
      }
    },
    enabled: enabled && !!actor && !actorFetching,
    retry: false,
    refetchInterval: (query) => {
      // Poll every 10 seconds if initializing to reduce spam, otherwise don't refetch
      return query.state.data?.status === "initializing" ? 10000 : false;
    },
  });
}
