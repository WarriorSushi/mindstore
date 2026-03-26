/**
 * MindStore Logo — "Mind Mark"
 * 
 * Two brain-lobe arches forming the letter M with a center synapse node.
 * The arches represent knowledge hemispheres; the dot represents the connection point —
 * the moment of insight when disparate knowledge connects.
 * 
 * Usage:
 *   <MindStoreLogo className="w-6 h-6" />          — inline icon
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
          <linearGradient id="ms-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <path
          d="M7 26 V12 Q7 6 12 6 Q16 6 16 13 Q16 6 20 6 Q25 6 25 12 V26"
          stroke="url(#ms-g)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="13.5" r="2" fill="url(#ms-g)" />
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
      <path
        d="M7 26 V12 Q7 6 12 6 Q16 6 16 13 Q16 6 20 6 Q25 6 25 12 V26"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="13.5" r="2" fill={color} />
    </svg>
  );
}
