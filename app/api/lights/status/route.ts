import { NextResponse } from "next/server";

import { getAllDevices, LightDeviceData as BulbDeviceData } from "@/lib/lights";

/**
 * API Route to get the last known status of all registered devices.
 * Reads data from the devices.json file.
 */
export async function GET() {
  try {
    const devices: BulbDeviceData[] = await getAllDevices();

    // We return the data read from the file, which includes the 'last_status'
    return NextResponse.json({ devices }, { status: 200 });
  } catch (error: any) {
    console.error("[API /api/lights/status] Error reading devices:", error);
    return NextResponse.json(
      { error: "Failed to read device status.", details: error.message },
      { status: 500 }
    );
  }
}
