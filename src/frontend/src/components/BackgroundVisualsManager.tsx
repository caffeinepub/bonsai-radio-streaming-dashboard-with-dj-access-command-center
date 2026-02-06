import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Upload, Trash2, Eye, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetBackgroundGifs,
  useGetBackgroundSettings,
  useUploadBackgroundGif,
  useDeleteBackgroundGif,
  useUpdateBackgroundSettings,
} from '../hooks/useQueries';
import { ExternalBlob } from '../backend';

export default function BackgroundVisualsManager() {
  const { data: gifs = [], isLoading: gifsLoading } = useGetBackgroundGifs();
  const { data: settings, isLoading: settingsLoading } = useGetBackgroundSettings();
  const uploadGif = useUploadBackgroundGif();
  const deleteGif = useDeleteBackgroundGif();
  const updateSettings = useUpdateBackgroundSettings();

  const [transparency, setTransparency] = useState<number>(50);
  const [fadeDuration, setFadeDuration] = useState<number>(2000);
  const [animationIntensity, setAnimationIntensity] = useState<number>(3);
  const [randomizationEnabled, setRandomizationEnabled] = useState<boolean>(true);
  const [previewGifUrl, setPreviewGifUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSystemReady, setUploadSystemReady] = useState<boolean | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Array<{ gifId: string; gifFile: ExternalBlob; fileName: string }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize settings from backend
  useEffect(() => {
    if (settings) {
      setTransparency(Number(settings.transparency));
      setFadeDuration(Number(settings.fadeDuration));
      setAnimationIntensity(Number(settings.animationIntensity));
      setRandomizationEnabled(settings.randomizationEnabled);
    }
  }, [settings]);

  // Set preview to first GIF if available
  useEffect(() => {
    if (gifs.length > 0 && !previewGifUrl) {
      setPreviewGifUrl(gifs[0][1].getDirectURL());
    }
  }, [gifs, previewGifUrl]);

  // Check upload system readiness on mount
  useEffect(() => {
    const checkUploadSystem = async () => {
      try {
        // Try a test operation to see if system is ready
        // We'll use the getBackgroundGifs call as a proxy
        if (gifs.length >= 0) {
          setUploadSystemReady(true);
        }
      } catch (error) {
        console.error('Upload system check failed:', error);
        setUploadSystemReady(false);
      }
    };

    if (!gifsLoading) {
      checkUploadSystem();
    }
  }, [gifsLoading, gifs.length]);

  // Retry pending uploads when system becomes ready
  useEffect(() => {
    if (uploadSystemReady && pendingUploads.length > 0) {
      const retryUploads = async () => {
        for (const upload of pendingUploads) {
          try {
            await uploadGif.mutateAsync({ gifId: upload.gifId, gifFile: upload.gifFile });
            toast.success(`${upload.fileName} uploaded successfully`, {
              description: 'GIF added to background collection',
            });
          } catch (error) {
            console.error('Retry upload error:', error);
            toast.error(`Failed to upload ${upload.fileName}`, {
              description: 'Please try again later',
            });
          }
        }
        setPendingUploads([]);
      };

      retryUploads();
    }
  }, [uploadSystemReady, pendingUploads, uploadGif]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (uploadSystemReady === false) {
      toast.error('Upload system not ready', {
        description: 'Please wait for the system to initialize',
      });
      return;
    }

    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith('image/gif')) {
          toast.error(`${file.name} is not a GIF file`, {
            description: 'Please upload only .gif files',
          });
          continue;
        }

        // Read file as bytes
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Create ExternalBlob with upload progress
        const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((percentage) => {
          console.log(`Uploading ${file.name}: ${percentage}%`);
        });

        // Generate unique ID for GIF
        const gifId = `gif-${Date.now()}-${i}`;

        try {
          // Upload to backend
          await uploadGif.mutateAsync({ gifId, gifFile: blob });

          toast.success(`${file.name} uploaded successfully`, {
            description: 'GIF added to background collection',
          });
        } catch (error: any) {
          console.error('Upload error:', error);
          
          // Check if it's a cashier registration error
          if (error.message?.includes('Upload system not ready')) {
            // Queue for retry
            setPendingUploads((prev) => [...prev, { gifId, gifFile: blob, fileName: file.name }]);
            setUploadSystemReady(false);
            toast.warning(`${file.name} queued for upload`, {
              description: 'Will retry when system is ready',
            });
          } else {
            toast.error(`Failed to upload ${file.name}`, {
              description: error.message || 'Unknown error',
            });
          }
        }
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteGif = async (gifId: string) => {
    try {
      await deleteGif.mutateAsync(gifId);
      toast.success('GIF removed successfully', {
        description: 'Background visual deleted',
      });

      // Update preview if deleted GIF was being previewed
      if (previewGifUrl === gifs.find((g) => g[0] === gifId)?.[1].getDirectURL()) {
        setPreviewGifUrl(gifs.length > 1 ? gifs[0][1].getDirectURL() : '');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete GIF', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings.mutateAsync({
        transparency: BigInt(transparency),
        fadeDuration: BigInt(fadeDuration),
        animationIntensity: BigInt(animationIntensity),
        randomizationEnabled,
      });

      toast.success('Settings saved successfully', {
        description: 'Background visual settings updated',
      });
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error('Failed to save settings', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  if (gifsLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-neon-cyan font-mono text-shimmer">Loading background visuals...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload System Status */}
      {uploadSystemReady !== null && (
        <div className={`bg-black/40 backdrop-blur-md rounded-xl border p-4 ${
          uploadSystemReady 
            ? 'border-green-500/30' 
            : 'border-yellow-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {uploadSystemReady ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-green-400 font-mono font-bold text-glow-pulse">Upload System Ready</p>
                  <p className="text-sm text-gray-400 text-shimmer">You can now upload background GIFs</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 animate-pulse" />
                <div>
                  <p className="text-yellow-400 font-mono font-bold text-glow-pulse">Preparing Upload System...</p>
                  <p className="text-sm text-gray-400 text-shimmer">
                    {pendingUploads.length > 0 
                      ? `${pendingUploads.length} upload(s) queued and will retry automatically`
                      : 'Please wait while the system initializes'
                    }
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-neon-purple/30 p-6">
        <h3 className="text-xl font-bold text-neon-cyan font-mono uppercase tracking-wider mb-4 text-glow-shift">
          Upload Background GIFs
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".gif,image/gif"
              multiple
              onChange={handleFileSelect}
              disabled={isUploading || uploadSystemReady === false}
              className="bg-black/50 border-neon-purple/50 text-white"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || uploadSystemReady === false}
              className="bg-gradient-to-r from-neon-purple to-neon-cyan hover:from-neon-purple/80 hover:to-neon-cyan/80"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="text-glow-pulse">
                {isUploading ? 'Uploading...' : uploadSystemReady === false ? 'System Initializing...' : 'Upload GIFs'}
              </span>
            </Button>
          </div>
          <p className="text-sm text-gray-400 text-shimmer">
            Upload .gif files to add to your background visual collection. Multiple files supported.
          </p>
        </div>
      </div>

      {/* GIF Gallery */}
      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-neon-cyan/30 p-6">
        <h3 className="text-xl font-bold text-neon-cyan font-mono uppercase tracking-wider mb-4 text-glow-shift">
          Background GIF Gallery ({gifs.length})
        </h3>
        {gifs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-shimmer">
            No background GIFs uploaded yet. Upload some to get started!
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {gifs.map(([gifId, gifBlob]) => {
              const gifUrl = gifBlob.getDirectURL();
              return (
                <div
                  key={gifId}
                  className="relative group bg-black/50 rounded-lg border border-neon-purple/30 overflow-hidden hover:border-neon-cyan/50 transition-all duration-300"
                >
                  <img
                    src={gifUrl}
                    alt={`Background GIF ${gifId}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewGifUrl(gifUrl)}
                      className="border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteGif(gifId)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings Section */}
      <div className="bg-black/40 backdrop-blur-md rounded-xl border border-green-500/30 p-6">
        <h3 className="text-xl font-bold text-green-400 font-mono uppercase tracking-wider mb-6 text-glow-shift">
          Visual Settings
        </h3>
        <div className="space-y-6">
          {/* Transparency Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="transparency" className="text-neon-cyan font-mono text-shimmer">
                Transparency
              </Label>
              <span className="text-neon-purple font-mono font-bold text-glow-pulse">{transparency}%</span>
            </div>
            <Slider
              id="transparency"
              min={0}
              max={100}
              step={5}
              value={[transparency]}
              onValueChange={(value) => setTransparency(value[0])}
              className="w-full"
            />
          </div>

          {/* Fade Duration Input */}
          <div className="space-y-3">
            <Label htmlFor="fadeDuration" className="text-neon-cyan font-mono text-shimmer">
              Fade Duration (ms)
            </Label>
            <Input
              id="fadeDuration"
              type="number"
              min={500}
              max={5000}
              step={100}
              value={fadeDuration}
              onChange={(e) => setFadeDuration(Number(e.target.value))}
              className="bg-black/50 border-neon-purple/50 text-white"
            />
          </div>

          {/* Animation Intensity Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="animationIntensity" className="text-neon-cyan font-mono text-shimmer">
                Animation Intensity
              </Label>
              <span className="text-neon-purple font-mono font-bold text-glow-pulse">{animationIntensity}</span>
            </div>
            <Slider
              id="animationIntensity"
              min={1}
              max={10}
              step={1}
              value={[animationIntensity]}
              onValueChange={(value) => setAnimationIntensity(value[0])}
              className="w-full"
            />
          </div>

          {/* Randomization Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-black/30 border border-neon-cyan/30">
            <Label htmlFor="randomization" className="text-neon-cyan font-mono cursor-pointer text-shimmer">
              Enable Random GIF Selection
            </Label>
            <Switch
              id="randomization"
              checked={randomizationEnabled}
              onCheckedChange={setRandomizationEnabled}
              className="data-[state=checked]:bg-neon-cyan"
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveSettings}
            disabled={updateSettings.isPending}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold"
          >
            <Save className="w-4 h-4 mr-2" />
            <span className="text-glow-pulse">
              {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
            </span>
          </Button>
        </div>
      </div>

      {/* Preview Section */}
      {previewGifUrl && (
        <div className="bg-black/40 backdrop-blur-md rounded-xl border border-pink-500/30 p-6">
          <h3 className="text-xl font-bold text-pink-400 font-mono uppercase tracking-wider mb-4 text-glow-shift">
            Live Preview
          </h3>
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '300px' }}>
            <div
              className="absolute inset-0"
              style={{
                opacity: transparency / 100,
              }}
            >
              <img
                src={previewGifUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                style={{
                  mixBlendMode: 'screen',
                  filter: `brightness(${0.8 + animationIntensity * 0.1}) contrast(${1 + animationIntensity * 0.05})`,
                }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 backdrop-blur-sm rounded-lg p-6 border border-neon-cyan/50">
                <p className="text-neon-cyan font-mono text-lg text-glow-pulse">
                  Preview with current settings
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
