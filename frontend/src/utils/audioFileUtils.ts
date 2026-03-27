/**
 * Audio file validation and metadata extraction utilities
 */

// Supported audio file extensions
const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.flac',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.wma',
  '.aiff',
  '.ape',
];

// Known audio MIME types
const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/x-ms-wma',
  'audio/aiff',
  'audio/x-aiff',
  'audio/ape',
  'audio/x-ape',
];

/**
 * Validates if a file is a supported audio file
 * Checks both MIME type and file extension to handle cases where MIME is empty/unknown
 */
export function isValidAudioFile(file: File): { valid: boolean; reason?: string } {
  // Check MIME type if available
  if (file.type) {
    if (AUDIO_MIME_TYPES.includes(file.type) || file.type.startsWith('audio/')) {
      return { valid: true };
    }
  }

  // If MIME type is empty or unknown, check file extension
  const fileName = file.name.toLowerCase();
  const hasAudioExtension = SUPPORTED_AUDIO_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (hasAudioExtension) {
    return { valid: true };
  }

  // Reject if neither MIME type nor extension indicates audio
  return {
    valid: false,
    reason: `File "${file.name}" does not appear to be a supported audio file. Supported formats: MP3, WAV, FLAC, M4A, AAC, OGG, etc.`,
  };
}

/**
 * Extract audio duration using multiple fallback methods
 * Returns duration in seconds, or null if unable to determine
 */
export async function extractAudioDuration(file: File): Promise<number | null> {
  // Method 1: Try Web Audio API (most accurate but may fail for some formats)
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    return Math.floor(audioBuffer.duration);
  } catch (error) {
    console.warn('Web Audio API failed, trying fallback method:', error);
  }

  // Method 2: Fallback to HTMLAudioElement (works for more formats)
  try {
    const duration = await extractDurationViaAudioElement(file);
    if (duration && duration > 0) {
      return Math.floor(duration);
    }
  } catch (error) {
    console.warn('HTMLAudioElement fallback failed:', error);
  }

  // Unable to determine duration
  return null;
}

/**
 * Extract duration using HTMLAudioElement
 * Creates a temporary object URL and loads metadata
 */
function extractDurationViaAudioElement(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.remove();
    };

    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      cleanup();
      resolve(duration && isFinite(duration) ? duration : null);
    });

    audio.addEventListener('error', () => {
      cleanup();
      resolve(null);
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    audio.src = objectUrl;
  });
}

/**
 * Parse duration string in format "mm:ss" or "m:ss" to seconds
 */
export function parseDurationString(durationStr: string): number {
  const parts = durationStr.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Format seconds to "mm:ss" string
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
