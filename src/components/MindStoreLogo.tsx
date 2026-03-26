/**
 * MindStore Logo — "Neural M" v2
 * 
 * Two brain hemispheres (teal left / sky right) forming the letter M,
 * connected by a white synapse node. Set in a dark rounded container.
 * 
 * The two-tone lobes represent dual processing — storage & retrieval,
 * analysis & creativity. The white synapse is the connection point.
 * 
 * Usage:
 *   <MindStoreLogo className="w-6 h-6" />          — app icon
 *   <MindStoreLogo className="w-8 h-8" withText />  — logo + wordmark
 */

interface MindStoreLogoProps {
  className?: string;
  withText?: boolean;
  textClassName?: string;
}

export function MindStoreLogo({ className = "w-7 h-7", withText = false, textClassName }: MindStoreLogoProps) {
  return (
    <span className={withText ? "inline-flex items-center gap-2.5" : "inline-flex"}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ms-bg" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#0f1419" />
            <stop offset="100%" stopColor="#0a1015" />
          </linearGradient>
          <linearGradient id="ms-l" x1="5" y1="6" x2="16" y2="26">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="ms-r" x1="16" y1="6" x2="27" y2="26">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        {/* Container */}
        <rect width="32" height="32" rx="7" fill="url(#ms-bg)" />
        <rect width="32" height="32" rx="7" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" />
        {/* Left lobe — teal */}
        <path
          d="M9 25 V13.5 Q9 7.5 13 7.5 Q15.8 7.5 16 12.5"
          stroke="url(#ms-l)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Right lobe — sky */}
        <path
          d="M23 25 V13.5 Q23 7.5 19 7.5 Q16.2 7.5 16 12.5"
          stroke="url(#ms-r)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Synapse */}
        <circle cx="16" cy="12.5" r="2" fill="white" />
      </svg>
      {withText && (
        <span className={textClassName || "font-semibold text-[15px] tracking-[-0.01em]"}>
          MindStore
        </span>
      )}
    </span>
  );
}

/** Monochrome variant for footers, loading states, watermarks */
export function MindStoreLogoMono({ className = "w-5 h-5", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="0.8" />
      <path
        d="M9 25 V13.5 Q9 7.5 13 7.5 Q15.8 7.5 16 12.5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <path
        d="M23 25 V13.5 Q23 7.5 19 7.5 Q16.2 7.5 16 12.5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <circle cx="16" cy="12.5" r="2" fill={color} fillOpacity="0.5" />
    </svg>
  );
}
