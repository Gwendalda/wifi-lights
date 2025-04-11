import { NextResponse, NextRequest } from "next/server";

import { setDeviceTemperatureAll } from "@/lib/lights";

/**
 * API Route to set the color temperature of specified lights (or all).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate kelvin temperature
    if (!body || typeof body.kelvin !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid kelvin temperature in request body" },
        { status: 400 },
      );
    }
    const kelvin: number = body.kelvin;

    // Basic Kelvin range validation (approx 2000K to 6500K, corresponding to Tasmota mireds 153-500)
    if (kelvin < 2000 || kelvin > 6500) {
      return NextResponse.json(
        { error: "Invalid kelvin value. Must be between 2000 and 6500." },
        { status: 400 },
      );
    }

    // Validate optional deviceIds
    let deviceIds: string[] | undefined = undefined;

    if (body.deviceIds) {
      if (
        Array.isArray(body.deviceIds) &&
        body.deviceIds.every((id: any) => typeof id === "string")
      ) {
        deviceIds = body.deviceIds;
      } else {
        return NextResponse.json(
          { error: "Invalid deviceIds format. Must be an array of strings." },
          { status: 400 },
        );
      }
    }

    console.log(
      `API /temperature: Setting temperature to ${kelvin}K for ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`,
    );
    // Use the new function from lib/lights
    await setDeviceTemperatureAll(kelvin, deviceIds);

    const message = deviceIds
      ? `Temperature set to ${kelvin}K for specified devices (${deviceIds.join(", ")})`
      : `Temperature set to ${kelvin}K for all devices`;

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    console.error("API /temperature error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to set temperature: ${errorMessage}` },
      { status: 500 },
    );
  }
}
