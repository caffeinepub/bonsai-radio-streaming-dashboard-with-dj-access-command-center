import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface TrackRecord {
    title: string;
    duration: bigint;
    album?: string;
    audioFile: ExternalBlob;
    playCount: bigint;
    artist: string;
}
export type Listener = Principal;
export interface BackgroundSettings {
    transparency: bigint;
    fadeDuration: bigint;
    animationIntensity: bigint;
    randomizationEnabled: boolean;
}
export interface Track {
    id: string;
    url: ExternalBlob;
    title: string;
    duration: bigint;
    album?: string;
    artist: string;
    uploadDate: bigint;
}
export interface Playlist {
    id: string;
    tracks: Array<TrackRecord>;
}
export interface TrackUpdate {
    title: string;
    duration: bigint;
    album?: string;
    artist: string;
}
export interface UploadProgress {
    isError: boolean;
    total: bigint;
    uploaded: bigint;
    isComplete: boolean;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addMediaTrack(title: string, artist: string, album: string | null, duration: bigint, url: ExternalBlob): Promise<Track>;
    addPlaylist(newPlaylistId: string, tracks: Array<TrackRecord>): Promise<Playlist>;
    addTrackToPlaylist(playlistId: string, trackId: string): Promise<Playlist>;
    addTracksToPlaylist(playlistId: string, trackIds: Array<string>): Promise<Playlist>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createEmptyPlaylist(playlistId: string): Promise<Playlist>;
    createPlaylistFromLibrary(playlistId: string, trackIds: Array<string>): Promise<Playlist>;
    deleteBackgroundGif(gifId: string): Promise<void>;
    deleteTrack(trackId: string): Promise<void>;
    getBackgroundGifs(): Promise<Array<[string, ExternalBlob]>>;
    getBackgroundSettings(): Promise<BackgroundSettings>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getFilteredPlaylists(playlistId: string): Promise<Array<Playlist>>;
    getListenerCount(): Promise<bigint>;
    getMediaLibrary(): Promise<Array<[string, Track]>>;
    getMediaTrack(trackId: string): Promise<Track | null>;
    getPlaylists(): Promise<Array<Playlist>>;
    getPlaylistsReverse(): Promise<Array<Playlist>>;
    getSortedMediaLibrary(): Promise<Array<Track>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    incrementPlayCount(playlistId: string, trackTitle: string): Promise<void>;
    initializeDefaultGifs(defaultGifs: Array<[string, ExternalBlob]>): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    searchMediaLibrary(term: string): Promise<Array<Track>>;
    startListenerSession(): Promise<Listener>;
    stopListenerSession(listener: Listener): Promise<void>;
    storeUploadProgress(progress: UploadProgress): Promise<UploadProgress>;
    updateBackgroundSettings(settings: BackgroundSettings): Promise<void>;
    updateTrackMetadata(trackId: string, title: string, artist: string, album: string | null, duration: bigint): Promise<Track>;
    updateTracksMetadata(batch: Array<[string, TrackUpdate]>): Promise<Array<Track>>;
    uploadBackgroundGif(gifId: string, gifFile: ExternalBlob): Promise<void>;
}
