export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export class SpeechRecognitionManager {
  private recognition: any;
  private isSupported: boolean;
  private onResult: (result: SpeechRecognitionResult) => void;
  private onError: (error: string) => void;
  private onStart: () => void;
  private onEnd: () => void;

  constructor(
    onResult: (result: SpeechRecognitionResult) => void,
    onError: (error: string) => void,
    onStart: () => void,
    onEnd: () => void
  ) {
    this.onResult = onResult;
    this.onError = onError;
    this.onStart = onStart;
    this.onEnd = onEnd;
    
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.isSupported = !!SpeechRecognition;
    
    if (this.isSupported) {
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition() {
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.onResult({
          transcript: finalTranscript,
          confidence: event.results[event.results.length - 1][0].confidence,
          isFinal: true
        });
      } else if (interimTranscript) {
        this.onResult({
          transcript: interimTranscript,
          confidence: 0,
          isFinal: false
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      let errorMessage = 'Speech recognition error';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected';
          break;
        case 'audio-capture':
          errorMessage = 'Audio capture failed';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied';
          break;
        case 'network':
          errorMessage = 'Network error';
          break;
        default:
          errorMessage = `Error: ${event.error}`;
      }
      
      this.onError(errorMessage);
    };

    this.recognition.onstart = () => {
      this.onStart();
    };

    this.recognition.onend = () => {
      this.onEnd();
    };
  }

  public start() {
    if (!this.isSupported) {
      this.onError('Speech recognition is not supported in this browser');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      this.onError('Failed to start speech recognition');
    }
  }

  public stop() {
    if (this.isSupported && this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        this.onError('Failed to stop speech recognition');
      }
    }
  }

  public isSupportedBrowser(): boolean {
    return this.isSupported;
  }
} 