import { useState, useEffect, useCallback } from 'react';

interface AirPlayState {
  isSupported: boolean;
  isAvailable: boolean;
  isConnected: boolean;
  showPicker: () => void;
}

export function useAirPlay(audioElement: HTMLAudioElement | null): AirPlayState {
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!audioElement) return;

    // Check if AirPlay is supported (Safari only)
    const supported = typeof audioElement.webkitShowPlaybackTargetPicker === 'function';
    setIsSupported(supported);

    if (!supported) return;

    // Handle availability changes with proper event payload parsing
    const handleAvailabilityChange = (event: Event) => {
      try {
        const availabilityEvent = event as any;
        // Check the availability property from the event payload
        const available = availabilityEvent.availability === 'available';
        setIsAvailable(available);
      } catch (error) {
        console.error('Error handling AirPlay availability change:', error);
      }
    };

    // Handle wireless connection changes
    const handleWirelessChange = () => {
      try {
        const wireless = audioElement.webkitCurrentPlaybackTargetIsWireless ?? false;
        setIsConnected(wireless);
      } catch (error) {
        console.error('Error handling AirPlay wireless change:', error);
      }
    };

    // Add event listeners
    audioElement.addEventListener(
      'webkitplaybacktargetavailabilitychanged',
      handleAvailabilityChange
    );
    audioElement.addEventListener(
      'webkitcurrentplaybacktargetiswirelesschanged',
      handleWirelessChange
    );

    // Check initial state
    if (audioElement.webkitCurrentPlaybackTargetIsWireless !== undefined) {
      setIsConnected(audioElement.webkitCurrentPlaybackTargetIsWireless);
    }

    // Cleanup
    return () => {
      audioElement.removeEventListener(
        'webkitplaybacktargetavailabilitychanged',
        handleAvailabilityChange
      );
      audioElement.removeEventListener(
        'webkitcurrentplaybacktargetiswirelesschanged',
        handleWirelessChange
      );
    };
  }, [audioElement]);

  const showPicker = useCallback(() => {
    if (audioElement && audioElement.webkitShowPlaybackTargetPicker) {
      try {
        audioElement.webkitShowPlaybackTargetPicker();
      } catch (error) {
        console.error('Failed to show AirPlay picker:', error);
      }
    }
  }, [audioElement]);

  return {
    isSupported,
    isAvailable,
    isConnected,
    showPicker,
  };
}
