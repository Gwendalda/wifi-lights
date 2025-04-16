import { NextResponse, NextRequest } from "next/server";

import { setDeviceTemperatureAll } from "@/lib/lights";

/**
 * API Route to set the color temperature of specified lights (or all).
 * Accepts optional `deviceIds` array.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // --- Validate kelvin (Required) ---
    if (!body || typeof body.kelvin !== "number") {
      return NextResponse.json({ error: "Missing kelvin temperature" }, { status: 400 });
    }
    const kelvin: number = body.kelvin;
    if (kelvin < 2000 || kelvin > 6500) {
      return NextResponse.json({ error: "Invalid kelvin value (2000-6500)." }, { status: 400 });
    }

    // --- Validate deviceIds (Optional) ---
    let deviceIds: string[] | undefined = undefined;
    if (body.deviceIds) {
      if (Array.isArray(body.deviceIds) && body.deviceIds.every((id: any) => typeof id === 'string')) {
        deviceIds = body.deviceIds;
      } else {
        return NextResponse.json({ error: "Invalid deviceIds format." }, { status: 400 });
      }
    }

    console.log(
      `API /temperature: Setting kelvin=${kelvin} for ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`,
    );

    // Call library function without fade/speed
    await setDeviceTemperatureAll(kelvin, deviceIds);

    const message = deviceIds
      ? `Temperature set to ${kelvin}K for specified devices (${deviceIds.join(", ")})`
      : `Temperature set to ${kelvin}K for all devices`;

    return NextResponse.json({ message }, { status: 200 });
  } catch (error: any) {
    console.error("API /temperature error:", error);
    const errorMessage = error instanceof SyntaxError ? "Invalid JSON body" : (error.message || "Unknown error");
    return NextResponse.json({ error: `Failed to set temperature: ${errorMessage}` }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}
