import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Database, LogOut, Music, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useGetMediaLibrary,
  useGetPlaylists,
  useIsCallerAdmin,
} from "../hooks/useQueries";
import CyberpunkBackground from "./CyberpunkBackground";
import PlaylistManager from "./PlaylistManager";

export default function DJDashboard() {
  const { identity, clear } = useInternetIdentity();
  const { data: playlists = [] } = useGetPlaylists();
  const { data: mediaLibrary = [] } = useGetMediaLibrary();
  const { data: isAdmin } = useIsCallerAdmin();
  const queryClient = useQueryClient();
  const [djName, setDjName] = useState<string>("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get DJ name from identity
  useEffect(() => {
    if (identity) {
      const principal = identity.getPrincipal().toString();
      // Use first 8 chars of principal as DJ identifier
      setDjName(`DJ-${principal.slice(0, 8)}`);
    }
  }, [identity]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      // Clear all cached data first
      queryClient.clear();

      // Clear Internet Identity session
      await clear();

      toast.success("Logged out successfully", {
        description: "Returning to main player...",
        duration: 3000,
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout", {
        description: "Please try again",
        duration: 5000,
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Verify admin access
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-blue-900 p-4">
        <div className="text-center p-6 sm:p-8 bg-black/40 backdrop-blur-xl rounded-2xl border-2 border-red-500/50 animate-in fade-in slide-in-from-bottom-4 max-w-md w-full">
          <h2 className="text-xl sm:text-2xl font-bold text-red-400 mb-4 text-glow-pulse">
            Access Denied
          </h2>
          <p className="text-sm sm:text-base text-gray-300 mb-6 text-shimmer">
            You do not have DJ permissions.
          </p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-red-500/50 text-red-400 w-full sm:w-auto"
            disabled={isLoggingOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="text-glow-pulse">
              {isLoggingOut ? "Logging out..." : "Logout"}
            </span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden animate-in fade-in duration-500">
      {/* Static Cyberpunk Background (no audio reactivity in dashboard) */}
      <CyberpunkBackground
        audioData={{
          volume: 0,
          bass: 0,
          mid: 0,
          high: 0,
          isActive: false,
          bassKick: 0,
          spectralCentroid: 0,
        }}
        isPlaying={false}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-neon-purple/30 bg-black/40 backdrop-blur-md animate-in slide-in-from-top duration-500">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <img
                src="/assets/generated/bonsai-radio-logo-transparent.dim_200x200.png"
                alt="Bonsai Radio"
                className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-neon-cyan tracking-wider font-mono text-glow-shift truncate">
                  DJ COMMAND CENTER
                </h1>
                <p className="text-xs sm:text-sm text-neon-purple font-mono text-glow-pulse truncate">
                  Welcome, {djName}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-50 transition-all duration-300 w-full sm:w-auto"
              disabled={isLoggingOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="text-glow-pulse">
                {isLoggingOut ? "Logging out..." : "Logout"}
              </span>
            </Button>
          </div>
        </header>

        {/* Stats Panel */}
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 animate-in slide-in-from-bottom duration-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl rounded-xl border border-neon-purple/50 p-4 sm:p-6 shadow-lg shadow-neon-purple/20 transition-all duration-300 hover:scale-105 hover:shadow-neon-purple/40">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-neon-purple/20 rounded-lg flex-shrink-0">
                  <Music className="w-6 h-6 sm:w-8 sm:h-8 text-neon-purple" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-400 font-mono uppercase text-shimmer">
                    Total Playlists
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-neon-cyan text-glow-pulse truncate">
                    {playlists.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl rounded-xl border border-neon-cyan/50 p-4 sm:p-6 shadow-lg shadow-neon-cyan/20 transition-all duration-300 hover:scale-105 hover:shadow-neon-cyan/40">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-neon-cyan/20 rounded-lg flex-shrink-0">
                  <Database className="w-6 h-6 sm:w-8 sm:h-8 text-neon-cyan" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-400 font-mono uppercase text-shimmer">
                    Media Library
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-neon-purple text-glow-pulse truncate">
                    {mediaLibrary.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl rounded-xl border border-green-500/50 p-4 sm:p-6 shadow-lg shadow-green-500/20 transition-all duration-300 hover:scale-105 hover:shadow-green-500/40 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-green-500/20 rounded-lg flex-shrink-0">
                  <Users className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-gray-400 font-mono uppercase text-shimmer">
                    Total Tracks
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-400 text-glow-pulse truncate">
                    {playlists.reduce((sum, p) => sum + p.tracks.length, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6 animate-in fade-in duration-1000">
          <PlaylistManager />
        </main>

        {/* Footer */}
        <footer className="border-t border-neon-purple/30 bg-black/40 backdrop-blur-md py-4 sm:py-6">
          <div className="container mx-auto px-3 sm:px-4 text-center">
            <p className="text-xs sm:text-sm text-gray-400 text-shimmer">
              © 2025. Built with <span className="text-red-500">♥</span> using{" "}
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
    </div>
  );
}
