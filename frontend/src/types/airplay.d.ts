// TypeScript declarations for Safari AirPlay APIs
interface HTMLMediaElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

// Event payload for availability changes
interface WebKitPlaybackTargetAvailabilityEvent extends Event {
  availability: 'available' | 'not-available';
}

interface HTMLMediaElementEventMap {
  webkitplaybacktargetavailabilitychanged: WebKitPlaybackTargetAvailabilityEvent;
  webkitcurrentplaybacktargetiswirelesschanged: Event;
}
