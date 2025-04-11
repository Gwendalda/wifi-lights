import { NextResponse, NextRequest } from "next/server";

import { turnOnAllDevices } from "@/lib/lights";

/**
 * API Route to turn specified lights (or all) ON.
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
      // Ignore error if body is empty or not valid JSON, proceed with turning all on
      console.log("API /on: No valid deviceIds in body, turning all on.");
    }

    console.log(
      `API /on: Turning ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"} ON`,
    );
    await turnOnAllDevices(deviceIds);
    const message = deviceIds
      ? `Specified devices (${deviceIds.join(", ")}) turned ON`
      : "All devices turned ON";

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    console.error("API /on error:", error);
    // Provide a more specific error message if possible
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to turn on devices: ${errorMessage}` },
      { status: 500 },
    );
  }
}
