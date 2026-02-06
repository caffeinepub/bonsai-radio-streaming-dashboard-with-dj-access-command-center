import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Airplay } from 'lucide-react';

interface AirPlayControlProps {
  isSupported: boolean;
  isAvailable: boolean;
  isConnected: boolean;
  onShowPicker: () => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export default function AirPlayControl({
  isSupported,
  isAvailable,
  isConnected,
  onShowPicker,
  variant = 'default',
  className = '',
}: AirPlayControlProps) {
  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  const buttonSize = variant === 'compact' ? 'sm' : 'default';
  const iconSize = variant === 'compact' ? 'w-4 h-4' : 'w-5 h-5';

  const buttonContent = (
    <Button
      onClick={onShowPicker}
      disabled={!isAvailable}
      size={buttonSize}
      variant="outline"
      className={`${
        isConnected
          ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30'
          : 'bg-black/40 border-neon-purple/30 text-white hover:bg-black/60'
      } transition-all duration-200 ${className}`}
      aria-label="AirPlay"
    >
      <Airplay className={`${iconSize} ${isConnected ? 'animate-pulse' : ''}`} />
      {variant === 'default' && (
        <span className="ml-2 font-mono text-xs sm:text-sm">
          {isConnected ? 'Connected' : 'AirPlay'}
        </span>
      )}
    </Button>
  );

  // Show tooltip for unavailable state
  if (!isAvailable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">AirPlay is available in Safari on Apple devices</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}
