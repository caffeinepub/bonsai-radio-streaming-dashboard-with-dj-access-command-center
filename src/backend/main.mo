import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Time "mo:core/Time";


import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";


actor {
  type Track = {
    id : Text;
    title : Text;
    artist : Text;
    album : ?Text;
    duration : Nat;
    uploadDate : Int;
    url : Storage.ExternalBlob;
  };

  type TrackRecord = {
    title : Text;
    artist : Text;
    album : ?Text;
    duration : Nat;
    audioFile : Storage.ExternalBlob;
    playCount : Nat;
  };

  type Playlist = {
    id : Text;
    tracks : [TrackRecord];
  };

  type UploadProgress = {
    uploaded : Nat;
    total : Nat;
    isComplete : Bool;
    isError : Bool;
  };

  type TrackUpdate = {
    title : Text;
    artist : Text;
    album : ?Text;
    duration : Nat;
  };

  public type UserProfile = {
    name : Text;
  };

  type Listener = Principal;

  // Authorization and storage mixins
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  var trackIdCounter : Nat = 1;

  // Persistent state
  let playlists = Map.empty<Text, Playlist>();
  let mediaLibrary = Map.empty<Text, Track>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  var listenerCount : Nat = 0;
  let listeners = Map.empty<Listener, Nat>();

  // Background GIF data and settings
  let backgroundGifs = Map.empty<Text, Storage.ExternalBlob>();

  type BackgroundSettings = {
    transparency : Nat;
    fadeDuration : Nat;
    animationIntensity : Nat;
    randomizationEnabled : Bool;
  };

  var backgroundSettings : BackgroundSettings = {
    transparency = 50;
    fadeDuration = 2000;
    animationIntensity = 3;
    randomizationEnabled = true;
  };

  module Track {
    public func compare(track1 : Track, track2 : Track) : Order.Order {
      switch (Text.compare(track1.title, track2.title)) {
        case (#equal) { Text.compare(track1.artist, track2.artist) };
        case (order) { order };
      };
    };
  };

  module Playlist {
    public func compare(playlist1 : Playlist, playlist2 : Playlist) : Order.Order {
      Text.compare(playlist1.id, playlist2.id);
    };
  };

  module TrackRecord {
    public func compare(record1 : TrackRecord, record2 : TrackRecord) : Order.Order {
      switch (Text.compare(record1.title, record2.title)) {
        case (#equal) { Text.compare(record1.artist, record2.artist) };
        case (order) { order };
      };
    };
  };

  // User Profile Management - User level access
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Media Library - DJ only access
  public query ({ caller }) func getMediaLibrary() : async [(Text, Track)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can access media library");
    };
    mediaLibrary.toArray();
  };

  public query ({ caller }) func getSortedMediaLibrary() : async [Track] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can access media library");
    };
    mediaLibrary.values().toArray().sort();
  };

  public query ({ caller }) func searchMediaLibrary(term : Text) : async [Track] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can access media library");
    };
    mediaLibrary.values().toArray().filter(
      func(track) {
        let lowercaseTerm = term.toLower();
        track.title.toLower().contains(#text(lowercaseTerm)) or track.artist.toLower().contains(#text(lowercaseTerm));
      }
    );
  };

  public shared ({ caller }) func addMediaTrack(title : Text, artist : Text, album : ?Text, duration : Nat, url : Storage.ExternalBlob) : async Track {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can add new tracks");
    };

    let id = trackIdCounter.toText();
    trackIdCounter += 1;

    let newTrack : Track = {
      id;
      title;
      artist;
      album;
      duration;
      uploadDate = Time.now();
      url;
    };

    mediaLibrary.add(id, newTrack);
    newTrack;
  };

  public query ({ caller }) func getMediaTrack(trackId : Text) : async ?Track {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can access media library");
    };
    mediaLibrary.get(trackId);
  };

  public shared ({ caller }) func updateTrackMetadata(trackId : Text, title : Text, artist : Text, album : ?Text, duration : Nat) : async Track {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can update tracks");
    };

    switch (mediaLibrary.get(trackId)) {
      case (?existingTrack) {
        let updatedTrack : Track = {
          existingTrack with
          title;
          artist;
          album;
          duration;
        };
        mediaLibrary.add(trackId, updatedTrack);
        updatedTrack;
      };
      case (null) {
        Runtime.trap("Track not found");
      };
    };
  };

  public shared ({ caller }) func updateTracksMetadata(batch : [(Text, TrackUpdate)]) : async [Track] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can update tracks");
    };

    let updatedTracks = batch.map(
      func((id, update)) {
        switch (mediaLibrary.get(id)) {
          case (?track) {
            let updatedTrack : Track = {
              track with
              title = update.title;
              artist = update.artist;
              album = update.album;
              duration = update.duration;
            };
            mediaLibrary.add(id, updatedTrack);
            updatedTrack;
          };
          case (null) { Runtime.trap("Track not found in media library") };
        };
      }
    );
    updatedTracks;
  };

  public shared ({ caller }) func deleteTrack(trackId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can delete tracks");
    };
    mediaLibrary.remove(trackId);
  };

  public shared ({ caller }) func storeUploadProgress(progress : UploadProgress) : async UploadProgress {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can upload tracks");
    };
    progress;
  };

  // Playlists - Public read access, DJ-only write access
  public query func getPlaylists() : async [Playlist] {
    playlists.values().toArray().sort();
  };

  public query func getPlaylistsReverse() : async [Playlist] {
    playlists.values().toArray().reverse();
  };

  public query func getFilteredPlaylists(playlistId : Text) : async [Playlist] {
    playlists.values().toArray().filter(func(p) { p.id.contains(#text(playlistId)) });
  };

  public shared ({ caller }) func addPlaylist(newPlaylistId : Text, tracks : [TrackRecord]) : async Playlist {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can add new playlists");
    };

    switch (playlists.get(newPlaylistId)) {
      case (?playlist) { return playlist };
      case (null) {
        let sortedTracks = tracks.sort();
        let newPlaylist : Playlist = {
          id = newPlaylistId;
          tracks = sortedTracks;
        };
        playlists.add(newPlaylistId, newPlaylist);
        newPlaylist;
      };
    };
  };

  public shared ({ caller }) func createEmptyPlaylist(playlistId : Text) : async Playlist {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can create empty playlists");
    };

    switch (playlists.get(playlistId)) {
      case (?playlist) { return playlist };
      case (null) {
        let emptyPlaylist : Playlist = {
          id = playlistId;
          tracks = [];
        };
        playlists.add(playlistId, emptyPlaylist);
        emptyPlaylist;
      };
    };
  };

  public shared ({ caller }) func createPlaylistFromLibrary(playlistId : Text, trackIds : [Text]) : async Playlist {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can create playlists from media library");
    };

    switch (playlists.get(playlistId)) {
      case (?playlist) { return playlist };
      case (null) {
        let tracks = trackIds.map(
          func(trackId) {
            switch (mediaLibrary.get(trackId)) {
              case (?track) {
                {
                  title = track.title;
                  artist = track.artist;
                  album = track.album;
                  duration = track.duration;
                  audioFile = track.url;
                  playCount = 0;
                };
              };
              case (null) { Runtime.trap("Track not found in media library") };
            };
          }
        );

        let newPlaylist : Playlist = {
          id = playlistId;
          tracks;
        };
        playlists.add(playlistId, newPlaylist);
        newPlaylist;
      };
    };
  };

  public shared ({ caller }) func addTrackToPlaylist(playlistId : Text, trackId : Text) : async Playlist {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can add tracks to playlists");
    };

    switch (playlists.get(playlistId)) {
      case (?playlist) {
        switch (mediaLibrary.get(trackId)) {
          case (?track) {
            let trackRecord : TrackRecord = {
              title = track.title;
              artist = track.artist;
              album = track.album;
              duration = track.duration;
              audioFile = track.url;
              playCount = 0;
            };

            let updatedTracks = playlist.tracks.concat([trackRecord]);
            let updatedPlaylist : Playlist = {
              id = playlist.id;
              tracks = updatedTracks;
            };

            playlists.add(playlistId, updatedPlaylist);
            updatedPlaylist;
          };
          case (null) { Runtime.trap("Track not found in media library") };
        };
      };
      case (null) { Runtime.trap("Playlist not found") };
    };
  };

  public shared ({ caller }) func addTracksToPlaylist(playlistId : Text, trackIds : [Text]) : async Playlist {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can add tracks to playlists");
    };

    switch (playlists.get(playlistId)) {
      case (?playlist) {
        let newTrackRecords = trackIds.map(
          func(trackId) {
            switch (mediaLibrary.get(trackId)) {
              case (?track) {
                {
                  title = track.title;
                  artist = track.artist;
                  album = track.album;
                  duration = track.duration;
                  audioFile = track.url;
                  playCount = 0;
                };
              };
              case (null) { Runtime.trap("Track not found in media library") };
            };
          }
        );

        let updatedTracks = playlist.tracks.concat(newTrackRecords);
        let updatedPlaylist : Playlist = {
          id = playlist.id;
          tracks = updatedTracks;
        };

        playlists.add(playlistId, updatedPlaylist);
        updatedPlaylist;
      };
      case (null) { Runtime.trap("Playlist not found") };
    };
  };

  // Play count increment - Public access for streaming
  public shared ({ caller }) func incrementPlayCount(playlistId : Text, trackTitle : Text) : async () {
    switch (playlists.get(playlistId)) {
      case (?playlist) {
        let updatedTracks = playlist.tracks.map(
          func(track) {
            if (track.title == trackTitle) {
              {
                title = track.title;
                artist = track.artist;
                album = track.album;
                duration = track.duration;
                audioFile = track.audioFile;
                playCount = track.playCount + 1;
              };
            } else {
              track;
            };
          }
        );
        let updatedPlaylist : Playlist = {
          id = playlist.id;
          tracks = updatedTracks;
        };
        playlists.add(playlistId, updatedPlaylist);
      };
      case (null) {
        Runtime.trap("Playlist not found");
      };
    };
  };

  // Listener count - Public access
  public query func getListenerCount() : async Nat {
    listenerCount;
  };

  public shared ({ caller }) func startListenerSession() : async Listener {
    switch (listeners.get(caller)) {
      case (?_) { Runtime.trap("Listener session already active for this user") };
      case (null) {
        listeners.add(caller, listenerCount);
        listenerCount += 1;
        caller;
      };
    };
  };

  public shared ({ caller }) func stopListenerSession(listener : Listener) : async () {
    if (caller != listener) {
      Runtime.trap("Unauthorized: Can only stop your own listener session");
    };

    switch (listeners.get(listener)) {
      case (?_) {
        listeners.remove(listener);
        if (listenerCount > 0) {
          listenerCount -= 1;
        };
      };
      case (null) {
        Runtime.trap("Listener session not found");
      };
    };
  };

  // Background GIF Management - DJ Only Access
  public shared ({ caller }) func uploadBackgroundGif(gifId : Text, gifFile : Storage.ExternalBlob) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can upload background GIFs");
    };
    backgroundGifs.add(gifId, gifFile);
  };

  public shared ({ caller }) func deleteBackgroundGif(gifId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can delete background GIFs");
    };
    if (backgroundGifs.containsKey(gifId)) {
      backgroundGifs.remove(gifId);
    } else {
      Runtime.trap("GIF not found");
    };
  };

  public query func getBackgroundGifs() : async [(Text, Storage.ExternalBlob)] {
    backgroundGifs.toArray();
  };

  public shared ({ caller }) func updateBackgroundSettings(settings : BackgroundSettings) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only DJs can update background settings");
    };
    backgroundSettings := settings;
  };

  public query func getBackgroundSettings() : async BackgroundSettings {
    backgroundSettings;
  };

  public shared ({ caller }) func initializeDefaultGifs(defaultGifs : [(Text, Storage.ExternalBlob)]) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can initialize default GIFs");
    };
    if (backgroundGifs.isEmpty()) {
      let entries = defaultGifs.values();
      for (entry in entries) {
        backgroundGifs.add(entry.0, entry.1);
      };
    };
  };
};

