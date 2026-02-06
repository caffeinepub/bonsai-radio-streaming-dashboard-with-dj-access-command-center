import { useEffect, useRef, useState } from 'react';

interface AudioAnalyzerData {
  volume: number;
  bass: number;
  mid: number;
  high: number;
  isActive: boolean;
  bassKick: number;
  spectralCentroid: number;
}

export function useAudioAnalyzer(audioElement: HTMLAudioElement | null, isPlaying: boolean) {
  const [audioData, setAudioData] = useState<AudioAnalyzerData>({
    volume: 0,
    bass: 0,
    mid: 0,
    high: 0,
    isActive: false,
    bassKick: 0,
    spectralCentroid: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const previousBassRef = useRef<number>(0);
  const bassHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    if (!audioElement) return;

    const initAudioContext = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyzerRef.current = audioContextRef.current.createAnalyser();
          // Enhanced FFT size for better frequency resolution
          analyzerRef.current.fftSize = 2048;
          // Reduced smoothing for more responsive visuals
          analyzerRef.current.smoothingTimeConstant = 0.7;
        }

        // Only create source once
        if (!sourceRef.current && audioContextRef.current) {
          try {
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
            sourceRef.current.connect(analyzerRef.current!);
            analyzerRef.current!.connect(audioContextRef.current.destination);
          } catch (error) {
            // Source already exists, reconnect analyzer
            if (analyzerRef.current && audioContextRef.current) {
              analyzerRef.current.connect(audioContextRef.current.destination);
            }
          }
        }

        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }
    };

    const analyze = (timestamp: number) => {
      if (!analyzerRef.current) return;

      // Adaptive throttling based on device and visibility
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const throttleInterval = 
        !isPlaying ? 200 :
        document.hidden ? 100 :
        isMobile ? 33 : // ~30fps on mobile
        16; // ~60fps on desktop
      
      if (timestamp - lastUpdateTimeRef.current < throttleInterval) {
        animationFrameRef.current = requestAnimationFrame(analyze);
        return;
      }
      lastUpdateTimeRef.current = timestamp;

      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzerRef.current.getByteFrequencyData(dataArray);

      // Enhanced frequency band analysis with more granular ranges
      const subBassEnd = Math.floor(bufferLength * 0.05); // 0-60Hz
      const bassEnd = Math.floor(bufferLength * 0.15); // 60-250Hz
      const lowMidEnd = Math.floor(bufferLength * 0.3); // 250-500Hz
      const midEnd = Math.floor(bufferLength * 0.5); // 500-2kHz
      const highMidEnd = Math.floor(bufferLength * 0.7); // 2k-4kHz

      let subBassSum = 0;
      let bassSum = 0;
      let lowMidSum = 0;
      let midSum = 0;
      let highMidSum = 0;
      let highSum = 0;
      let totalSum = 0;
      let weightedFreqSum = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i] / 255;
        totalSum += value;
        weightedFreqSum += value * i;

        if (i < subBassEnd) {
          subBassSum += value;
        } else if (i < bassEnd) {
          bassSum += value;
        } else if (i < lowMidEnd) {
          lowMidSum += value;
        } else if (i < midEnd) {
          midSum += value;
        } else if (i < highMidEnd) {
          highMidSum += value;
        } else {
          highSum += value;
        }
      }

      const volume = totalSum / bufferLength;
      const subBass = subBassSum / subBassEnd;
      const bass = (bassSum / (bassEnd - subBassEnd) + subBass) / 2; // Combined bass
      const lowMid = lowMidSum / (lowMidEnd - bassEnd);
      const mid = (midSum / (midEnd - lowMidEnd) + lowMid) / 2;
      const highMid = highMidSum / (highMidEnd - midEnd);
      const high = (highSum / (bufferLength - highMidEnd) + highMid) / 2;

      // Calculate spectral centroid (brightness of sound)
      const spectralCentroid = totalSum > 0 ? weightedFreqSum / (totalSum * bufferLength) : 0;

      // Detect bass kicks (sudden bass increases)
      bassHistoryRef.current.push(bass);
      if (bassHistoryRef.current.length > 5) {
        bassHistoryRef.current.shift();
      }
      
      const avgBass = bassHistoryRef.current.reduce((a, b) => a + b, 0) / bassHistoryRef.current.length;
      const bassKick = Math.max(0, (bass - avgBass) * 3);
      previousBassRef.current = bass;

      setAudioData({
        volume: Math.pow(volume, 0.8), // Slight compression for better visual range
        bass: Math.pow(bass, 0.7), // Amplified bass response
        mid: Math.pow(mid, 0.8),
        high: Math.pow(high, 0.9),
        isActive: volume > 0.005, // Lower threshold for better sensitivity
        bassKick: Math.min(1, bassKick),
        spectralCentroid,
      });

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    const handlePlay = () => {
      initAudioContext();
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(analyze);
      }
    };

    const handlePause = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAudioData({
        volume: 0,
        bass: 0,
        mid: 0,
        high: 0,
        isActive: false,
        bassKick: 0,
        spectralCentroid: 0,
      });
      bassHistoryRef.current = [];
    };

    const handleVisibilityChange = () => {
      // Reduce processing when tab is hidden
      if (document.hidden && animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(analyze);
      }
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handlePause);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handlePause);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioElement, isPlaying]);

  return audioData;
}
