import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DEVICES_FILE_PATH = path.join(process.cwd(), "devices.json");

export async function GET() {
  try {
    const data = await fs.readFile(DEVICES_FILE_PATH, "utf-8");
    const devices = JSON.parse(data);
    return NextResponse.json({ devices });
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return NextResponse.json({ devices: [] });
    }
    console.error("Error reading devices file:", error);
    return NextResponse.json({ error: "Failed to read devices" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const devices = await request.json();
    const data = JSON.stringify(devices, null, 2);
    await fs.writeFile(DEVICES_FILE_PATH, data, "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error writing devices file:", error);
    return NextResponse.json({ error: "Failed to write devices" }, { status: 500 });
  }
} 