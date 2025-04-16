import { NextResponse, NextRequest } from "next/server";

import { setDeviceColorAll } from "@/lib/lights";

/**
 * API Route to set the color of specified lights (or all).
 * Accepts optional `deviceIds` array.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // --- Validate hexColor (Required) ---
    if (!body || typeof body.hexColor !== "string") {
      return NextResponse.json({ error: "Missing hexColor" }, { status: 400 });
    }
    const hexColor: string = body.hexColor;
    if (!/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
      return NextResponse.json({ error: "Invalid hexColor format." }, { status: 400 });
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
      `API /color: Setting color=${hexColor} for ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`,
    );

    // Call library function without fade/speed
    await setDeviceColorAll(hexColor, deviceIds);

    const message = deviceIds
      ? `Color set to ${hexColor} for specified devices (${deviceIds.join(", ")})`
      : `Color set to ${hexColor} for all devices`;

    return NextResponse.json({ message }, { status: 200 });
  } catch (error: any) {
    console.error("API /color error:", error);
    const errorMessage = error instanceof SyntaxError ? "Invalid JSON body" : (error.message || "Unknown error");
    return NextResponse.json({ error: `Failed to set color: ${errorMessage}` }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}
