import { NextResponse } from 'next/server';
import { sendRawHttpCommand, getAllDevices } from '@/lib/lights';

/**
 * API Route to send a raw command string to specified lights (or all).
 * USE WITH CAUTION - For debugging/advanced use only.
 */
export async function POST(request: Request) {
  let targetDeviceIds: string[] = [];
  let commandToSend: string | null = null;
  let queryAll = true;

  try {
    const body = await request.json();

    // Validate command
    if (typeof body.command !== 'string' || body.command.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid command string.' }, { status: 400 });
    }
    commandToSend = body.command;

    // Check for optional deviceIds
    if (body.deviceIds && Array.isArray(body.deviceIds) && body.deviceIds.every((id: any) => typeof id === 'string') && body.deviceIds.length > 0) {
      targetDeviceIds = body.deviceIds;
      queryAll = false;
    }

    // If no specific IDs provided, get all device IDs
    if (queryAll) {
        const allDevices = await getAllDevices();
        targetDeviceIds = allDevices.map(d => d.id);
    }

    if (targetDeviceIds.length === 0) {
        return NextResponse.json({ message: "No target devices found." }, { status: 404 });
    }

    const targetDescription = queryAll ? `all ${targetDeviceIds.length} devices` : `devices ${targetDeviceIds.join(", ")}`;
    console.log(`API /raw-command: Sending command "${commandToSend}" to ${targetDescription}`);

    // Send command to each target device concurrently
    const results = await Promise.allSettled(
        targetDeviceIds.map(id => sendRawHttpCommand(id, commandToSend!)) // commandToSend is guaranteed non-null here
    );

    // Process results (optional: could return detailed status)
    const successes = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failures = results.length - successes;

    const message = `Raw command sent to ${targetDescription}. Success: ${successes}, Failures: ${failures}.`;
    console.log(`API /raw-command: ${message}`);

    // Return overall success, maybe include details later if needed
    return NextResponse.json({ message });

  } catch (error: any) {
    console.error('Error in /api/lights/raw-command:', error);
    const errorMessage = error instanceof SyntaxError ? "Invalid JSON body" : (error.message || "Unknown error");
    return NextResponse.json({ error: `Failed: ${errorMessage}` }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
} 