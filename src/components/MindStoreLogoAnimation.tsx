/**
 * MindStore Logo Animation — "Neural Bloom"
 * 
 * The white synapse node appears first, then the two M-arms
 * grow outward like a fountain sprouting from the center.
 * Used as loading animation across the app.
 * 
 * Pure CSS animation — no JS dependencies.
 * Respects prefers-reduced-motion.
 */

interface LogoAnimationProps {
  className?: string;
  /** Size in pixels */
  size?: number;
  /** Show "MindStore" text below */
  withText?: boolean;
  /** Animation duration in seconds */
  duration?: number;
}

export function MindStoreLogoAnimation({
  className = "",
  size = 64,
  withText = false,
  duration = 1.8,
}: LogoAnimationProps) {
  const s = size;
  const scale = s / 32;
  // Timing: synapse appears first, then arms grow
  const synapseDelay = 0;
  const synapseDur = duration * 0.25;
  const armDelay = duration * 0.2;
  const armDur = duration * 0.6;
  const glowDelay = duration * 0.7;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <style>{`
        @keyframes ms-synapse-pop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ms-arm-left {
          0% { stroke-dashoffset: 1; opacity: 0; }
          10% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ms-arm-right {
          0% { stroke-dashoffset: 1; opacity: 0; }
          10% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ms-glow-pulse {
          0% { filter: drop-shadow(0 0 0px rgba(20,184,166,0)); }
          50% { filter: drop-shadow(0 0 8px rgba(20,184,166,0.4)); }
          100% { filter: drop-shadow(0 0 3px rgba(20,184,166,0.15)); }
        }
        @keyframes ms-text-fade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ms-anim-synapse, .ms-anim-arm-l, .ms-anim-arm-r, .ms-anim-glow, .ms-anim-text {
            animation: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
            transform: none !important;
          }
        }
      `}</style>
      <svg
        width={s} height={s}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="MindStore loading"
        className="ms-anim-glow"
        style={{ animation: `ms-glow-pulse 2s ease-in-out ${glowDelay}s infinite` }}
      >
        <defs>
          <linearGradient id="ms-anim-bg" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#0f1419" />
            <stop offset="100%" stopColor="#0a1015" />
          </linearGradient>
          <linearGradient id="ms-anim-l" x1="5" y1="6" x2="16" y2="26">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="ms-anim-r" x1="16" y1="6" x2="27" y2="26">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        {/* Container */}
        <rect width="32" height="32" rx="7" fill="url(#ms-anim-bg)" />
        <rect width="32" height="32" rx="7" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" />
        {/* Left arm — grows from synapse outward */}
        <path
          d="M16 12.5 Q15.8 7.5 13 7.5 Q9 7.5 9 13.5 L9 25"
          stroke="url(#ms-anim-l)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          pathLength={1}
          className="ms-anim-arm-l"
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 1,
            opacity: 0,
            animation: `ms-arm-left ${armDur}s cubic-bezier(0.16,1,0.3,1) ${armDelay}s forwards`,
          }}
        />
        {/* Right arm — grows from synapse outward */}
        <path
          d="M16 12.5 Q16.2 7.5 19 7.5 Q23 7.5 23 13.5 L23 25"
          stroke="url(#ms-anim-r)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          pathLength={1}
          className="ms-anim-arm-r"
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 1,
            opacity: 0,
            animation: `ms-arm-right ${armDur}s cubic-bezier(0.16,1,0.3,1) ${armDelay}s forwards`,
          }}
        />
        {/* Synapse dot — pops first */}
        <circle
          cx="16" cy="12.5" r="2"
          fill="white"
          className="ms-anim-synapse"
          style={{
            transformOrigin: "16px 12.5px",
            opacity: 0,
            animation: `ms-synapse-pop ${synapseDur}s cubic-bezier(0.34,1.56,0.64,1) ${synapseDelay}s forwards`,
          }}
        />
      </svg>
      {withText && (
        <span
          className="font-semibold text-zinc-200 tracking-[-0.01em] ms-anim-text"
          style={{
            fontSize: Math.max(12, size * 0.22),
            opacity: 0,
            animation: `ms-text-fade 0.5s ease-out ${duration * 0.75}s forwards`,
          }}
        >
          MindStore
        </span>
      )}
    </div>
  );
}

/** Simple loading screen with the animated logo centered */
export function MindStoreLoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0b]">
      <MindStoreLogoAnimation size={80} withText duration={1.6} />
    </div>
  );
}
