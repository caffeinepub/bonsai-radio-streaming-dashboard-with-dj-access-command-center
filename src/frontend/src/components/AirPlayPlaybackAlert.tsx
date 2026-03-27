import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface AirPlayPlaybackAlertProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export default function AirPlayPlaybackAlert({
  onRetry,
  isRetrying = false,
}: AirPlayPlaybackAlertProps) {
  return (
    <Alert className="bg-yellow-900/20 border-yellow-500/50 backdrop-blur-sm">
      <AlertCircle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-500 font-mono text-sm">
        AirPlay Connection Issue
      </AlertTitle>
      <AlertDescription className="text-yellow-200/90 text-xs mt-2 space-y-3">
        <p>
          Audio playback through AirPlay is experiencing difficulties. This can
          happen due to network conditions or device connectivity.
        </p>
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          size="sm"
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-mono text-xs"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3 mr-2" />
              Retry AirPlay Connection
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
