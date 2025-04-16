import { NextResponse } from 'next/server';
import { startSmoothDimmerTransition } from '@/lib/lights';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, targetDimmer, durationSeconds } = body;

    // --- Validate Input ---
    if (typeof deviceId !== 'string' || deviceId.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid deviceId.' }, { status: 400 });
    }
    if (typeof targetDimmer !== 'number' || targetDimmer < 0 || targetDimmer > 100) {
        return NextResponse.json({ error: 'Invalid targetDimmer. Must be number between 0 and 100.' }, { status: 400 });
    }
    if (typeof durationSeconds !== 'number' || durationSeconds <= 0) {
        return NextResponse.json({ error: 'Invalid durationSeconds. Must be a positive number.' }, { status: 400 });
    }

    console.log(`API /smooth-dimmer: Starting transition for ${deviceId} to ${targetDimmer}% over ${durationSeconds}s`);

    const success = await startSmoothDimmerTransition(deviceId, targetDimmer, durationSeconds);

    if (success) {
        return NextResponse.json({ message: `Smooth dimmer transition initiated for ${deviceId}` });
    } else {
        return NextResponse.json({ error: `Failed to initiate smooth dimmer transition for ${deviceId}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in /api/lights/smooth-dimmer:', error);
    const errorMessage = error instanceof SyntaxError ? "Invalid JSON body" : (error.message || "Unknown error");
    return NextResponse.json({ error: `Failed: ${errorMessage}` }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
} 