import { NextResponse, NextRequest } from "next/server";

import { setDeviceColorAll } from "@/lib/lights";

/**
 * API Route to set the color of specified lights (or all).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate hexColor
    if (!body || typeof body.hexColor !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid hexColor in request body" },
        { status: 400 },
      );
    }
    const hexColor: string = body.hexColor;

    // Basic hex color validation (starts with #, 3 or 6 hex digits)
    if (!/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
      return NextResponse.json(
        { error: "Invalid hexColor format. Use #RGB or #RRGGBB." },
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
          {
            error:
              "Invalid deviceIds format in request body. Must be an array of strings.",
          },
          { status: 400 },
        );
      }
    }

    console.log(
      `API /color: Setting color to ${hexColor} for ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`,
    );
    await setDeviceColorAll(hexColor, deviceIds); // Pass hexColor and deviceIds

    const message = deviceIds
      ? `Color set to ${hexColor} for specified devices (${deviceIds.join(", ")})`
      : `Color set to ${hexColor} for all devices`;

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    console.error("API /color error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Failed to set color: ${errorMessage}` },
      { status: 500 },
    );
  }
}
