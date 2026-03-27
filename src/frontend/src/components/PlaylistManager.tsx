import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Library, List, Plus, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { useGetPlaylists } from "../hooks/useQueries";
import BackgroundVisualsManager from "./BackgroundVisualsManager";
import CreatePlaylistForm from "./CreatePlaylistForm";
import EmbeddedMusicPlayer from "./EmbeddedMusicPlayer";
import MediaLibrary from "./MediaLibrary";
import PlaylistList from "./PlaylistList";

const TAB_STORAGE_KEY = "dj-dashboard-active-tab";

export default function PlaylistManager() {
  const { data: playlists = [] } = useGetPlaylists();
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Load saved tab from localStorage
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return saved || "create";
  });

  // Persist tab selection to localStorage
  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl rounded-xl sm:rounded-2xl border-2 border-neon-purple/50 shadow-2xl shadow-neon-purple/30 p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-2xl font-bold text-neon-cyan font-mono uppercase tracking-wider text-glow-shift truncate">
            DJ Control Panel
          </h2>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-black/50 gap-1 h-auto p-1">
            <TabsTrigger
              value="create"
              className="data-[state=active]:bg-neon-purple/30 data-[state=active]:text-neon-cyan text-xs sm:text-sm py-2 sm:py-2.5"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="text-shimmer hidden sm:inline">
                Create Playlist
              </span>
              <span className="text-shimmer sm:hidden">Create</span>
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="data-[state=active]:bg-neon-cyan/30 data-[state=active]:text-neon-purple text-xs sm:text-sm py-2 sm:py-2.5"
            >
              <List className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="text-shimmer hidden sm:inline">
                View Playlists ({playlists.length})
              </span>
              <span className="text-shimmer sm:hidden">
                List ({playlists.length})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="library"
              className="data-[state=active]:bg-green-500/30 data-[state=active]:text-green-400 text-xs sm:text-sm py-2 sm:py-2.5"
            >
              <Library className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="text-shimmer hidden sm:inline">
                Media Library
              </span>
              <span className="text-shimmer sm:hidden">Library</span>
            </TabsTrigger>
            <TabsTrigger
              value="player"
              className="data-[state=active]:bg-pink-500/30 data-[state=active]:text-pink-400 text-xs sm:text-sm py-2 sm:py-2.5"
            >
              <Radio className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="text-shimmer hidden sm:inline">
                Music Player
              </span>
              <span className="text-shimmer sm:hidden">Player</span>
            </TabsTrigger>
            <TabsTrigger
              value="visuals"
              className="data-[state=active]:bg-orange-500/30 data-[state=active]:text-orange-400 text-xs sm:text-sm py-2 sm:py-2.5 col-span-2 sm:col-span-1"
            >
              <Image className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="text-shimmer hidden sm:inline">
                Background Visuals
              </span>
              <span className="text-shimmer sm:hidden">Visuals</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4 sm:mt-6">
            <CreatePlaylistForm />
          </TabsContent>

          <TabsContent value="list" className="mt-4 sm:mt-6">
            <PlaylistList playlists={playlists} />
          </TabsContent>

          <TabsContent value="library" className="mt-4 sm:mt-6">
            <MediaLibrary />
          </TabsContent>

          <TabsContent value="player" className="mt-4 sm:mt-6">
            <EmbeddedMusicPlayer />
          </TabsContent>

          <TabsContent value="visuals" className="mt-4 sm:mt-6">
            <BackgroundVisualsManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
