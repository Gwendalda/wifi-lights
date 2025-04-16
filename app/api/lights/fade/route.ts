import { NextResponse } from 'next/server';
import { setDeviceFadeAll } from '@/lib/lights'; // Use the function from the refactored library

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { state, deviceIds } = body; // state should be "ON" or "OFF"

    if (state !== 'ON' && state !== 'OFF') {
      return NextResponse.json({ error: 'Invalid state provided. Must be "ON" or "OFF".' }, { status: 400 });
    }

    // deviceIds is optional
    if (deviceIds && !Array.isArray(deviceIds)) {
        return NextResponse.json({ error: 'deviceIds must be an array of strings.' }, { status: 400 });
    }

    console.log(`API /fade: Setting fade to ${state} for devices ${deviceIds ? deviceIds.join(', ') : 'All'}`);
    await setDeviceFadeAll(state, deviceIds); // Call the library function

    return NextResponse.json({ message: `Fade ${state} command sent successfully` });
  } catch (error: any) {
    console.error('Error in /api/lights/fade:', error);
    // Check if it's a JSON parsing error
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to set fade state' }, { status: 500 });
  }
} 