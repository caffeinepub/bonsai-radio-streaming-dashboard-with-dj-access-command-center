export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#0a0015] via-[#1a0030] to-[#0a0015]">
      <div className="relative">
        <img
          src="/assets/generated/neural-pulse-bg.dim_1024x768.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 animate-pulse"
        />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <img
            src="/assets/generated/bonsai-radio-logo-transparent.dim_200x200.png"
            alt="Bonsai Radio"
            className="w-32 h-32 animate-pulse"
          />
          <div className="flex gap-2">
            <div
              className="w-3 h-3 rounded-full bg-neon-purple animate-pulse"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-3 h-3 rounded-full bg-neon-cyan animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-3 h-3 rounded-full bg-neon-blue animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <p className="text-neon-cyan font-mono text-sm tracking-wider animate-pulse">
            INITIALIZING NEURAL STREAM
          </p>
        </div>
      </div>
    </div>
  );
}
