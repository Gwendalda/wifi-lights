import { NextResponse, NextRequest } from "next/server";

import { turnOffAllDevices } from "@/lib/lights";

/**
 * API Route to turn specified lights (or all) OFF.
 * Accepts optional `deviceIds` array.
 */
export async function POST(request: NextRequest) {
  try {
    let deviceIds: string[] | undefined = undefined;

    try {
      const body = await request.json();
      // --- Validate deviceIds (Optional) ---
      if (body.deviceIds) {
        if (Array.isArray(body.deviceIds) && body.deviceIds.every((id: any) => typeof id === 'string')) {
          deviceIds = body.deviceIds;
        } else {
          console.warn("API /off: Invalid deviceIds format received, ignoring.");
        }
      }
    } catch (e) {
        console.log("API /off: No valid JSON body found, using defaults (all devices).");
    }

    console.log(
        `API /off: Turning off devices for ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`,
    );

    // Call library function without fade/speed
    await turnOffAllDevices(deviceIds);

    const message = deviceIds
      ? `Specified devices (${deviceIds.join(", ")}) turned OFF`
      : "All devices turned OFF";

    return NextResponse.json({ message }, { status: 200 });
  } catch (error: any) {
    console.error("API /off error:", error);
    const errorMessage = error.message || "Unknown error";
    return NextResponse.json({ error: `Failed to turn off devices: ${errorMessage}` }, { status: 500 });
  }
}
