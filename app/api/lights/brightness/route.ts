import { NextResponse } from 'next/server';
import { setDeviceBrightnessAll } from '@/lib/lights';

/**
 * API Route to set the brightness (Dimmer) of specified lights (or all).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { brightness, deviceIds } = body;

    // --- Validate Input ---
    if (typeof brightness !== 'number' || brightness < 0 || brightness > 100) {
      return NextResponse.json({ error: 'Invalid brightness. Must be number between 0 and 100.' }, { status: 400 });
    }
    if (deviceIds && !(Array.isArray(deviceIds) && deviceIds.every((id: any) => typeof id === 'string'))) {
        return NextResponse.json({ error: 'Invalid deviceIds format.' }, { status: 400 });
    }

    const target = deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices";
    console.log(`API /brightness: Setting brightness to ${brightness}% for ${target}`);

    await setDeviceBrightnessAll(brightness, deviceIds);

    return NextResponse.json({ message: `Brightness set to ${brightness}% for ${target}` });

  } catch (error: any) {
    console.error('Error in /api/lights/brightness:', error);
    const errorMessage = error instanceof SyntaxError ? "Invalid JSON body" : (error.message || "Unknown error");
    return NextResponse.json({ error: `Failed: ${errorMessage}` }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
} 