import fs from "fs/promises";
import path from "path";

// --- Types ---
export interface BulbStatus {
  power?: "ON" | "OFF";
  color?: string; // Hex e.g., "FF0000" - This is Tasmota's STATE color, not the command Color
  red?: number;
  green?: number;
  blue?: number;
  brightness?: number; // Percentage 0-100? (Potentially redundant with Dimmer)
  temperature?: number; // Original field, maybe keep if different from CT/Kelvin?
  // Tasmota specific fields from STATE message
  Dimmer?: number; // Tasmota brightness (0-100)
  CT?: number; // Tasmota color temp (mireds: 153-500)
  Fade?: "ON" | "OFF"; // Fade status
  Speed?: number; // Transition speed (1-40)
  Color?: string; // Tasmota Color field (R,G,B,CW,WW string)
  HSBColor?: string; // Hue,Saturation,Brightness string "H,S,B"
  Channel?: number[]; // PWM Channel values [R, G, B] or [R, G, B, CW, WW]
  Channel1?: number; // Added for direct channel control
  Channel2?: number; // Added for direct channel control
  Channel3?: number; // Added for direct channel control
  Channel4?: number; // Added for direct channel control
  Channel5?: number; // Added for direct channel control
}

export interface BulbDeviceData {
  id: string;
  ip: string;
  last_status: Partial<BulbStatus>; // Status can be partial
}

// --- Constants ---
const DEVICES_FILE_PATH = path.join(process.cwd(), "devices.json");
const WRITE_DEBOUNCE_MS = 1000; // Wait 1 second after last update to write

// --- Cache ---
let devicesCache: BulbDeviceData[] | null = null;
let devicesCachePromise: Promise<BulbDeviceData[]> | null = null;
let deviceIpSuffixToIdMap: { [ipSuffix: string]: string } = {};
let writeTimeoutId: NodeJS.Timeout | null = null;

/**
 * (FOR TESTING ONLY) Resets the internal cache and state variables.
 */
export function _resetDeviceStateForTest(): void {
    console.log("--- RESETTING DEVICE STATE FOR TEST ---");
    devicesCache = null;
    devicesCachePromise = null;
    deviceIpSuffixToIdMap = {};
    if (writeTimeoutId) {
        clearTimeout(writeTimeoutId);
        writeTimeoutId = null;
    }
}

/**
 * Loads device configurations from devices.json, initializes the cache,
 * and builds the IP suffix to device ID map.
 */
async function loadDevicesAndInitializeCache(): Promise<BulbDeviceData[]> {
  if (devicesCache) {
    return devicesCache;
  }
  if (devicesCachePromise) {
    return devicesCachePromise;
  }

  devicesCachePromise = (async () => {
    console.log("[Devices] Loading devices from file...");
    try {
      const data = await fs.readFile(DEVICES_FILE_PATH, "utf-8");
      const loadedDevices = JSON.parse(data) as BulbDeviceData[];

      // Ensure last_status exists
      devicesCache = loadedDevices.map((device) => ({
        ...device,
        last_status: device.last_status || {},
      }));

      // Rebuild the IP suffix map
      deviceIpSuffixToIdMap = {};
      devicesCache.forEach((device) => {
        const ipParts = device.ip.split(".");

        if (ipParts.length === 4) {
          deviceIpSuffixToIdMap[ipParts[3]] = device.id;
        } else {
          console.warn(
            `[Devices] Invalid IP format for device ${device.id}: ${device.ip}. Cannot map MQTT ID.`,
          );
        }
      });
      console.log(
        `[Devices] Loaded ${devicesCache.length} devices. IP Suffix Map Keys:`,
        Object.keys(deviceIpSuffixToIdMap),
      );
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.warn(
          `[Devices] ${DEVICES_FILE_PATH} not found. Initializing with empty device list.`,
        );
        devicesCache = [];
        deviceIpSuffixToIdMap = {};
      } else {
        console.error("[Devices] Error reading devices file:", error);
        devicesCache = []; // Default to empty on other errors
        deviceIpSuffixToIdMap = {};
        throw error;
      }
    } finally {
      devicesCachePromise = null;
    }
    return devicesCache;
  })();

  return devicesCachePromise;
}

/**
 * Writes the current device cache state to devices.json.
 * Should be used internally after status updates.
 */
