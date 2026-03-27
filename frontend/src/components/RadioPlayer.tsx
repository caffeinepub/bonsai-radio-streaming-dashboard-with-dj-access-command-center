import { useState, useRef, useEffect } from 'react';
import { useGetPlaylists, useGetListenerCount, useIncrementPlayCount, useStartListenerSession, useStopListenerSession } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Play, Pause, Users, Radio, Volume2 } from 'lucide-react';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import { useAirPlay } from '../hooks/useAirPlay';
import { useAirPlayPlaybackRecovery } from '../hooks/useAirPlayPlaybackRecovery';
import { getBufferingConfig, shouldAttemptRecovery, getBufferAheadThreshold } from '../utils/airplayBufferingStrategy';
import CyberpunkBackground from './CyberpunkBackground';
import StreamStabilityIndicator from './StreamStabilityIndicator';
import BackgroundGifOverlay from './BackgroundGifOverlay';
import AirPlayControl from './AirPlayControl';
import AirPlayPlaybackAlert from './AirPlayPlaybackAlert';
import type { Playlist, TrackRecord } from '../backend';

interface RadioPlayerProps {
  onDJAccessClick: () => void;
}

type BufferState = 'stable' | 'buffering' | 'error';

export default function RadioPlayer({ onDJAccessClick }: RadioPlayerProps) {
  const { data: playlists = [], isLoading: playlistsLoading } = useGetPlaylists();
  const { data: listenerCount = BigInt(0) } = useGetListenerCount();
  const incrementPlayCount = useIncrementPlayCount();
  const startSession = useStartListenerSession();
  const stopSession = useStopListenerSession();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [volumeNormalization, setVolumeNormalization] = useState(false);
  const [bufferState, setBufferState] = useState<BufferState>('stable');
  const [savedPosition, setSavedPosition] = useState(0);
  const [djButtonClicked, setDjButtonClicked] = useState(false);
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
      // Adaptive preload based on connection
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
      const targetLevel = 0.55; // Slightly higher normalized target
      
      if (currentLevel > 0.08) {
        const ratio = targetLevel / currentLevel;
        // Apply compression curve for more consistent loudness
        targetVolumeRef.current = Math.min(2.5, Math.pow(ratio, 0.8));
      }

      // Smoother interpolation for more stable transitions
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
      if (!hasSession) {
        try {
          await startSession.mutateAsync();
          setHasSession(true);
        } catch (error) {
          console.error('Failed to start session:', error);
        }
      }
      
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
      
      // Exponential backoff with jitter
      const backoffTime = Math.min(1000 * Math.pow(1.5, retryCountRef.current) + Math.random() * 500, 5000);
      
      retryTimeoutRef.current = setTimeout(() => {
        if (audioRef.current && currentTrack) {
          console.log(`Retry attempt ${retryCountRef.current}/${maxRetries}`);
          
          // Save current position
          const position = audioRef.current.currentTime;
          setSavedPosition(position);
          
          // Reload with smooth fade
          audioRef.current.volume = 0;
          const audioUrl = currentTrack.audioFile.getDirectURL();
          audioRef.current.src = audioUrl;
          audioRef.current.currentTime = position;
          
          audioRef.current.play()
            .then(() => {
              // Smooth fade in
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

  const handleDJAccessClick = () => {
    // Trigger visual feedback
    setDjButtonClicked(true);
    
    // Call parent handler to open modal
    onDJAccessClick();
    
    // Reset visual feedback after animation
    setTimeout(() => {
      setDjButtonClicked(false);
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (hasSession) {
        stopSession.mutate();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (airplayBufferingTimeoutRef.current) {
        clearTimeout(airplayBufferingTimeoutRef.current);
      }
    };
  }, [hasSession]);

  // Amplified glow intensity for UI elements
  const uiGlowIntensity = audioData.isActive 
    ? 30 + audioData.bass * 80 + audioData.bassKick * 60
    : 20;

  const uiGlowColor = audioData.isActive
    ? `rgba(168, 85, 247, ${0.5 + audioData.bass * 0.6 + audioData.bassKick * 0.4})`
    : 'rgba(168, 85, 247, 0.5)';

  // Audio-reactive text glow
  const getTextGlowStyle = (baseIntensity: number = 1) => {
    if (!audioData.isActive) return {};
    
    const intensity = baseIntensity * (8 + audioData.bass * 12 + audioData.bassKick * 8);
    const brightness = 1 + audioData.volume * 0.3 + audioData.bassKick * 0.2;
    
    return {
      textShadow: `
        0 0 ${intensity}px rgba(34, 211, 238, ${0.6 + audioData.bass * 0.4}),
        0 0 ${intensity * 2}px rgba(168, 85, 247, ${0.4 + audioData.mid * 0.3}),
        0 0 ${intensity * 3}px rgba(236, 72, 153, ${0.3 + audioData.bassKick * 0.4})
      `,
      filter: `brightness(${brightness})`,
    };
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Cyberpunk Background with Enhanced Audio Reactivity */}
      <CyberpunkBackground audioData={audioData} isPlaying={isPlaying} />

      {/* Background GIF Overlay */}
      <BackgroundGifOverlay currentTrackTitle={currentTrack?.title} isPlaying={isPlaying} />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header 
          className="border-b border-neon-purple/30 bg-black/40 backdrop-blur-md audio-reactive-glow transition-all duration-200"
          style={{
            boxShadow: audioData.isActive 
              ? `0 4px ${uiGlowIntensity}px ${uiGlowColor}`
              : undefined,
          }}
        >
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <img
                src="/assets/generated/bonsai-radio-logo-transparent.dim_200x200.png"
                alt="Bonsai Radio"
                className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0"
              />
              <h1 
                className="text-lg sm:text-2xl font-bold text-neon-cyan tracking-wider font-mono text-glow-shift truncate"
                style={audioData.isActive ? getTextGlowStyle(1.2) : {}}
              >
                BONSAI RADIO
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <StreamStabilityIndicator state={bufferState} />
              <div 
                className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-neon-purple/20 border border-neon-purple/50 audio-reactive-border transition-all duration-200"
                style={{
                  boxShadow: audioData.isActive 
                    ? `0 0 ${uiGlowIntensity * 0.5}px ${uiGlowColor}`
                    : undefined,
                }}
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-neon-purple animate-pulse" />
                <span 
                  className="text-sm sm:text-base text-neon-purple font-mono font-bold text-glow-pulse"
                  style={audioData.isActive ? getTextGlowStyle(0.8) : {}}
                >
                  {listenerCount.toString()}
                </span>
              </div>
              <Button
                onClick={handleDJAccessClick}
                className={`bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-3 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base rounded-full shadow-lg shadow-green-500/50 transition-all duration-300 hover:shadow-green-500/80 hover:scale-105 active:scale-95 ${
                  djButtonClicked ? 'dj-access-pulse' : ''
                }`}
              >
                <span className="text-glow-pulse">DJ ACCESS</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Player */}
        <main className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8">
          <div className="w-full max-w-2xl space-y-4">
            {/* AirPlay Alert */}
            {showAirPlayAlert && airPlay.isConnected && (
              <AirPlayPlaybackAlert 
                onRetry={handleAirPlayRecovery}
                isRetrying={isAirPlayRetrying}
              />
            )}

            {/* Player Card - Highly transparent with gradient overlay */}
            <div 
              className="relative bg-gradient-to-br from-purple-900/10 to-blue-900/10 backdrop-blur-lg rounded-2xl sm:rounded-3xl border-2 border-neon-purple/50 shadow-2xl shadow-neon-purple/30 p-4 sm:p-6 md:p-8 audio-reactive-panel transition-all duration-200 touch-manipulation"
              style={{
                boxShadow: audioData.isActive 
                  ? `0 0 ${uiGlowIntensity}px ${uiGlowColor}, 0 0 ${uiGlowIntensity * 1.5}px ${uiGlowColor}`
                  : undefined,
                pointerEvents: 'auto',
              }}
            >
              <div 
                className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-neon-purple/8 to-neon-cyan/8 audio-reactive-pulse transition-opacity duration-200"
                style={{
                  opacity: audioData.isActive ? 0.3 + audioData.volume * 0.8 + audioData.bassKick * 0.3 : 0.2,
                }}
              />
              
              <div className="relative z-10 space-y-4 sm:space-y-6">
                {/* Playlist Selector */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-mono text-neon-cyan uppercase tracking-wider text-shimmer">
                    Select Channel
                  </label>
                  <Select value={selectedPlaylistId} onValueChange={handlePlaylistChange}>
                    <SelectTrigger className="w-full bg-black/60 border-neon-cyan/50 text-white hover:border-neon-cyan transition-colors audio-reactive-border h-10 sm:h-11 text-sm sm:text-base">
                      <SelectValue placeholder="Choose a playlist" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-neon-cyan/50">
                      {playlists.map((playlist) => (
                        <SelectItem
                          key={playlist.id}
                          value={playlist.id}
                          className="text-white hover:bg-neon-purple/30 focus:bg-neon-purple/30"
                        >
                          <span className="text-glow-static">{playlist.id}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Volume Normalization Toggle */}
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-black/40 border border-neon-cyan/30">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neon-cyan flex-shrink-0" />
                    <Label htmlFor="volume-norm" className="text-xs sm:text-sm font-mono text-neon-cyan cursor-pointer text-shimmer">
                      Auto Volume Normalization
                    </Label>
                  </div>
                  <Switch
                    id="volume-norm"
                    checked={volumeNormalization}
                    onCheckedChange={setVolumeNormalization}
                    className="data-[state=checked]:bg-neon-cyan scale-90 sm:scale-100"
                  />
                </div>

                {/* Now Playing */}
                {currentTrack && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-neon-cyan animate-pulse flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-mono text-neon-cyan/70 uppercase tracking-wider text-shimmer">
                          Now Playing
                        </p>
                        <p 
                          className="text-lg sm:text-xl font-bold text-white truncate text-glow-reactive"
                          style={audioData.isActive ? getTextGlowStyle(1) : {}}
                        >
                          {currentTrack.title}
                        </p>
                        <p 
                          className="text-base sm:text-lg text-neon-purple truncate text-glow-reactive"
                          style={audioData.isActive ? getTextGlowStyle(0.9) : {}}
                        >
                          {currentTrack.artist}
                        </p>
                        {currentTrack.album && (
                          <p className="text-xs sm:text-sm text-gray-300 truncate text-shimmer">
                            {currentTrack.album}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Play Count */}
                    <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
                      <span className="text-neon-cyan/70 text-shimmer">Play Count:</span>
                      <span 
                        className="text-neon-purple font-bold text-glow-pulse"
                        style={audioData.isActive ? getTextGlowStyle(0.7) : {}}
                      >
                        {currentTrack.playCount.toString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Play Button and AirPlay Control */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
                  <Button
                    onClick={handlePlayPause}
                    disabled={!currentTrack}
                    size="lg"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-neon-purple to-neon-cyan hover:from-neon-purple/80 hover:to-neon-cyan/80 shadow-2xl shadow-neon-purple/50 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed audio-reactive-button touch-manipulation"
                    style={{
                      boxShadow: audioData.isActive 
                        ? `0 0 ${40 + audioData.bass * 80 + audioData.bassKick * 60}px rgba(168, 85, 247, ${0.6 + audioData.bass * 0.6 + audioData.bassKick * 0.4})`
                        : undefined,
                      transform: audioData.isActive && audioData.bassKick > 0.5
                        ? `scale(${1.05 + audioData.bassKick * 0.1})`
                        : undefined,
                    }}
                  >
                    {isPlaying ? (
                      <Pause className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                    ) : (
                      <Play className="w-10 h-10 sm:w-12 sm:h-12 text-white ml-1" />
                    )}
                  </Button>

                  {/* AirPlay Control */}
                  <AirPlayControl
                    isSupported={airPlay.isSupported}
                    isAvailable={airPlay.isAvailable}
                    isConnected={airPlay.isConnected}
                    onShowPicker={airPlay.showPicker}
                    variant="default"
                  />
                </div>
              </div>
            </div>

            {/* Track List */}
            {selectedPlaylist && selectedPlaylist.tracks.length > 0 && (
              <div 
                className="bg-black/30 backdrop-blur-md rounded-xl sm:rounded-2xl border border-neon-cyan/30 p-4 sm:p-6 audio-reactive-panel transition-all duration-200"
                style={{
                  boxShadow: audioData.isActive 
                    ? `0 0 ${uiGlowIntensity * 0.5}px rgba(34, 211, 238, ${0.3 + audioData.mid * 0.5})`
                    : undefined,
                }}
              >
                <h3 className="text-base sm:text-lg font-mono text-neon-cyan uppercase tracking-wider mb-3 sm:mb-4 text-glow-shift">
                  Playlist Tracks
                </h3>
                <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                  {selectedPlaylist.tracks.map((track, index) => (
                    <div
                      key={index}
                      className={`p-2.5 sm:p-3 rounded-lg transition-all duration-200 ${
                        index === currentTrackIndex
                          ? 'bg-neon-purple/30 border border-neon-purple/50 audio-reactive-border'
                          : 'bg-white/5 hover:bg-white/10 active:bg-white/15'
                      }`}
                      style={
                        index === currentTrackIndex && audioData.isActive
                          ? {
                              boxShadow: `0 0 ${20 + audioData.bass * 40}px rgba(168, 85, 247, ${0.4 + audioData.bass * 0.5})`,
                            }
                          : undefined
                      }
                    >
                      <p 
                        className={`text-sm sm:text-base font-semibold text-white truncate ${
                          index === currentTrackIndex ? 'text-glow-reactive' : 'text-shimmer'
                        }`}
                        style={
                          index === currentTrackIndex && audioData.isActive
                            ? getTextGlowStyle(0.8)
                            : undefined
                        }
                      >
                        {track.title}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-400 truncate text-shimmer">{track.artist}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-neon-purple/30 bg-black/40 backdrop-blur-md py-4 sm:py-6">
          <div className="container mx-auto px-3 sm:px-4 text-center">
            <p className="text-xs sm:text-sm text-gray-400 text-shimmer">
              © 2026. Built with <span className="text-red-500">♥</span> using{' '}
              <a
                href="https://caffeine.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-cyan hover:text-neon-purple transition-colors text-glow-pulse"
              >
                caffeine.ai
              </a>
            </p>
          </div>
        </footer>
      </div>

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
