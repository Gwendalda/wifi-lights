import { NextResponse } from 'next/server';
import { setDeviceSpeedAll } from '@/lib/lights'; // Use the function from the refactored library

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { speed, deviceIds } = body; // speed should be a number (1-40)

    if (typeof speed !== 'number' || speed < 1 || speed > 40) {
      return NextResponse.json({ error: 'Invalid speed value provided. Must be a number between 1 and 40.' }, { status: 400 });
    }

    // deviceIds is optional
    if (deviceIds && !Array.isArray(deviceIds)) {
        return NextResponse.json({ error: 'deviceIds must be an array of strings.' }, { status: 400 });
    }

    console.log(`API /speed: Setting speed to ${speed} for devices ${deviceIds ? deviceIds.join(', ') : 'All'}`);
    await setDeviceSpeedAll(speed, deviceIds); // Call the library function

    return NextResponse.json({ message: `Speed set to ${speed} command sent successfully` });
  } catch (error: any) {
    console.error('Error in /api/lights/speed:', error);
    // Check if it's a JSON parsing error
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to set speed' }, { status: 500 });
  }
} 