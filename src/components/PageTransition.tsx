"use client";

import { type ReactNode, Children, cloneElement, isValidElement } from "react";

/**
 * PageTransition — wraps page content with a smooth fade + slide-up entrance.
 * Pure CSS animations — zero JS animation library needed.
 *
 * Usage:
 *   <PageTransition>
 *     <div>your page content</div>
 *   </PageTransition>
 *
 * For staggered children, wrap each section in <Stagger>:
 *   <PageTransition>
 *     <Stagger><h1>Title</h1></Stagger>
 *     <Stagger><div>Cards</div></Stagger>
 *   </PageTransition>
 */

// CSS is injected once via a <style> tag to avoid needing global CSS changes
const STAGGER_KEYFRAMES = `
@keyframes ms-stagger-in {
  from {
    opacity: 0;
    transform: translateY(8px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}
`;

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = STAGGER_KEYFRAMES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  ensureStyles();

  // Count Stagger children to assign incremental delays
  let staggerIndex = 0;
  const mapped = Children.map(children, (child) => {
    if (isValidElement(child) && (child.type as any).__isStagger) {
      const idx = staggerIndex++;
      return cloneElement(child as React.ReactElement<any>, { __staggerIndex: idx });
    }
    return child;
  });

  return <div className={className}>{mapped}</div>;
}

/**
 * Stagger — wraps a child element to participate in the staggered entrance.
 * Must be a direct child of <PageTransition>.
 */
export function Stagger({
  children,
  className,
  __staggerIndex = 0,
}: {
  children: ReactNode;
  className?: string;
  __staggerIndex?: number;
}) {
  const delay = 20 + __staggerIndex * 60; // 20ms base + 60ms per item

  return (
    <div
      className={className}
      style={{
        animation: `ms-stagger-in 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms both`,
      }}
    >
      {children}
    </div>
  );
}

// Tag so PageTransition can identify Stagger children
(Stagger as any).__isStagger = true;
