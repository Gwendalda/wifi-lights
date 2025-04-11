import { NextResponse, NextRequest } from "next/server";

import { turnOffAllDevices } from "@/lib/lights";

/**
 * API Route to turn specified lights (or all) OFF.
 */
export async function POST(request: NextRequest) {
  try {
    let deviceIds: string[] | undefined = undefined;

    try {
      // Try to parse body, but handle cases where it might be empty or invalid JSON
      const body = await request.json();

      if (
        body &&
        Array.isArray(body.deviceIds) &&
        body.deviceIds.every((id: any) => typeof id === "string")
      ) {
        deviceIds = body.deviceIds;
      }
    } catch (e) {
      // Ignore error if body is empty or not valid JSON, proceed with turning all off
      console.log("API /off: No valid deviceIds in body, turning all off.");
    }

    console.log(
      `API /off: Turning ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"} OFF`,
    );
    await turnOffAllDevices(deviceIds);
    const message = deviceIds
      ? `Specified devices (${deviceIds.join(", ")}) turned OFF`
      : "All devices turned OFF";

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    console.error("API /off error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to turn off devices: ${errorMessage}` },
      { status: 500 },
    );
  }
}
