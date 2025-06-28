'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiaryEntry } from '@/lib/indexedDB';
import { DiaryDatabase } from '@/lib/indexedDB';
import DiaryEntryComponent from './DiaryEntry';
import GlassmorphismCard from './GlassmorphismCard';

interface EntryListProps {
  entries: DiaryEntry[];
  onEntryDeleted: (id: string) => void;
}

export default function EntryList({ entries, onEntryDeleted }: EntryListProps) {
  const [database, setDatabase] = useState<DiaryDatabase | null>(null);

  useEffect(() => {
    const initDatabase = async () => {
      const db = new DiaryDatabase();
      await db.init();
      setDatabase(db);
    };
    initDatabase();
  }, []);

  const handleDelete = async (id: string) => {
    if (database) {
      try {
        await database.deleteEntry(id);
        onEntryDeleted(id);
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
    }
  };

  if (entries.length === 0) {
    return (
      <GlassmorphismCard className="text-center py-12">
        <div className="text-white/40 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Entries Yet</h3>
        <p className="text-gray-300">
          Start recording your thoughts to see them appear here
        </p>
      </GlassmorphismCard>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl font-bold text-white mb-2 text-glow">
          Your Diary Entries
        </h2>
        <p className="text-white/60">
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} captured
        </p>
      </motion.div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {entries.map((entry, index) => (
            <DiaryEntryComponent
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
} 