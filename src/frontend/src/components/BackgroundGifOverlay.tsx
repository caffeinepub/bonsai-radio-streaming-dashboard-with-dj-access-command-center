import { useEffect, useState, useRef } from 'react';
import { useGetBackgroundGifs, useGetBackgroundSettings } from '../hooks/useQueries';

interface BackgroundGifOverlayProps {
  currentTrackTitle?: string;
  isPlaying: boolean;
}

export default function BackgroundGifOverlay({ currentTrackTitle, isPlaying }: BackgroundGifOverlayProps) {
  const { data: gifs = [] } = useGetBackgroundGifs();
  const { data: settings } = useGetBackgroundSettings();
  const [currentGifUrl, setCurrentGifUrl] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousTrackRef = useRef<string>('');

  // Select random GIF when track changes
  useEffect(() => {
    if (!currentTrackTitle || !isPlaying || gifs.length === 0) {
      return;
    }

    // Only change GIF when track actually changes
    if (currentTrackTitle !== previousTrackRef.current) {
      previousTrackRef.current = currentTrackTitle;

      // Check if randomization is enabled
      if (settings?.randomizationEnabled === false) {
        return;
      }

      // Start fade out transition
      setIsTransitioning(true);

      // Select random GIF
      const randomIndex = Math.floor(Math.random() * gifs.length);
      const selectedGif = gifs[randomIndex];

      // Wait for fade out, then change GIF and fade in
      setTimeout(() => {
        setCurrentGifUrl(selectedGif[1].getDirectURL());
        setIsTransitioning(false);
      }, settings?.fadeDuration ? Number(settings.fadeDuration) / 2 : 1000);
    }
  }, [currentTrackTitle, isPlaying, gifs, settings]);

  // Initialize with first GIF if available
  useEffect(() => {
    if (gifs.length > 0 && !currentGifUrl && isPlaying) {
      setCurrentGifUrl(gifs[0][1].getDirectURL());
    }
  }, [gifs, currentGifUrl, isPlaying]);

  if (!currentGifUrl || !isPlaying || gifs.length === 0) {
    return null;
  }

  const transparency = settings?.transparency ? Number(settings.transparency) / 100 : 0.5;
  const fadeDuration = settings?.fadeDuration ? Number(settings.fadeDuration) : 2000;
  const animationIntensity = settings?.animationIntensity ? Number(settings.animationIntensity) : 3;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5] transition-opacity"
      style={{
        opacity: isTransitioning ? 0 : transparency,
        transitionDuration: `${fadeDuration}ms`,
      }}
    >
      <img
        src={currentGifUrl}
        alt="Background visual"
        className="w-full h-full object-cover"
        style={{
          mixBlendMode: 'screen',
          filter: `brightness(${0.8 + animationIntensity * 0.1}) contrast(${1 + animationIntensity * 0.05})`,
        }}
      />
    </div>
  );
}
