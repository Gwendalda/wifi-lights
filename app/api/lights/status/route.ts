import { NextResponse } from "next/server";

import { readDevicesFromFile, BulbDeviceData } from "@/lib/lights";

/**
 * API Route to get the last known status of all registered devices.
 * Reads data from the devices.json file.
 */
export async function GET() {
  try {
    const devices: BulbDeviceData[] = await readDevicesFromFile();

    // We return the data read from the file, which includes the 'last_status'
    return NextResponse.json({ devices }, { status: 200 });
  } catch (error) {
    console.error("API /status error: Failed to read devices file:", error);

    return NextResponse.json(
      { error: "Failed to retrieve device statuses" },
      { status: 500 },
    );
  }
}
