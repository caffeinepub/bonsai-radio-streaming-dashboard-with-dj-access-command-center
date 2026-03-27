import { Activity } from 'lucide-react';

interface StreamStabilityIndicatorProps {
  state: 'stable' | 'buffering' | 'error';
}

export default function StreamStabilityIndicator({ state }: StreamStabilityIndicatorProps) {
  const getColor = () => {
    switch (state) {
      case 'stable':
        return 'text-green-500';
      case 'buffering':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
    }
  };

  const getGlow = () => {
    switch (state) {
      case 'stable':
        return 'shadow-green-500/50';
      case 'buffering':
        return 'shadow-yellow-500/50';
      case 'error':
        return 'shadow-red-500/50';
    }
  };

  const getLabel = () => {
    switch (state) {
      case 'stable':
        return 'Stable';
      case 'buffering':
        return 'Buffering';
      case 'error':
        return 'Error';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 border border-white/20 backdrop-blur-sm">
      <Activity 
        className={`w-4 h-4 ${getColor()} ${state === 'buffering' ? 'animate-pulse' : ''}`}
        style={{
          filter: `drop-shadow(0 0 4px currentColor)`,
        }}
      />
      <span className={`text-xs font-mono font-bold ${getColor()}`}>
        {getLabel()}
      </span>
    </div>
  );
}
