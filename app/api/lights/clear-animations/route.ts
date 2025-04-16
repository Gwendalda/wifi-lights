import { NextResponse } from 'next/server';
import { clearAllRepeatingEvents } from '@/lib/lights';

export async function POST(request: Request) {
  try {
    let deviceIds: string[] | undefined = undefined;

    // Try to parse body for optional deviceIds
    try {
      const body = await request.json();
      if (body && Array.isArray(body.deviceIds) && body.deviceIds.every((id: any) => typeof id === 'string')) {
        deviceIds = body.deviceIds;
      }
    } catch (e) {
        // Ignore JSON parsing errors (e.g., empty body), default to all devices
        console.log("API /clear-animations: No valid deviceIds in body, clearing all devices.");
    }

    console.log(`API /clear-animations: Request to clear events for ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`);

    await clearAllRepeatingEvents(deviceIds);

    return NextResponse.json({ message: `ClearRepeatingEvents command sent to ${deviceIds ? "specified" : "all"} devices.` });

  } catch (error: any) {
    console.error('Error in /api/lights/clear-animations:', error);
    return NextResponse.json({ error: error.message || "Failed to clear animations" }, { status: 500 });
  }
} 