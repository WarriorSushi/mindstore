'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpeechRecognitionManager, SpeechRecognitionResult } from '@/lib/speechRecognition';
import { DiaryDatabase, DiaryEntry } from '@/lib/indexedDB';
import { generateId } from '@/lib/utils';
import GlassmorphismCard from './GlassmorphismCard';

interface VoiceRecorderProps {
  onEntrySaved: (entry: DiaryEntry) => void;
}

export default function VoiceRecorder({ onEntrySaved }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  
  const speechManagerRef = useRef<SpeechRecognitionManager | null>(null);
  const databaseRef = useRef<DiaryDatabase | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check microphone permission status
  const checkMicrophonePermission = async () => {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionStatus(permission.state);
        
        permission.onchange = () => {
          setPermissionStatus(permission.state);
          if (permission.state === 'granted') {
            setError(null);
          }
        };
      } else {
        // Fallback: try to get user media to check permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          setPermissionStatus('granted');
          setError(null);
        } catch (err) {
          setPermissionStatus('denied');
        }
      }
    } catch (error) {
      setPermissionStatus('prompt');
    }
  };

  useEffect(() => {
    if (!isClient) return;

    // Initialize database
    const initDatabase = async () => {
      try {
        const db = new DiaryDatabase();
        await db.init();
        databaseRef.current = db;
      } catch (err) {
        setError('Failed to initialize database');
      }
    };

    // Initialize speech recognition
    const initSpeechRecognition = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSupported(false);
        setError('Speech recognition is not supported in this browser');
        return;
      }

      speechManagerRef.current = new SpeechRecognitionManager(
        handleSpeechResult,
        handleSpeechError,
        handleSpeechStart,
        handleSpeechEnd
      );
    };

    checkMicrophonePermission();
    initDatabase();
    initSpeechRecognition();
  }, [isClient]);

  // Re-check permission when component mounts or when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkMicrophonePermission();
      }
    };

    const handleFocus = () => {
      checkMicrophonePermission();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSpeechResult = (result: SpeechRecognitionResult) => {
    setTranscript(result.transcript);
    
    if (result.isFinal && result.transcript.trim()) {
      saveEntry(result.transcript, result.confidence);
    }
  };

  const handleSpeechError = (errorMessage: string) => {
    setError(errorMessage);
    setIsRecording(false);
    
    // Update permission status if it's a permission error
    if (errorMessage.includes('denied') || errorMessage.includes('not-allowed')) {
      setPermissionStatus('denied');
    }
  };

  const handleSpeechStart = () => {
    setIsRecording(true);
    setError(null);
  };

  const handleSpeechEnd = () => {
    setIsRecording(false);
  };

  const saveEntry = async (content: string, confidence?: number) => {
    if (!databaseRef.current) return;

    const entry: DiaryEntry = {
      id: generateId(),
      content: content.trim(),
      timestamp: new Date(),
      confidence,
      isFinal: true
    };

    try {
      await databaseRef.current.saveEntry(entry);
      onEntrySaved(entry);
      setTranscript('');
    } catch (err) {
      setError('Failed to save entry');
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      setPermissionStatus('granted');
      setError(null);
      return true;
    } catch (error) {
      setPermissionStatus('denied');
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
      return false;
    }
  };

  const toggleRecording = async () => {
    if (!speechManagerRef.current) return;

    if (isRecording) {
      speechManagerRef.current.stop();
    } else {
      // Always check permission before starting
      await checkMicrophonePermission();
      
      if (permissionStatus === 'denied') {
        setError('Microphone access denied. Please allow microphone access in your browser settings and refresh the page.');
        return;
      }
      
      if (permissionStatus === 'prompt' || permissionStatus === 'unknown') {
        const granted = await requestMicrophonePermission();
        if (!granted) return;
      }
      
      speechManagerRef.current.start();
    }
  };

  if (!isClient) {
    return (
      <GlassmorphismCard className="text-center">
        <div className="animate-pulse">
          <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-6"></div>
          <div className="h-4 bg-white/20 rounded w-3/4 mx-auto mb-2"></div>
          <div className="h-3 bg-white/10 rounded w-1/2 mx-auto"></div>
        </div>
      </GlassmorphismCard>
    );
  }

  if (!isSupported) {
    return (
      <GlassmorphismCard className="text-center">
        <div className="text-red-400 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Browser Not Supported</h3>
        <p className="text-gray-300">
          Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.
        </p>
      </GlassmorphismCard>
    );
  }

  return (
    <GlassmorphismCard className="text-center">
      <div className="mb-6">
        <motion.button
          onClick={toggleRecording}
          disabled={!isSupported || permissionStatus === 'denied'}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-300 ease-in-out
            ${isRecording 
              ? 'bg-red-500 shadow-lg shadow-red-500/50' 
              : permissionStatus === 'denied'
              ? 'bg-gray-500 cursor-not-allowed'
              : permissionStatus === 'granted'
              ? 'bg-green-500/20 hover:bg-green-500/30 border border-green-400/30'
              : 'bg-white/20 hover:bg-white/30'
            }
          `}
          whileHover={permissionStatus !== 'denied' ? { scale: 1.1 } : undefined}
          whileTap={permissionStatus !== 'denied' ? { scale: 0.95 } : undefined}
        >
          <AnimatePresence>
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-400"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </AnimatePresence>
          
          <svg 
            className={`w-8 h-8 ${
              isRecording 
                ? 'text-white' 
                : permissionStatus === 'denied' 
                ? 'text-gray-400' 
                : permissionStatus === 'granted'
                ? 'text-green-400'
                : 'text-white/80'
            }`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            {isRecording ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </motion.button>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          {permissionStatus === 'denied' 
            ? 'Microphone Access Denied' 
            : permissionStatus === 'granted'
            ? isRecording 
              ? 'Recording...' 
              : 'Ready to Record'
            : isRecording 
            ? 'Recording...' 
            : 'Tap to Start Recording'
          }
        </h3>
        <p className="text-sm text-gray-300">
          {permissionStatus === 'denied' 
            ? 'Please allow microphone access in your browser settings'
            : permissionStatus === 'granted'
            ? isRecording 
              ? 'Speak clearly into your microphone' 
              : 'Click to start recording your thoughts'
            : isRecording 
            ? 'Speak clearly into your microphone' 
            : 'Your thoughts will be saved automatically'
          }
        </p>
      </div>

      {permissionStatus === 'denied' && (
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-300 text-sm mb-2">
            <strong>How to enable microphone access:</strong>
          </p>
          <ul className="text-yellow-200 text-xs space-y-1">
            <li>• Click the microphone icon in your browser's address bar</li>
            <li>• Select "Allow" for microphone access</li>
            <li>• Refresh this page after allowing access</li>
          </ul>
        </div>
      )}

      {permissionStatus === 'granted' && !isRecording && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
          <p className="text-green-300 text-sm">
            ✅ Microphone access granted! You're ready to record.
          </p>
        </div>
      )}

      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10"
          >
            <p className="text-white/90 text-sm leading-relaxed">
              {transcript}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg"
          >
            <p className="text-red-300 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassmorphismCard>
  );
} 