import { useState, useEffect } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useIsCallerAdmin } from './hooks/useQueries';
import RadioPlayer from './components/RadioPlayer';
import DJAuthModal from './components/DJAuthModal';
import DJDashboard from './components/DJDashboard';
import LoadingScreen from './components/LoadingScreen';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { useActor } from './hooks/useActor';
import { ExternalBlob } from './backend';

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsCallerAdmin();
  const { actor } = useActor();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasInitializedGifs, setHasInitializedGifs] = useState(false);

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  // Initialize default GIFs on first load
  useEffect(() => {
    const initializeDefaultGifs = async () => {
      if (!actor || hasInitializedGifs || !isAuthenticated || !isAdmin) return;

      try {
        // Create default GIF entries from assets
        const defaultGifs: Array<[string, ExternalBlob]> = [
          ['default-1', ExternalBlob.fromURL('/assets/generated/cyberpunk-geometric-pulse.dim_800x600.gif')],
          ['default-2', ExternalBlob.fromURL('/assets/generated/data-stream-flow.dim_800x600.gif')],
          ['default-3', ExternalBlob.fromURL('/assets/generated/neon-circuit-pulse.dim_800x600.gif')],
          ['default-4', ExternalBlob.fromURL('/assets/generated/holographic-morph.dim_800x600.gif')],
          ['default-5', ExternalBlob.fromURL('/assets/generated/neural-network-pulse.dim_800x600.gif')],
        ];

        await actor.initializeDefaultGifs(defaultGifs);
        setHasInitializedGifs(true);
        console.log('Default GIFs initialized successfully');
      } catch (error) {
        console.error('Failed to initialize default GIFs:', error);
      }
    };

    initializeDefaultGifs();
  }, [actor, hasInitializedGifs, isAuthenticated, isAdmin]);

  // Automatic session restoration with smooth transition
  useEffect(() => {
    if (isAuthenticated && isAdmin && !showDashboard && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setShowDashboard(true);
        setIsTransitioning(false);
      }, 300);
    }
  }, [isAuthenticated, isAdmin, showDashboard, isTransitioning]);

  // Handle logout - return to main player
  useEffect(() => {
    if (!isAuthenticated && showDashboard) {
      setIsTransitioning(true);
      setTimeout(() => {
        setShowDashboard(false);
        setIsTransitioning(false);
      }, 300);
    }
  }, [isAuthenticated, showDashboard]);

  // Handle modal close and check if authentication succeeded
  useEffect(() => {
    if (!showAuthModal && isAuthenticated && isAdmin && !showDashboard) {
      // Modal closed and user is authenticated, transition to dashboard
      setIsTransitioning(true);
      setTimeout(() => {
        setShowDashboard(true);
        setIsTransitioning(false);
      }, 300);
    }
  }, [showAuthModal, isAuthenticated, isAdmin, showDashboard]);

  const handleDJAccessClick = () => {
    if (isAuthenticated && isAdmin) {
      // Already authenticated, go directly to dashboard
      setIsTransitioning(true);
      setTimeout(() => {
        setShowDashboard(true);
        setIsTransitioning(false);
      }, 300);
    } else {
      // Show authentication modal
      setShowAuthModal(true);
    }
  };

  const handleAuthModalChange = (open: boolean) => {
    setShowAuthModal(open);
  };

  if (isInitializing || (isAuthenticated && isAdminLoading)) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <div className="min-h-screen bg-black">
        {isTransitioning ? (
          <LoadingScreen />
        ) : showDashboard ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DJDashboard />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <RadioPlayer onDJAccessClick={handleDJAccessClick} />
          </div>
        )}

        <DJAuthModal
          open={showAuthModal}
          onOpenChange={handleAuthModalChange}
        />

        <Toaster position="top-right" />
      </div>
    </ThemeProvider>
  );
}
