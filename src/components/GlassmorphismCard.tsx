'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassmorphismCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  delay?: number;
}

export default function GlassmorphismCard({ 
  children, 
  className = '', 
  onClick, 
  hover = true,
  delay = 0 
}: GlassmorphismCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={hover ? { 
        scale: 1.02, 
        y: -5,
        transition: { duration: 0.2 }
      } : undefined}
      className={`
        glass glass-hover
        rounded-2xl p-6
        cursor-pointer
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
} 