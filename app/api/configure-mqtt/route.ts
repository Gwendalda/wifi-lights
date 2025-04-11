import fs from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";
// import { Device } from "@/types/device"; // Removed import

// Define Device type locally based on devices.json structure
interface Device {
  id: number;
  ip: string;
  pins: { [key: string]: { type: string; channel: number } };
  last_status?: { [key: string]: any }; // Make last_status optional and flexible
}

const MQTT_BROKER_HOST = "10.0.0.195";
const MQTT_BROKER_PORT = 1883;
const MQTT_GROUP = "bekens_t";

export async function GET() {
  try {
    const devicesFilePath = path.join(process.cwd(), "devices.json");
    const data = await fs.readFile(devicesFilePath, "utf-8");
    const devices: Device[] = JSON.parse(data);

    const results = [];

    for (const device of devices) {
      const ip = device.ip;
      const ipParts = ip.split(".");

      if (ipParts.length !== 4) {
        console.error(`Invalid IP format for device ${device.id}: ${ip}`);
        results.push({ ip, status: "error", message: "Invalid IP format" });
        continue;
      }
      const client = `spot_${ipParts[3]}`; // Use last digits of IP for client ID

      const url = `http://${ip}/cfg_mqtt_set?host=${MQTT_BROKER_HOST}&port=${MQTT_BROKER_PORT}&client=${client}&group=${MQTT_GROUP}&user=Gwendal&password=Jsnl5m01!`;

      console.log(`Configuring MQTT for ${ip} (${client}) via URL: ${url}`);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", // Simplified headers
          },
          // Add a timeout if needed, e.g., using AbortController
        });

        if (response.ok) {
          console.log(`Successfully configured MQTT for ${ip}`);
          results.push({ ip, status: "success" });
        } else {
          console.error(
            `Failed to configure MQTT for ${ip}. Status: ${response.status}`,
          );
          results.push({
            ip,
            status: "error",
            message: `HTTP error ${response.status}`,
          });
        }
      } catch (error) {
        console.error(`Error configuring MQTT for ${ip}:`, error);
        results.push({
          ip,
          status: "error",
          message: (error as Error).message || "Network error",
        });
      }
    }

    return NextResponse.json({
      message: "MQTT configuration attempt finished.",
      results,
    });
  } catch (error) {
    console.error("Error reading devices file or processing request:", error);

    return NextResponse.json(
      {
        message: "Failed to process MQTT configuration request.",
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
