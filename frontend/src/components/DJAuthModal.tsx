import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface DJAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DJAuthModal({ open, onOpenChange }: DJAuthModalProps) {
  const { login, loginStatus, identity, loginError } = useInternetIdentity();
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  const isLoggingIn = loginStatus === 'logging-in';
  const isSuccess = loginStatus === 'success';
  const isError = loginStatus === 'loginError';

  // Check for existing session when modal opens
  useEffect(() => {
    if (open && !hasAttemptedLogin) {
      setIsCheckingSession(true);
      
      // Check if user is already authenticated
      if (identity && !identity.getPrincipal().isAnonymous()) {
        // User is already authenticated, transition to dashboard
        toast.success('Session Active', {
          description: 'Redirecting to DJ Command Center...',
          duration: 2000,
        });
        
        // Close modal after brief delay to show success message
        setTimeout(() => {
          onOpenChange(false);
          setIsCheckingSession(false);
        }, 1500);
      } else {
        // No active session, ready for login
        setIsCheckingSession(false);
      }
    }
  }, [open, identity, hasAttemptedLogin]);

  // Handle successful login with smooth transition
  useEffect(() => {
    if (isSuccess && identity && !identity.getPrincipal().isAnonymous() && hasAttemptedLogin) {
      toast.success('Authentication Successful', {
        description: 'Welcome to the DJ Command Center!',
        duration: 3000,
      });
      
      // Close modal after brief delay for smooth transition
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    }
  }, [isSuccess, identity, hasAttemptedLogin, onOpenChange]);

  // Handle login errors with toast notifications
  useEffect(() => {
    if (isError && loginError && hasAttemptedLogin) {
      toast.error('Authentication Failed', {
        description: loginError.message || 'Failed to authenticate with Internet Identity',
        duration: 5000,
      });
    }
  }, [isError, loginError, hasAttemptedLogin]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setHasAttemptedLogin(false);
      setIsCheckingSession(false);
    }
  }, [open]);

  const handleLogin = async () => {
    try {
      setHasAttemptedLogin(true);
      await login();
    } catch (error: any) {
      console.error('Login initiation error:', error);
      toast.error('Login Error', {
        description: 'Failed to initiate login. Please try again.',
        duration: 5000,
      });
      setHasAttemptedLogin(false);
    }
  };

  const handleRetry = () => {
    setHasAttemptedLogin(false);
    handleLogin();
  };

  const handleCancel = () => {
    setHasAttemptedLogin(false);
    onOpenChange(false);
  };

  // Show checking session state
  if (isCheckingSession) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-neon-purple/50 text-white transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-neon-cyan font-mono text-glow-shift">
              DJ ACCESS AUTHENTICATION
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-shimmer">
              Checking for active session...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-black/40 rounded-lg border border-neon-cyan/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-neon-purple/50 text-white transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-neon-cyan font-mono text-glow-shift">
            DJ ACCESS AUTHENTICATION
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-shimmer">
            Authenticate with Internet Identity to access the DJ Command Center
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="p-4 bg-black/40 rounded-lg border border-neon-cyan/30">
            <p className="text-sm text-gray-300 mb-2 text-shimmer">
              Only authorized DJs can access the command center to manage playlists and upload tracks.
            </p>
            {isError && loginError && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-300 text-glow-pulse">Authentication Error</p>
                  <p className="text-xs text-red-200 mt-1">{loginError.message}</p>
                </div>
              </div>
            )}
            {isSuccess && identity && !identity.getPrincipal().isAnonymous() && (
              <div className="mt-3 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-300 text-glow-pulse">Authentication Successful</p>
                  <p className="text-xs text-green-200 mt-1">Redirecting to DJ Dashboard...</p>
                </div>
              </div>
            )}
          </div>
          
          {isError ? (
            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-neon-purple to-neon-cyan hover:from-neon-purple/80 hover:to-neon-cyan/80 text-white font-bold py-3 rounded-lg shadow-lg shadow-neon-purple/50 transition-all duration-300"
              >
                <span className="text-glow-pulse">Retry Authentication</span>
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="w-full border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
              >
                <span className="text-shimmer">Cancel</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleLogin}
                disabled={isLoggingIn || isSuccess}
                className="w-full bg-gradient-to-r from-neon-purple to-neon-cyan hover:from-neon-purple/80 hover:to-neon-cyan/80 text-white font-bold py-3 rounded-lg shadow-lg shadow-neon-purple/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span className="text-glow-pulse">Authenticating...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    <span className="text-glow-pulse">Authenticated</span>
                  </>
                ) : (
                  <span className="text-glow-pulse">Authenticate with Internet Identity</span>
                )}
              </Button>
              {!isLoggingIn && !isSuccess && (
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="w-full border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
                >
                  <span className="text-shimmer">Cancel</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
