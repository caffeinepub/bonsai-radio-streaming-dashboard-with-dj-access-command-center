# Specification

## Summary
**Goal:** Fix MP3 uploads so users can select, process, upload, and play MP3 tracks reliably.

**Planned changes:**
- Update frontend file validation in `MediaUploadDialog` to accept `.mp3` files even when the browser provides an empty/unknown MIME type, while still rejecting clearly non-audio files with a clear error.
- Adjust the file input accept configuration to explicitly include MP3 support (e.g., `.mp3` and/or `audio/mpeg`) while keeping other supported audio formats.
- Make upload metadata extraction more robust for MP3: if Web Audio API `decodeAudioData` fails, fall back to alternate duration detection (e.g., HTMLAudioElement metadata loading).
- If duration cannot be auto-detected, allow the user to manually enter/edit track duration in the upload UI and proceed with upload.
- Verify/adjust backend blob storage integration to ensure MP3 blobs are accepted, stored, and served correctly (including using `audio/mpeg` where applicable) and return actionable errors on failure.

**User-visible outcome:** Users can upload MP3 files from the media upload dialog; MP3s are accepted even with missing MIME type, duration is detected (or can be entered manually), uploads complete successfully, and tracks play correctly from the media library.
