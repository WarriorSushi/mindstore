import { NextResponse } from 'next/server';
import { getUserId } from '@/server/user';
import { getOnboardingState } from '@/server/onboarding';

/**
 * GET /api/v1/onboarding — get user's setup progress
 * 
 * Returns completion state for guided onboarding:
 * - Which steps are done (AI provider, import, embeddings)
 * - What to do next
 * - Completion percentage
 */
export async function GET() {
  try {
    const userId = await getUserId();
    const state = await getOnboardingState(userId);
    return NextResponse.json(state);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
