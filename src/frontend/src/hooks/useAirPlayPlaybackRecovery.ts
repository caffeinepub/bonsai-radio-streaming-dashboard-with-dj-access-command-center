import { useEffect, useRef } from "react";

interface UseAirPlayPlaybackRecoveryProps {
  audioElement: HTMLAudioElement | null;
  isConnected: boolean;
  isPlaying: boolean;
  currentTrackUrl: string | null;
  onRecoveryAttempt: () => void;
}

export function useAirPlayPlaybackRecovery({
  audioElement,
  isConnected,
  isPlaying,
  currentTrackUrl,
  onRecoveryAttempt,
}: UseAirPlayPlaybackRecoveryProps) {
  const previousConnectionState = useRef<boolean>(false);
  const isRecovering = useRef<boolean>(false);
  const recoveryTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Detect connection state changes
    if (previousConnectionState.current !== isConnected) {
      const _wasConnected = previousConnectionState.current;
      const _nowConnected = isConnected;

      previousConnectionState.current = isConnected;

      // Only attempt recovery if we were playing and the connection state changed
      if (
        isPlaying &&
        audioElement &&
        currentTrackUrl &&
        !isRecovering.current
      ) {
        // Clear any pending recovery
        if (recoveryTimeout.current) {
          clearTimeout(recoveryTimeout.current);
          recoveryTimeout.current = null;
        }

        // Mark as recovering to prevent overlapping attempts
        isRecovering.current = true;

        // Delay recovery slightly to allow the route change to complete
        recoveryTimeout.current = setTimeout(() => {
          if (!audioElement || !currentTrackUrl) {
            isRecovering.current = false;
            return;
          }

          try {
            // Capture current position
            const currentTime = audioElement.currentTime || 0;

            // Reload the source
            const currentSrc = audioElement.src;
            if (currentSrc !== currentTrackUrl) {
              audioElement.src = currentTrackUrl;
            } else {
              // Force reload by setting src again
              audioElement.load();
            }

            // Restore position (best effort)
            if (currentTime > 0) {
              audioElement.currentTime = currentTime;
            }

            // Attempt to resume playback
            const playPromise = audioElement.play();
            if (playPromise) {
              playPromise
                .then(() => {
                  console.log("AirPlay route change recovery successful");
                  onRecoveryAttempt();
                })
                .catch((error) => {
                  console.error("AirPlay recovery playback error:", error);
                  onRecoveryAttempt();
                })
                .finally(() => {
                  isRecovering.current = false;
                });
            } else {
              isRecovering.current = false;
            }
          } catch (error) {
            console.error("AirPlay recovery error:", error);
            isRecovering.current = false;
          }
        }, 500); // 500ms delay to allow route change to settle
      }
    }
  }, [
    isConnected,
    isPlaying,
    audioElement,
    currentTrackUrl,
    onRecoveryAttempt,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimeout.current) {
        clearTimeout(recoveryTimeout.current);
      }
    };
  }, []);
}
