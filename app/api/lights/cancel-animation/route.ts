import { NextResponse } from 'next/server';
import { cancelDeviceAnimation } from '@/lib/lights';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, eventId } = body;

    // --- Validate Input ---
    if (typeof deviceId !== 'string' || deviceId.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid deviceId.' }, { status: 400 });
    }
    if (typeof eventId !== 'number') {
        return NextResponse.json({ error: 'Missing or invalid eventId (must be a number).' }, { status: 400 });
    }

    console.log(`API /cancel-animation: Request to cancel event ${eventId} for device ${deviceId}`);

    // Attempt cancellation (this also removes the record from cache)
    const attempted = await cancelDeviceAnimation(deviceId, eventId);

    if (attempted) {
        // Return success even if the HTTP command failed, as the user action was processed
        return NextResponse.json({ message: `Cancellation attempted for event ${eventId} on ${deviceId}` });
    } else {
        // This only happens if deviceId wasn't found in cache initially
        return NextResponse.json({ error: `Device ${deviceId} not found.` }, { status: 404 });
    }

  } catch (error: any) {
    console.error('Error in /api/lights/cancel-animation:', error);
    const errorMessage = error instanceof SyntaxError ? "Invalid JSON body" : (error.message || "Unknown error");
    return NextResponse.json({ error: `Failed: ${errorMessage}` }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
} 