/** Shared types and constants for the onboarding wizard */

export type OnboardingStep = 'welcome' | 'setup' | 'import' | 'explore' | 'done';

export const STEPS: OnboardingStep[] = ['welcome', 'setup', 'import', 'explore', 'done'];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  setup: 'Setup',
  import: 'Import',
  explore: 'Explore',
  done: 'Ready',
};

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  userName: string | null;
  aiProviderChoice: string | null;
  hasAiProvider: boolean;
  hasMemories: boolean;
  memoryCount: number;
}

export type AiProvider = 'gemini' | 'openai' | 'ollama' | 'skip';

export interface StepProps {
  onNext: () => void;
  onSkip: () => void;
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
}
