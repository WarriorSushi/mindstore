"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

/**
 * PageTransition — wraps page content with a smooth fade + slide-up entrance.
 * Use as the outermost wrapper in any app page for consistent entry animation.
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

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 8,
    filter: "blur(2px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger — wraps a child element to participate in the staggered entrance.
 * Must be a direct child of <PageTransition>.
 */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
