import { useState, useRef, useEffect } from 'react';
import { useGetPlaylists, useGetListenerCount, useIncrementPlayCount } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Play, Pause, Radio, Volume2 } from 'lucide-react';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import { useAirPlay } from '../hooks/useAirPlay';
import { useAirPlayPlaybackRecovery } from '../hooks/useAirPlayPlaybackRecovery';
import { getBufferingConfig, shouldAttemptRecovery, getBufferAheadThreshold } from '../utils/airplayBufferingStrategy';
import StreamStabilityIndicator from './StreamStabilityIndicator';
import BackgroundGifOverlay from './BackgroundGifOverlay';
import AirPlayControl from './AirPlayControl';
import AirPlayPlaybackAlert from './AirPlayPlaybackAlert';

type BufferState = 'stable' | 'buffering' | 'error';

export default function EmbeddedMusicPlayer() {
  const { data: playlists = [] } = useGetPlaylists();
  const { data: listenerCount = BigInt(0) } = useGetListenerCount();
  const incrementPlayCount = useIncrementPlayCount();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumeNormalization, setVolumeNormalization] = useState(false);
  const [bufferState, setBufferState] = useState<BufferState>('stable');
  const [savedPosition, setSavedPosition] = useState(0);
  const [showAirPlayAlert, setShowAirPlayAlert] = useState(false);
  const [isAirPlayRetrying, setIsAirPlayRetrying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  const targetVolumeRef = useRef(1);
  const currentVolumeRef = useRef(1);
  const bufferingStartTimeRef = useRef<number | null>(null);
  const airplayBufferingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const airplayRecoveryAttemptsRef = useRef(0);

  const audioData = useAudioAnalyzer(audioRef.current, isPlaying);
  const airPlay = useAirPlay(audioRef.current);

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const currentTrack = selectedPlaylist?.tracks[currentTrackIndex];
  const currentTrackUrl = currentTrack?.audioFile.getDirectURL() || null;

  // AirPlay route change recovery
  useAirPlayPlaybackRecovery({
    audioElement: audioRef.current,
    isConnected: airPlay.isConnected,
    isPlaying,
    currentTrackUrl,
    onRecoveryAttempt: () => {
      setBufferState('stable');
      retryCountRef.current = 0;
      airplayRecoveryAttemptsRef.current = 0;
      setShowAirPlayAlert(false);
    },
  });

  useEffect(() => {
    if (playlists.length > 0 && !selectedPlaylistId) {
      setSelectedPlaylistId(playlists[0].id);
    }
  }, [playlists, selectedPlaylistId]);

  // Enhanced audio loading with adaptive buffering
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      const audioUrl = currentTrack.audioFile.getDirectURL();
      const previousSrc = audioRef.current.src;
      
      // Save position before changing source
      if (previousSrc && audioRef.current.currentTime > 0) {
        setSavedPosition(audioRef.current.currentTime);
      }
      
      audioRef.current.src = audioUrl;
      audioRef.current.preload = 'auto';
      
      // Restore position if reloading same track
      if (previousSrc === audioUrl && savedPosition > 0) {
        audioRef.current.currentTime = savedPosition;
      }
      
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise) {
          playPromise.catch((error) => {
            console.error('Playback error:', error);
            handlePlaybackError();
          });
        }
      }
    }
  }, [currentTrack]);

  // Enhanced volume normalization with improved stability
  useEffect(() => {
    if (!volumeNormalization || !audioData.isActive) return;

    const normalizeVolume = () => {
      if (!gainNodeRef.current) return;

      // Calculate target gain based on current volume with better compression
      const currentLevel = audioData.volume;
      const targetLevel = 0.55;
      
      if (currentLevel > 0.08) {
        const ratio = targetLevel / currentLevel;
        targetVolumeRef.current = Math.min(2.5, Math.pow(ratio, 0.8));
      }

      // Smoother interpolation
      const smoothingFactor = 0.97;
      currentVolumeRef.current = 
        currentVolumeRef.current * smoothingFactor + 
        targetVolumeRef.current * (1 - smoothingFactor);

      gainNodeRef.current.gain.setValueAtTime(
        currentVolumeRef.current,
        gainNodeRef.current.context.currentTime
      );
    };

    const intervalId = setInterval(normalizeVolume, 80);
    return () => clearInterval(intervalId);
  }, [volumeNormalization, audioData]);

  const handlePlayPause = async () => {
    if (!audioRef.current || !currentTrack) return;

    if (!isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setBufferState('stable');
            retryCountRef.current = 0;
            airplayRecoveryAttemptsRef.current = 0;
            setShowAirPlayAlert(false);
          })
          .catch((error) => {
            console.error('Play error:', error);
            handlePlaybackError();
          });
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handlePlaybackError = () => {
    setBufferState('error');
    
    const config = getBufferingConfig(airPlay.isConnected);
    const maxRetries = config.maxRecoveryAttempts;
    
    if (retryCountRef.current < maxRetries) {
      retryCountRef.current++;
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      const backoffTime = Math.min(1000 * Math.pow(1.5, retryCountRef.current) + Math.random() * 500, 5000);
      
      retryTimeoutRef.current = setTimeout(() => {
        if (audioRef.current && currentTrack) {
          console.log(`Retry attempt ${retryCountRef.current}/${maxRetries}`);
          
          const position = audioRef.current.currentTime;
          setSavedPosition(position);
          
          audioRef.current.volume = 0;
          const audioUrl = currentTrack.audioFile.getDirectURL();
          audioRef.current.src = audioUrl;
          audioRef.current.currentTime = position;
          
          audioRef.current.play()
            .then(() => {
              let vol = 0;
              const fadeIn = setInterval(() => {
                vol += 0.08;
                if (audioRef.current) {
                  audioRef.current.volume = Math.min(1, vol);
                }
                if (vol >= 1) {
                  clearInterval(fadeIn);
                  setBufferState('stable');
                }
              }, 40);
            })
            .catch(() => {
              handlePlaybackError();
            });
        }
      }, backoffTime);
    } else {
      console.error('Max retry attempts reached');
      setIsPlaying(false);
      
      // Show AirPlay alert if connected
      if (airPlay.isConnected) {
        setShowAirPlayAlert(true);
      }
    }
  };

  const handleAirPlayRecovery = () => {
    if (!audioRef.current || !currentTrack) return;
    
    setIsAirPlayRetrying(true);
    airplayRecoveryAttemptsRef.current++;
    
    // Reset retry counters
    retryCountRef.current = 0;
    
    // Save position and reload
    const position = audioRef.current.currentTime;
    setSavedPosition(position);
    
    const audioUrl = currentTrack.audioFile.getDirectURL();
    audioRef.current.src = audioUrl;
    audioRef.current.currentTime = position;
    
    const playPromise = audioRef.current.play();
    if (playPromise) {
      playPromise
        .then(() => {
          setBufferState('stable');
          setShowAirPlayAlert(false);
          setIsAirPlayRetrying(false);
        })
        .catch((error) => {
          console.error('AirPlay recovery failed:', error);
          setIsAirPlayRetrying(false);
          
          // Show picker if recovery fails
          if (airPlay.isAvailable) {
            airPlay.showPicker();
          }
        });
    } else {
      setIsAirPlayRetrying(false);
    }
  };

  const handleTrackEnd = () => {
    if (!selectedPlaylist || !currentTrack) return;

    incrementPlayCount.mutate({
      playlistId: selectedPlaylistId,
      trackTitle: currentTrack.title,
    });

    const nextIndex = (currentTrackIndex + 1) % selectedPlaylist.tracks.length;
    setCurrentTrackIndex(nextIndex);
    setSavedPosition(0);
    retryCountRef.current = 0;
    airplayRecoveryAttemptsRef.current = 0;
    setShowAirPlayAlert(false);
  };

  const handlePlaylistChange = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setCurrentTrackIndex(0);
    setIsPlaying(false);
    setSavedPosition(0);
    retryCountRef.current = 0;
    airplayRecoveryAttemptsRef.current = 0;
    setShowAirPlayAlert(false);
  };

  const handleWaiting = () => {
    setBufferState('buffering');
    
    // Start tracking buffering time
    if (!bufferingStartTimeRef.current) {
      bufferingStartTimeRef.current = Date.now();
    }
    
    // Set up AirPlay-specific buffering recovery
    if (airPlay.isConnected && !airplayBufferingTimeoutRef.current) {
      const config = getBufferingConfig(true);
      
      airplayBufferingTimeoutRef.current = setTimeout(() => {
        if (bufferState === 'buffering' && airPlay.isConnected) {
          console.log('AirPlay prolonged buffering detected, attempting recovery');
          
          if (airplayRecoveryAttemptsRef.current < config.maxRecoveryAttempts) {
            handleAirPlayRecovery();
          } else {
            setShowAirPlayAlert(true);
          }
        }
        airplayBufferingTimeoutRef.current = null;
      }, config.maxBufferingTime);
    }
  };

  const handleCanPlay = () => {
    if (bufferState === 'buffering') {
      setBufferState('stable');
      bufferingStartTimeRef.current = null;
      
      // Clear AirPlay buffering timeout
      if (airplayBufferingTimeoutRef.current) {
        clearTimeout(airplayBufferingTimeoutRef.current);
        airplayBufferingTimeoutRef.current = null;
      }
    }
  };

  const handleProgress = () => {
    if (audioRef.current && audioRef.current.buffered.length > 0) {
      const bufferedEnd = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
      const currentTime = audioRef.current.currentTime;
      const bufferAhead = bufferedEnd - currentTime;
      
      // Adaptive buffer threshold based on AirPlay connection
      const bufferThreshold = getBufferAheadThreshold(airPlay.isConnected);
      
      if (bufferAhead < bufferThreshold) {
        if (bufferState !== 'buffering') {
          setBufferState('buffering');
          bufferingStartTimeRef.current = Date.now();
        }
      } else if (bufferState === 'buffering' && bufferAhead > bufferThreshold * 1.5) {
        setBufferState('stable');
        bufferingStartTimeRef.current = null;
        
        // Clear AirPlay buffering timeout
        if (airplayBufferingTimeoutRef.current) {
          clearTimeout(airplayBufferingTimeoutRef.current);
          airplayBufferingTimeoutRef.current = null;
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (airplayBufferingTimeoutRef.current) {
        clearTimeout(airplayBufferingTimeoutRef.current);
      }
    };
  }, []);

  // Amplified glow intensity for UI elements
  const uiGlowIntensity = audioData.isActive 
    ? 30 + audioData.bass * 80 + audioData.bassKick * 60
    : 20;

  const uiGlowColor = audioData.isActive
    ? `rgba(236, 72, 153, ${0.5 + audioData.bass * 0.6 + audioData.bassKick * 0.4})`
    : 'rgba(236, 72, 153, 0.5)';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* AirPlay Alert */}
      {showAirPlayAlert && airPlay.isConnected && (
        <AirPlayPlaybackAlert 
          onRetry={handleAirPlayRecovery}
          isRetrying={isAirPlayRetrying}
        />
      )}

      {/* Player Card - Highly transparent with gradient overlay */}
      <div 
        className="relative bg-gradient-to-br from-pink-900/10 to-purple-900/10 backdrop-blur-lg rounded-xl sm:rounded-2xl border-2 border-pink-500/50 shadow-xl shadow-pink-500/20 p-4 sm:p-6 md:p-8 audio-reactive-panel transition-all duration-200 overflow-hidden touch-manipulation"
        style={{
          boxShadow: audioData.isActive 
            ? `0 0 ${uiGlowIntensity}px ${uiGlowColor}, 0 0 ${uiGlowIntensity * 1.5}px ${uiGlowColor}`
            : undefined,
          pointerEvents: 'auto',
        }}
      >
        {/* Background GIF Overlay */}
        <BackgroundGifOverlay currentTrackTitle={currentTrack?.title} isPlaying={isPlaying} />

        <div 
          className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-pink-500/8 to-purple-500/8 audio-reactive-pulse transition-opacity duration-200"
          style={{
            opacity: audioData.isActive ? 0.3 + audioData.volume * 0.8 + audioData.bassKick * 0.3 : 0.2,
          }}
        />
        
        <div className="relative z-10 space-y-4 sm:space-y-6">
          {/* Header with Stream Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <h3 className="text-lg sm:text-xl font-bold text-pink-400 font-mono uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse flex-shrink-0" />
              Stream Monitor
            </h3>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <StreamStabilityIndicator state={bufferState} />
              <div className="text-xs sm:text-sm font-mono text-gray-300">
                Listeners: <span className="text-pink-400 font-bold">{listenerCount.toString()}</span>
              </div>
            </div>
          </div>

          {/* Playlist Selector */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-mono text-pink-400 uppercase tracking-wider">
              Select Channel
            </label>
            <Select value={selectedPlaylistId} onValueChange={handlePlaylistChange}>
              <SelectTrigger className="w-full bg-black/60 border-pink-500/50 text-white hover:border-pink-500 transition-colors audio-reactive-border h-10 sm:h-11 text-sm sm:text-base">
                <SelectValue placeholder="Choose a playlist" />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-pink-500/50">
                {playlists.map((playlist) => (
                  <SelectItem
                    key={playlist.id}
                    value={playlist.id}
                    className="text-white hover:bg-pink-500/30 focus:bg-pink-500/30"
                  >
                    {playlist.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Volume Normalization Toggle */}
          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-black/40 border border-pink-500/30">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400 flex-shrink-0" />
              <Label htmlFor="volume-norm-embedded" className="text-xs sm:text-sm font-mono text-pink-400 cursor-pointer">
                Auto Volume Normalization
              </Label>
            </div>
            <Switch
              id="volume-norm-embedded"
              checked={volumeNormalization}
              onCheckedChange={setVolumeNormalization}
              className="data-[state=checked]:bg-pink-500 scale-90 sm:scale-100"
            />
          </div>

          {/* Now Playing */}
          {currentTrack && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 space-y-2 w-full">
                  <p className="text-xs sm:text-sm font-mono text-pink-400/70 uppercase tracking-wider">
                    Now Playing
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-white truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-base sm:text-lg text-purple-400 truncate">
                    {currentTrack.artist}
                  </p>
                  {currentTrack.album && (
                    <p className="text-xs sm:text-sm text-gray-300 truncate">
                      {currentTrack.album}
                    </p>
                  )}
                </div>

                {/* Play Button */}
                <Button
                  onClick={handlePlayPause}
                  disabled={!currentTrack}
                  size="lg"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-xl shadow-pink-500/50 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed audio-reactive-button flex-shrink-0 touch-manipulation self-center sm:self-start"
                  style={{
                    boxShadow: audioData.isActive 
                      ? `0 0 ${40 + audioData.bass * 80 + audioData.bassKick * 60}px rgba(236, 72, 153, ${0.6 + audioData.bass * 0.6 + audioData.bassKick * 0.4})`
                      : undefined,
                    transform: audioData.isActive && audioData.bassKick > 0.5
                      ? `scale(${1.05 + audioData.bassKick * 0.1})`
                      : undefined,
                  }}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  ) : (
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
                  )}
                </Button>
              </div>

              {/* Play Count and AirPlay Control */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center justify-between text-xs sm:text-sm font-mono p-2.5 sm:p-3 rounded-lg bg-black/40 border border-pink-500/20 flex-1">
                  <span className="text-pink-400/70">Play Count:</span>
                  <span className="text-pink-400 font-bold">
                    {currentTrack.playCount.toString()}
                  </span>
                </div>

                {/* AirPlay Control */}
                <AirPlayControl
                  isSupported={airPlay.isSupported}
                  isAvailable={airPlay.isAvailable}
                  isConnected={airPlay.isConnected}
                  onShowPicker={airPlay.showPicker}
                  variant="compact"
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Track List */}
      {selectedPlaylist && selectedPlaylist.tracks.length > 0 && (
        <div 
          className="bg-black/30 backdrop-blur-md rounded-xl border border-pink-500/30 p-4 sm:p-6 audio-reactive-panel transition-all duration-200"
          style={{
            boxShadow: audioData.isActive 
              ? `0 0 ${uiGlowIntensity * 0.5}px rgba(236, 72, 153, ${0.3 + audioData.mid * 0.5})`
              : undefined,
          }}
        >
          <h3 className="text-base sm:text-lg font-mono text-pink-400 uppercase tracking-wider mb-3 sm:mb-4">
            Playlist Tracks ({selectedPlaylist.tracks.length})
          </h3>
          <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto pr-1 sm:pr-2">
            {selectedPlaylist.tracks.map((track, index) => (
              <div
                key={index}
                className={`p-2.5 sm:p-3 rounded-lg transition-all duration-200 ${
                  index === currentTrackIndex
                    ? 'bg-pink-500/30 border border-pink-500/50 audio-reactive-border'
                    : 'bg-white/5 hover:bg-white/10 active:bg-white/15'
                }`}
                style={
                  index === currentTrackIndex && audioData.isActive
                    ? {
                        boxShadow: `0 0 ${20 + audioData.bass * 40}px rgba(236, 72, 153, ${0.4 + audioData.bass * 0.5})`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-white truncate">{track.title}</p>
                    <p className="text-xs sm:text-sm text-gray-400 truncate">{track.artist}</p>
                  </div>
                  <div className="text-xs text-gray-500 font-mono flex-shrink-0">
                    {Math.floor(Number(track.duration) / 60)}:{String(Number(track.duration) % 60).padStart(2, '0')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleTrackEnd}
        onError={handlePlaybackError}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onProgress={handleProgress}
        crossOrigin="anonymous"
        preload="auto"
      />
    </div>
  );
}
