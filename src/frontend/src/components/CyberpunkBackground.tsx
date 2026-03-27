import { useEffect, useRef } from "react";

interface CyberpunkBackgroundProps {
  audioData?: {
    volume: number;
    bass: number;
    mid: number;
    high: number;
    isActive: boolean;
    bassKick: number;
    spectralCentroid: number;
  };
  isPlaying?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  pulsePhase: number;
  trail: { x: number; y: number; alpha: number }[];
}

interface Flare {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface LightBeam {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
  speed: number;
}

export default function CyberpunkBackground({
  audioData,
  isPlaying = false,
}: CyberpunkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const glowLayerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const flaresRef = useRef<Flare[]>([]);
  const lightBeamsRef = useRef<LightBeam[]>([]);
  const lastBassTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // Enhanced parallax effect based on audio with frequency-based movement
  useEffect(() => {
    if (!parallaxRef.current || !audioData?.isActive) return;

    const intensity = audioData.volume * 15; // Amplified intensity
    const bassIntensity = audioData.bass * 25; // Stronger bass response
    const midIntensity = audioData.mid * 10;
    const _spectralShift = audioData.spectralCentroid * 5;

    const time = Date.now() / 2000;
    const bassTime = Date.now() / 1000;

    parallaxRef.current.style.transform = `
      translate(
        ${Math.sin(time) * intensity + Math.sin(bassTime * 2) * bassIntensity}px, 
        ${Math.cos(time) * intensity + Math.cos(bassTime * 2) * midIntensity}px
      )
      scale(${1 + audioData.bass * 0.04 + audioData.bassKick * 0.03})
      rotate(${Math.sin(time * 0.5) * audioData.mid * 0.5}deg)
    `;
  }, [audioData]);

  // Canvas particles, light flares, and dynamic light beams
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const colors = [
      "rgba(168, 85, 247, ", // purple
      "rgba(34, 211, 238, ", // cyan
      "rgba(96, 165, 250, ", // blue
      "rgba(236, 72, 153, ", // pink
    ];

    const createParticle = (bass: number, bassKick: number) => {
      const intensity = 1 + bassKick * 2;
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1.5 * intensity,
        vy: (Math.random() - 0.5) * 1.5 * intensity,
        size: 3 + bass * 12 + bassKick * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: 100 + Math.random() * 100,
        pulsePhase: Math.random() * Math.PI * 2,
        trail: [],
      });
    };

    const createFlare = (bass: number, bassKick: number) => {
      const intensity = 1 + bassKick * 3;
      flaresRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 3 * intensity,
        vy: (Math.random() - 0.5) * 3 * intensity,
        size: 30 + bass * 150 + bassKick * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: 50 + Math.random() * 50,
      });
    };

    const createLightBeam = (bass: number, bassKick: number) => {
      const _intensity = 1 + bassKick * 2;
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;

      lightBeamsRef.current.push({
        x: startX,
        y: startY,
        angle: Math.random() * Math.PI * 2,
        length: 100 + bass * 300 + bassKick * 200,
        width: 2 + bass * 8 + bassKick * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: 40 + Math.random() * 40,
        speed: 2 + Math.random() * 3,
      });
    };

    const animate = (timestamp: number) => {
      // Adaptive frame rate based on device and visibility
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const targetFPS = !isPlaying
        ? 10
        : document.hidden
          ? 15
          : isMobile
            ? 30
            : 60;
      const frameInterval = 1000 / targetFPS;

      if (timestamp - lastFrameTimeRef.current < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = (timestamp - lastFrameTimeRef.current) / 16.67; // Normalize to 60fps
      lastFrameTimeRef.current = timestamp;

      // Fade trail effect instead of full clear
      ctx.fillStyle = "rgba(10, 0, 21, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create particles, flares, and light beams on bass peaks
      if (audioData?.isActive) {
        const now = Date.now();
        const bassThreshold = 0.4; // Lower threshold for more frequent effects

        if (audioData.bass > bassThreshold || audioData.bassKick > 0.3) {
          if (now - lastBassTimeRef.current > 100) {
            // More frequent spawning
            createParticle(audioData.bass, audioData.bassKick);

            if (audioData.bass > 0.5 || audioData.bassKick > 0.5) {
              createFlare(audioData.bass, audioData.bassKick);
            }

            if (audioData.bassKick > 0.4) {
              createLightBeam(audioData.bass, audioData.bassKick);
            }

            lastBassTimeRef.current = now;
          }
        }
      }

      // Update and draw light beams
      for (let i = lightBeamsRef.current.length - 1; i >= 0; i--) {
        const beam = lightBeamsRef.current[i];

        // Ripple outward
        beam.length += beam.speed * deltaTime;
        beam.life++;

        const alpha = 1 - beam.life / beam.maxLife;
        const endX = beam.x + Math.cos(beam.angle) * beam.length;
        const endY = beam.y + Math.sin(beam.angle) * beam.length;

        // Draw beam with gradient
        const gradient = ctx.createLinearGradient(beam.x, beam.y, endX, endY);
        gradient.addColorStop(0, `${beam.color + alpha * 0.8})`);
        gradient.addColorStop(0.5, `${beam.color + alpha * 0.5})`);
        gradient.addColorStop(1, `${beam.color}0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = beam.width * alpha;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(beam.x, beam.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Add glow at origin
        const glowGradient = ctx.createRadialGradient(
          beam.x,
          beam.y,
          0,
          beam.x,
          beam.y,
          beam.width * 3,
        );
        glowGradient.addColorStop(0, `${beam.color + alpha * 0.9})`);
        glowGradient.addColorStop(1, `${beam.color}0)`);
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(beam.x, beam.y, beam.width * 3, 0, Math.PI * 2);
        ctx.fill();

        // Remove dead beams
        if (beam.life >= beam.maxLife) {
          lightBeamsRef.current.splice(i, 1);
        }
      }

      // Update and draw particles with trails
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const particle = particlesRef.current[i];

        // Enhanced weave motion based on bass and mid frequencies
        const bassInfluence = (audioData?.bass || 0) * 1.5;
        const midInfluence = (audioData?.mid || 0) * 0.8;
        const kickInfluence = (audioData?.bassKick || 0) * 2;

        particle.vx +=
          Math.sin(particle.pulsePhase + timestamp / 800) *
          bassInfluence *
          0.15 *
          deltaTime;
        particle.vy +=
          Math.cos(particle.pulsePhase + timestamp / 800) *
          bassInfluence *
          0.15 *
          deltaTime;
        particle.vx +=
          Math.sin(timestamp / 500) * midInfluence * 0.1 * deltaTime;
        particle.vy +=
          Math.cos(timestamp / 500) * midInfluence * 0.1 * deltaTime;

        // Add trail point
        particle.trail.push({ x: particle.x, y: particle.y, alpha: 1 });
        if (particle.trail.length > 8) {
          particle.trail.shift();
        }

        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.life++;

        // Wrap around screen edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        const alpha = 1 - particle.life / particle.maxLife;
        const pulse =
          Math.sin(timestamp / 150 + particle.pulsePhase) * 0.4 + 0.8;
        const currentSize =
          particle.size * alpha * pulse * (1 + kickInfluence * 0.3);

        // Draw trail
        for (let j = 0; j < particle.trail.length - 1; j++) {
          const trailPoint = particle.trail[j];
          const trailAlpha = (j / particle.trail.length) * alpha * 0.5;

          const trailGradient = ctx.createRadialGradient(
            trailPoint.x,
            trailPoint.y,
            0,
            trailPoint.x,
            trailPoint.y,
            currentSize * 0.5,
          );
          trailGradient.addColorStop(0, `${particle.color + trailAlpha})`);
          trailGradient.addColorStop(1, `${particle.color}0)`);

          ctx.fillStyle = trailGradient;
          ctx.beginPath();
          ctx.arc(
            trailPoint.x,
            trailPoint.y,
            currentSize * 0.5,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        // Draw particle with enhanced glow
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          currentSize * 3,
        );
        gradient.addColorStop(0, `${particle.color + alpha * 1})`);
        gradient.addColorStop(0.3, `${particle.color + alpha * 0.6})`);
        gradient.addColorStop(0.7, `${particle.color + alpha * 0.3})`);
        gradient.addColorStop(1, `${particle.color}0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, currentSize * 3, 0, Math.PI * 2);
        ctx.fill();

        // Remove dead particles
        if (particle.life >= particle.maxLife) {
          particlesRef.current.splice(i, 1);
        }
      }

      // Update and draw flares with enhanced glow
      for (let i = flaresRef.current.length - 1; i >= 0; i--) {
        const flare = flaresRef.current[i];

        flare.x += flare.vx * deltaTime;
        flare.y += flare.vy * deltaTime;
        flare.life++;

        const alpha = 1 - flare.life / flare.maxLife;
        const currentSize = flare.size * alpha;

        // Draw multi-layer glow
        for (let layer = 0; layer < 3; layer++) {
          const layerSize = currentSize * (1 + layer * 0.5);
          const layerAlpha = alpha * (1 - layer * 0.3);

          const gradient = ctx.createRadialGradient(
            flare.x,
            flare.y,
            0,
            flare.x,
            flare.y,
            layerSize,
          );
          gradient.addColorStop(0, `${flare.color + layerAlpha * 0.9})`);
          gradient.addColorStop(0.4, `${flare.color + layerAlpha * 0.5})`);
          gradient.addColorStop(1, `${flare.color}0)`);

          ctx.fillStyle = gradient;
          ctx.fillRect(
            flare.x - layerSize,
            flare.y - layerSize,
            layerSize * 2,
            layerSize * 2,
          );
        }

        // Remove dead flares
        if (flare.life >= flare.maxLife) {
          flaresRef.current.splice(i, 1);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioData, isPlaying]);

  // Amplified dynamic glow intensity
  const glowIntensity = audioData?.isActive
    ? 0.4 + audioData.volume * 1.2 + audioData.bassKick * 0.5
    : 0.3;

  const bassGlow = audioData?.isActive
    ? audioData.bass * 80 + audioData.bassKick * 60
    : 0;

  const midGlow = audioData?.isActive ? audioData.mid * 50 : 0;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Main wallpaper with enhanced parallax */}
      <div
        ref={parallaxRef}
        className="absolute inset-[-10%] transition-transform duration-200 ease-out"
        style={{
          willChange: "transform",
        }}
      >
        <img
          src="/assets/Bonsai Radio Cyberpunk.png"
          alt=""
          className="w-full h-full object-cover"
          style={{
            filter: `brightness(${0.6 + (audioData?.volume || 0) * 0.3}) contrast(${1.1 + (audioData?.bass || 0) * 0.2}) saturate(${1 + (audioData?.mid || 0) * 0.3})`,
          }}
        />
      </div>

      {/* Amplified animated glow overlay */}
      <div
        ref={glowLayerRef}
        className="absolute inset-0 pointer-events-none transition-opacity duration-200"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(168, 85, 247, ${glowIntensity * 0.5}) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(34, 211, 238, ${glowIntensity * 0.5}) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(96, 165, 250, ${glowIntensity * 0.4}) 0%, transparent 60%),
            radial-gradient(circle at 40% 80%, rgba(236, 72, 153, ${glowIntensity * 0.3}) 0%, transparent 45%)
          `,
          opacity: 0.7 + glowIntensity * 0.3,
          mixBlendMode: "screen",
        }}
      />

      {/* Canvas for particles, light flares, and beams */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: "screen" }}
      />

      {/* Enhanced pulsing edge glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-200"
        style={{
          boxShadow: `
            inset 0 0 ${120 + bassGlow}px rgba(168, 85, 247, ${0.4 + (audioData?.bass || 0) * 0.7}),
            inset 0 0 ${100 + midGlow}px rgba(34, 211, 238, ${0.3 + (audioData?.mid || 0) * 0.6}),
            inset 0 0 ${80 + (audioData?.bassKick || 0) * 100}px rgba(236, 72, 153, ${(audioData?.bassKick || 0) * 0.8})
          `,
          animation: audioData?.isActive
            ? "pulse-glow 1.5s ease-in-out infinite"
            : "none",
        }}
      />

      {/* Dark gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 pointer-events-none" />
    </div>
  );
}
