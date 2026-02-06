# Specification

## Summary
**Goal:** Make AirPlay playback more reliable by accurately detecting availability/connection state, automatically recovering playback on route changes, reducing AirPlay buffering stalls, and showing clear retry messaging when audio fails.

**Planned changes:**
- Update AirPlay runtime detection to set availability from `webkitplaybacktargetavailabilitychanged` payload and keep connected state synced with `webkitCurrentPlaybackTargetIsWireless` on load and on changes.
- On AirPlay connect/disconnect, reload the current audio source and resume playback when appropriate, preserving the intended track and approximate playback position when possible.
- Add AirPlay-specific buffering/retry handling to avoid prolonged stalls and trigger recovery actions (reload/resume) without changing non-AirPlay playback behavior.
- Add user-facing English UI messaging when AirPlay is connected but playback is failing (e.g., extended buffering), including a one-click “Retry AirPlay/Reconnect” action that attempts recovery (and opens the AirPlay picker when appropriate).

**User-visible outcome:** In Safari on Apple devices, the AirPlay button correctly enables/disables based on availability; connect/disconnect state updates quickly; playback automatically recovers after route changes; and users see a clear retry option if AirPlay is connected but audio isn’t playing.
