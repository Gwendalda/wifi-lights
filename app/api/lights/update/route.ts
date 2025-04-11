import { NextRequest, NextResponse } from "next/server";

import { turnOnAllDevices, turnOffAllDevices } from "@/lib/lights"; // Assuming @ alias is set up for lib

/**
 * API Route to handle state updates triggered by the ESP32 (e.g., button press).
 * Replicates the functionality of the original Flask /update endpoint.
 * Expects GET requests with 'pin' and 'state' query parameters.
 */
export async function GET(request: NextRequest) {
  // Ensure this path alias matches your tsconfig.json
  const searchParams = request.nextUrl.searchParams;
  const pin = searchParams.get("pin");
  const state = searchParams.get("state");

  console.log(`API /api/lights/update received: pin=${pin}, state=${state}`); // Server-side log

  if (pin === null || state === null || (state !== "0" && state !== "1")) {
    console.error(
      "API /api/lights/update error: Invalid or missing pin/state parameters.",
    );

    return NextResponse.json(
      { error: "Invalid or missing pin/state parameters" },
      { status: 400 },
    );
  }

  try {
    if (state === "1") {
      console.log("API /api/lights/update: Turning all devices ON");
      await turnOnAllDevices();
    } else {
      console.log("API /api/lights/update: Turning all devices OFF");
      await turnOffAllDevices();
    }
    console.log("API /api/lights/update: Action completed successfully.");

    return NextResponse.json(
      { message: "Button press processed" },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "API /api/lights/update error: Failed to process button press:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to process button press" },
      { status: 500 },
    );
  }
}
