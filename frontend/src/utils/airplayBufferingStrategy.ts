export interface AirPlayBufferingConfig {
  // Threshold for detecting prolonged buffering (in seconds)
  bufferingThreshold: number;
  // Maximum time to wait before attempting recovery (in milliseconds)
  maxBufferingTime: number;
  // Minimum buffer ahead required for stable playback (in seconds)
  minBufferAhead: number;
  // Maximum number of recovery attempts
  maxRecoveryAttempts: number;
}

export const AIRPLAY_BUFFERING_CONFIG: AirPlayBufferingConfig = {
  bufferingThreshold: 2, // Detect buffering after 2 seconds
  maxBufferingTime: 10000, // Attempt recovery after 10 seconds
  minBufferAhead: 5, // Require 5 seconds of buffer for AirPlay
  maxRecoveryAttempts: 3,
};

export const DEFAULT_BUFFERING_CONFIG: AirPlayBufferingConfig = {
  bufferingThreshold: 3,
  maxBufferingTime: 15000,
  minBufferAhead: 3,
  maxRecoveryAttempts: 5,
};

export function getBufferingConfig(isAirPlayConnected: boolean): AirPlayBufferingConfig {
  return isAirPlayConnected ? AIRPLAY_BUFFERING_CONFIG : DEFAULT_BUFFERING_CONFIG;
}

export function shouldAttemptRecovery(
  bufferingStartTime: number | null,
  isAirPlayConnected: boolean
): boolean {
  if (!bufferingStartTime) return false;
  
  const config = getBufferingConfig(isAirPlayConnected);
  const bufferingDuration = Date.now() - bufferingStartTime;
  
  return bufferingDuration >= config.maxBufferingTime;
}

export function getBufferAheadThreshold(isAirPlayConnected: boolean): number {
  const config = getBufferingConfig(isAirPlayConnected);
  return config.minBufferAhead;
}
