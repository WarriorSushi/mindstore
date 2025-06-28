'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DiaryEntry } from '@/lib/indexedDB';
import { DiaryDatabase } from '@/lib/indexedDB';
import VoiceRecorder from '@/components/VoiceRecorder';
import EntryList from '@/components/EntryList';
import GlassmorphismCard from '@/components/GlassmorphismCard';

export default function Home() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [database, setDatabase] = useState<DiaryDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const initDatabase = async () => {
      try {
        const db = new DiaryDatabase();
        await db.init();
        setDatabase(db);
        
        // Load existing entries
        const existingEntries = await db.getEntries();
        setEntries(existingEntries);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setLoading(false);
      }
    };

    initDatabase();
  }, [isClient]);

  const handleEntrySaved = (newEntry: DiaryEntry) => {
    setEntries(prev => [newEntry, ...prev]);
  };

  const handleEntryDeleted = (deletedId: string) => {
    setEntries(prev => prev.filter(entry => entry.id !== deletedId));
  };

  if (!isClient || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 text-glow">
            MindStore
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Transform your thoughts into written memories with the power of voice recognition
          </p>
        </motion.header>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Voice Recorder Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <VoiceRecorder onEntrySaved={handleEntrySaved} />
          </motion.div>

          {/* Stats Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <GlassmorphismCard className="h-full flex flex-col justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">
                  {entries.length}
                </div>
                <div className="text-white/60 mb-4">
                  Entries Captured
                </div>
                <div className="space-y-2 text-sm text-white/40">
                  <div className="flex justify-between">
                    <span>Today:</span>
                    <span>
                      {entries.filter(entry => {
                        const today = new Date();
                        const entryDate = new Date(entry.timestamp);
                        return entryDate.toDateString() === today.toDateString();
                      }).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>This Week:</span>
                    <span>
                      {entries.filter(entry => {
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return new Date(entry.timestamp) > weekAgo;
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
            </GlassmorphismCard>
          </motion.div>
        </div>

        {/* Entries List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <EntryList entries={entries} onEntryDeleted={handleEntryDeleted} />
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center mt-16 text-white/40 text-sm"
        >
          <p>Built with Next.js, TypeScript, and Web Speech API</p>
          <p className="mt-1">Your data stays private and local</p>
        </motion.footer>
      </div>
    </div>
  );
} 