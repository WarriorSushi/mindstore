import { NextResponse } from 'next/server';
import { getProfile, setProfile } from '@/lib/db';

export async function GET() {
  const profile = getProfile();
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { key, value, category, confidence } = body;

  if (!key || !value || !category) {
    return NextResponse.json({ error: 'Missing key, value, or category' }, { status: 400 });
  }

  const id = setProfile(key, value, category, confidence || 1.0, 'stated');
  return NextResponse.json({ success: true, id });
}