async function writeDevicesToFileInternal(): Promise<void> {
  if (!devicesCache) {
    console.error("[Devices] Attempted to write null cache to file. Aborting write.");
    return;
  }
  const dataToWrite = [...devicesCache];
  console.log(`[Devices] Writing ${dataToWrite.length} devices to ${DEVICES_FILE_PATH}...`);
  try {
    const data = JSON.stringify(dataToWrite, null, 2);
    await fs.writeFile(DEVICES_FILE_PATH, data, "utf-8");
    console.log(`[Devices] Successfully wrote to ${DEVICES_FILE_PATH}`);
  } catch (error) {
    console.error("[Devices] Error writing devices file:", error);
  }
}

/**
 * Schedules a debounced write to the devices.json file.
 */
function scheduleDebouncedWrite(): void {
  if (writeTimeoutId) {
    clearTimeout(writeTimeoutId);
  }
  writeTimeoutId = setTimeout(async () => {
    await writeDevicesToFileInternal();
    writeTimeoutId = null;
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Immediately writes the current cache state to the file, bypassing debounce.
 * Useful for shutdown scenarios.
 */
export async function forceWriteDevicesToFile(): Promise<void> {
  if (writeTimeoutId) {
    clearTimeout(writeTimeoutId);
    writeTimeoutId = null;
  }
  console.log("[Devices] Forcing immediate write to file...");
  await writeDevicesToFileInternal();
}

// --- Public API ---

/**
 * Retrieves the cached list of devices. Ensures devices are loaded first if needed.
 * @returns A promise that resolves to the array of BulbDeviceData.
 */
export async function getDevices(): Promise<BulbDeviceData[]> {
  return loadDevicesAndInitializeCache();
}

/**
 * Finds a device ID based on its MQTT topic suffix (e.g., "spot_XXX").
 * Assumes the cache and map have been initialized.
 * @param topic The full MQTT topic string.
 * @returns The device ID string, or null if not found.
 */
export function getDeviceIdFromTopic(topic: string): string | null {
  if (Object.keys(deviceIpSuffixToIdMap).length === 0) {
    console.warn("[Devices] Attempted getDeviceIdFromTopic before device map was initialized.");
    return null;
  }
  const parts = topic.split("/");
  if (parts.length >= 2 && parts[1].startsWith("spot_")) {
    const ipSuffix = parts[1].substring(5);
    const deviceId = deviceIpSuffixToIdMap[ipSuffix];
    if (deviceId) {
      return deviceId;
    }
  }
  return null;
}

/**
 * Updates the last known status of a device in the cache and schedules persistence.
 */
export async function updateDeviceStatus(
  deviceId: string,
  newStatus: Partial<BulbStatus>,
): Promise<void> {
  const devices = await loadDevicesAndInitializeCache();
  const deviceIndex = devices.findIndex((d) => d.id === deviceId);
  if (deviceIndex === -1) {
    console.warn(`[Devices] Device ${deviceId} not found for status update. Ignoring.`);
    return;
  }
  devices[deviceIndex].last_status = {
    ...(devices[deviceIndex].last_status || {}),
    ...newStatus,
  };
  console.log(`[Devices Cache Update] New Status for ${deviceId}:`, devices[deviceIndex].last_status);
  scheduleDebouncedWrite();
}

/**
 * Retrieves a single device by its ID from the cache.
 * @param deviceId The ID of the device.
 * @returns The BulbDeviceData or undefined if not found.
 */
export async function getDeviceById(
  deviceId: string,
): Promise<BulbDeviceData | undefined> {
  const devices = await getDevices();
  return devices.find((d) => d.id === deviceId);
}

/**
 * Retrieves all known device IDs from the cache.
 * @returns A promise that resolves to an array of device ID strings.
 */
export async function getAllDeviceIds(): Promise<string[]> {
  const devices = await getDevices();
  return devices.map((d) => d.id);
}

/**
 * Generates the Tasmota MQTT device identifier (e.g., "spot_21") from device data.
 * @param device The device data object.
 * @returns The Tasmota MQTT ID string (e.g., "spot_123").
 */
export function getDeviceMqttId(device: BulbDeviceData): string {
  const ipParts = device.ip.split('.');
  if (ipParts.length !== 4 || !/^[0-9]+$/.test(ipParts[3])) {
    console.warn(`[Devices] Invalid IP format for device ${device.id}: ${device.ip}.`);
    return `spot_invalid_${device.id}`;
  }
  return `spot_${ipParts[3]}`;
}

// Add handler for graceful shutdown to ensure pending writes are flushed
if (!process.listeners("SIGINT").some((l) => l.name === "bound devicesShutdownHandler")) {
  const devicesShutdownHandler = async () => {
    console.log("[Devices] SIGINT received. Checking for pending writes...");
    if (writeTimeoutId) {
      await forceWriteDevicesToFile();
    }
  };
  process.prependListener("SIGINT", devicesShutdownHandler);
}
