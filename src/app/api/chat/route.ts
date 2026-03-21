import { NextRequest, NextResponse } from 'next/server';
import { getDb, getProfile, setProfile } from '@/lib/db';
import { searchMind } from '@/lib/search';

/**
 * Chat API — the AI learning engine
 * Processes user messages, searches for context, learns new facts,
 * and responds intelligently
 */
export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const db = getDb();

    // Store user message
    db.prepare('INSERT INTO conversations (id, role, content) VALUES (?, ?, ?)')
      .run(crypto.randomUUID(), 'user', message);

    // Search for relevant context
    const searchResults = await searchMind(message, { limit: 5 }, 'local');
    const context = searchResults.map(r => r.content).join('\n\n');

    // Get current profile
    const profile = getProfile();
    const profileSummary = Object.entries(profile)
      .map(([k, v]) => `${k}: ${v.value}`)
      .join('\n');

    // Try to extract learnable facts from the message
    const learnedFacts = extractFacts(message);
    for (const fact of learnedFacts) {
      setProfile(fact.key, fact.value, fact.category, 0.8, 'learned');
    }

    // Build response
    // In a full implementation, this would call an LLM (user's own API key)
    // For now, we provide a smart rule-based response + show what was learned
    let response = '';

    if (learnedFacts.length > 0) {
      response += `I learned something about you:\n${learnedFacts.map(f => `• ${f.key}: ${f.value}`).join('\n')}\n\n`;
    }

    if (searchResults.length > 0 && isSearchQuery(message)) {
      response += `Here's what I found in your mind:\n\n${searchResults.slice(0, 3).map((r, i) => 
        `**${i + 1}.** (${r.sourceType}) ${r.title || 'Untitled'}\n${r.content.slice(0, 200)}...`
      ).join('\n\n')}\n`;
    } else if (learnedFacts.length === 0) {
      response += generateSmartResponse(message, profileSummary, context);
    }

    if (!response) {
      response = "Got it! I'm storing this in your mind. The more you tell me, the better I can help you — and the more context any connected AI will have about you.";
    }

    // Store assistant response
    db.prepare('INSERT INTO conversations (id, role, content) VALUES (?, ?, ?)')
      .run(crypto.randomUUID(), 'assistant', response);

    return NextResponse.json({ response, learned: learnedFacts });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function isSearchQuery(message: string): boolean {
  const searchIndicators = ['find', 'search', 'what do i know about', 'look for', 'show me', 'recall', 'remember'];
  const lower = message.toLowerCase();
  return searchIndicators.some(ind => lower.includes(ind));
}

interface LearnedFact {
  key: string;
  value: string;
  category: 'preference' | 'trait' | 'goal' | 'knowledge' | 'relationship' | 'habit';
}

function extractFacts(message: string): LearnedFact[] {
  const facts: LearnedFact[] = [];
  const lower = message.toLowerCase();

  // Pattern: "I am/I'm a/an ..."
  const iAmMatch = message.match(/(?:i am|i'm)\s+(?:a |an )?([\w\s]+?)(?:\.|,|!|\?|$)/i);
  if (iAmMatch) {
    const value = iAmMatch[1].trim();
    if (value.length > 2 && value.length < 50) {
      facts.push({ key: 'identity', value, category: 'trait' });
    }
  }

  // Pattern: "I work at/for ..."
  const workMatch = message.match(/i (?:work|working) (?:at|for|in)\s+([\w\s]+?)(?:\.|,|!|\?|$)/i);
  if (workMatch) {
    facts.push({ key: 'workplace', value: workMatch[1].trim(), category: 'trait' });
  }

  // Pattern: "I like/love/enjoy/prefer ..."
  const likeMatch = message.match(/i (?:like|love|enjoy|prefer)\s+([\w\s]+?)(?:\.|,|!|\?|$)/i);
  if (likeMatch) {
    facts.push({ key: `likes_${likeMatch[1].trim().replace(/\s+/g, '_').slice(0, 30)}`, value: likeMatch[1].trim(), category: 'preference' });
  }

  // Pattern: "My goal is ..."
  const goalMatch = message.match(/my goal (?:is|:)\s+([\w\s]+?)(?:\.|,|!|\?|$)/i);
  if (goalMatch) {
    facts.push({ key: 'goal', value: goalMatch[1].trim(), category: 'goal' });
  }

  // Pattern: "I want to ..."
  const wantMatch = message.match(/i want to\s+([\w\s]+?)(?:\.|,|!|\?|$)/i);
  if (wantMatch) {
    facts.push({ key: `goal_${Date.now()}`, value: `wants to ${wantMatch[1].trim()}`, category: 'goal' });
  }

  // Pattern: "I use/using ..."
  const useMatch = message.match(/i (?:use|using|am using)\s+([\w\s]+?)(?:\.|,|!|\?|for|$)/i);
  if (useMatch) {
    facts.push({ key: `uses_${useMatch[1].trim().replace(/\s+/g, '_').slice(0, 30)}`, value: useMatch[1].trim(), category: 'knowledge' });
  }

  return facts;
}

function generateSmartResponse(message: string, profile: string, context: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return profile
      ? `Hey! Good to see you again. Based on what I know about you, I have ${profile.split('\n').length} profile items stored. What would you like to explore or add to your mind?`
      : "Hey there! I'm ready to start building your mind layer. Tell me about yourself — what you do, what you're interested in, your goals. The more I know, the better any connected AI can serve you.";
  }

  if (lower.includes('what do you know') || lower.includes('what have you learned')) {
    return profile
      ? `Here's what I know about you so far:\n\n${profile}\n\nTell me more to expand your profile!`
      : "I don't know anything about you yet! Start by telling me about yourself, importing your notes, or connecting your ChatGPT export.";
  }

  return '';
}
