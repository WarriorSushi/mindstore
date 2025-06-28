'use client';

import { motion } from 'framer-motion';
import { DiaryEntry } from '@/lib/indexedDB';
import { formatDate, formatTime, getDayOfWeek } from '@/lib/utils';
import GlassmorphismCard from './GlassmorphismCard';

interface DiaryEntryProps {
  entry: DiaryEntry;
  onDelete?: (id: string) => void;
  index?: number;
}

export default function DiaryEntryComponent({ entry, onDelete, index = 0 }: DiaryEntryProps) {
  const handleDelete = () => {
    if (onDelete) {
      onDelete(entry.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <GlassmorphismCard className="relative group">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                {getDayOfWeek(entry.timestamp)}
              </span>
              <span className="text-xs text-white/40">
                {formatTime(entry.timestamp)}
              </span>
            </div>
            <p className="text-xs text-white/50">
              {formatDate(entry.timestamp)}
            </p>
          </div>
          
          {onDelete && (
            <motion.button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 hover:bg-red-500/20 rounded-lg"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </motion.button>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </p>
          
          {entry.confidence && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <div className="flex-1 bg-white/10 rounded-full h-1">
                <div 
                  className="bg-green-400 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(entry.confidence * 100)}%` }}
                />
              </div>
              <span>Confidence: {Math.round(entry.confidence * 100)}%</span>
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      </GlassmorphismCard>
    </motion.div>
  );
} 