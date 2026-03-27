# Specification

## Summary
**Goal:** Fix the "track is not in the media library" error that occurs when creating playlists with recently uploaded tracks.

**Planned changes:**
- Ensure uploaded tracks are immediately registered and queryable in the media library after upload completion
- Handle race conditions between upload completion and playlist creation
- Update CreatePlaylistFromLibraryDialog to verify track availability before playlist creation
- Add automatic retry logic if a selected track is temporarily unavailable
- Provide clear user feedback when selected tracks are not yet available in the library

**User-visible outcome:** Users can successfully create playlists immediately after uploading tracks without encountering "track is not in the media library" errors.
