import { NextResponse, NextRequest } from "next/server";

import { turnOnAllDevices } from "@/lib/lights";

/**
 * API Route to turn specified lights (or all) ON.
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
          console.warn("API /on: Invalid deviceIds format received, ignoring.");
        }
      }
    } catch (e) {
      console.log("API /on: No valid JSON body found, using defaults (all devices).");
    }

    console.log(
      `API /on: Turning on devices for ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`,
    );

    // Call library function without fade/speed
    await turnOnAllDevices(deviceIds);

    const message = deviceIds
      ? `Specified devices (${deviceIds.join(", ")}) turned ON`
      : "All devices turned ON";

    return NextResponse.json({ message }, { status: 200 });
  } catch (error: any) {
    console.error("API /on error:", error);
    const errorMessage = error.message || "Unknown error";
    return NextResponse.json({ error: `Failed to turn on devices: ${errorMessage}` }, { status: 500 });
  }
}
