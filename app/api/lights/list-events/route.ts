import { NextResponse } from 'next/server';
import { listDeviceRepeatingEvents, getAllDevices } from '@/lib/lights';

export async function POST(request: Request) {
  let targetDeviceIds: string[] = [];
  let queryAll = true;

  try {
    // Check for optional deviceIds in the body
    try {
      const body = await request.json();
      if (body && Array.isArray(body.deviceIds) && body.deviceIds.every((id: any) => typeof id === 'string') && body.deviceIds.length > 0) {
        targetDeviceIds = body.deviceIds;
        queryAll = false;
        console.log(`API /list-events: Querying specific devices: ${targetDeviceIds.join(', ')}`);
      }
    } catch (e) {
      // Ignore JSON errors, default to querying all
      console.log("API /list-events: No valid deviceIds in body, querying all devices.");
    }

    // If no specific IDs provided, get all device IDs
    if (queryAll) {
        const allDevices = await getAllDevices();
        targetDeviceIds = allDevices.map(d => d.id);
        console.log(`API /list-events: Querying all ${targetDeviceIds.length} devices.`);
    }

    if (targetDeviceIds.length === 0) {
        return NextResponse.json({ eventsByDevice: {} }); // No devices to query
    }

    // Fetch events for each target device concurrently
    const results = await Promise.allSettled(
        targetDeviceIds.map(id => listDeviceRepeatingEvents(id))
    );

    // Aggregate results into a Record<deviceId, events[] | null>
    const eventsByDevice: Record<string, any[] | null> = {};
    results.forEach((result, index) => {
        const deviceId = targetDeviceIds[index];
        if (result.status === 'fulfilled') {
            eventsByDevice[deviceId] = result.value; // result.value is events[] or null
        } else {
            console.error(`API /list-events: Error fetching events for ${deviceId}:`, result.reason);
            eventsByDevice[deviceId] = null; // Indicate error for this device
        }
    });

    return NextResponse.json({ eventsByDevice });

  } catch (error: any) {
    console.error('Error in /api/lights/list-events:', error);
    return NextResponse.json({ error: error.message || "Failed to list events" }, { status: 500 });
  }
} 