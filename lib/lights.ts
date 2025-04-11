import fs from 'fs/promises';
import path from 'path';
import mqtt from 'mqtt'; // Import mqtt library

// Define the structure for device data and status
interface BulbStatus {
  power?: 'ON' | 'OFF'; // Added power state
  color?: string; // Store color as hex string e.g., "FF0000"
  red?: number; // Keep raw RGB for potential use, but prioritize 'color'
  green?: number;
  blue?: number;
  brightness?: number;
  temperature?: number; // Color temperature (if applicable)
  Dimmer?: number; // Tasmota uses Dimmer for brightness (0-100)
  CT?: number; // Tasmota uses CT for color temperature (mireds)
  kelvinTemperature?: number; // Renamed to avoid conflicts
}

interface BulbDeviceData {
  id: string;
  ip: string;
  // Make last_status potentially partial initially
  last_status: Partial<BulbStatus>;
}

const DEVICES_FILE_PATH = path.join(process.cwd(), 'devices.json'); // Assumes devices.json is in the project root

// --- MQTT Configuration ---
const MQTT_BROKER_URL = 'mqtt://10.0.0.195:1883';
const MQTT_CLIENT_ID = `wifi-lights-server-${Math.random().toString(16).substring(2, 8)}`; // Unique client ID
const MQTT_CONNECT_OPTIONS: mqtt.IClientOptions = {
  clientId: MQTT_CLIENT_ID,
  // Add username/password here if needed
  username: process.env.MQTT_USERNAME, // Read from environment variable
  password: process.env.MQTT_PASSWORD, // Read from environment variable
  connectTimeout: 5000, // 5 seconds
  reconnectPeriod: 1000, // Try reconnecting every second if disconnected
};

// --- Assumed Channel Mapping (Based on common RGBWWC setups) ---
const CHANNEL_RED = 1;
const CHANNEL_GREEN = 2;
const CHANNEL_BLUE = 3;
const CHANNEL_WARM_WHITE = 4;
const CHANNEL_COLD_WHITE = 5;
// Brightness might be controlled globally via a command, or by scaling RGB/W values.
// Temperature is controlled by mixing warm/cold white.

// Keep track of devices in memory to avoid excessive file reads/writes
let devicesCache: BulbDeviceData[] | null = null;
let devicesCachePromise: Promise<BulbDeviceData[]> | null = null; // To handle concurrent reads

// --- Device ID to MQTT ID Mapping ---
// Store this mapping for quick lookup in the message handler
let deviceIpSuffixToIdMap: { [ipSuffix: string]: string } = {};

async function loadDevicesAndInitializeCache(): Promise<BulbDeviceData[]> {
    if (devicesCache) {
        return devicesCache;
    }
    // If a load is already in progress, wait for it
    if (devicesCachePromise) {
        return devicesCachePromise;
    }

    devicesCachePromise = (async () => {
        console.log("Loading devices from file...");
        try {
            const data = await fs.readFile(DEVICES_FILE_PATH, 'utf-8');
            devicesCache = JSON.parse(data) as BulbDeviceData[];
            // Rebuild the IP suffix map whenever devices are loaded/reloaded
            deviceIpSuffixToIdMap = {};
            devicesCache.forEach(device => {
                const ipParts = device.ip.split('.');
                if (ipParts.length === 4) {
                    deviceIpSuffixToIdMap[ipParts[3]] = device.id;
                } else {
                    console.warn(`Invalid IP format for device ${device.id}: ${device.ip}. Cannot map MQTT ID.`);
                }
            });
            console.log(`Loaded ${devicesCache.length} devices. IP Suffix Map:`, deviceIpSuffixToIdMap);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.warn(`${DEVICES_FILE_PATH} not found. Initializing with empty device list.`);
                devicesCache = [];
            } else {
                console.error("Error reading devices file:", error);
                devicesCache = []; // Default to empty on other errors
                throw error; // Re-throw other errors
            }
        } finally {
            devicesCachePromise = null; // Reset promise after completion/error
        }
        return devicesCache;
    })();
    return devicesCachePromise;
}

// --- MQTT Client Instance ---
let mqttClient: mqtt.MqttClient | null = null;
let connectionPromise: Promise<mqtt.MqttClient> | null = null;
let isConnecting = false;
let handlersAttached = false; // Flag to ensure handlers are attached only once

// Function to attach persistent event handlers
function attachEventHandlers(client: mqtt.MqttClient) {
    if (handlersAttached) return; // Allow re-attaching just in case, though should be safe

    console.log("Attaching MQTT event handlers...");

    // Remove existing listener first to prevent duplicates if re-attaching
    client.removeAllListeners('message'); 
    client.on('message', (topic, payload) => {
        handleMqttMessage(topic, payload);
    });

    client.on('reconnect', () => {
      console.log('MQTT Event: reconnect - Client reconnecting...');
       isConnecting = true; // Mark as connecting during reconnect attempts
    });

    client.on('close', () => {
      console.log('MQTT Event: close - Client disconnected.');
      // Clear client and related state on close
      mqttClient = null;
      connectionPromise = null;
      isConnecting = false;
      // handlersAttached = false; // Keep handlers attached conceptually, but client is gone
    });

    client.on('offline', () => {
      console.log('MQTT Event: offline - Client went offline.');
       // Clear client and related state on offline
       mqttClient = null;
       connectionPromise = null;
       isConnecting = false;
    });

    client.on('error', (error) => {
      console.error('MQTT Event: error - Client error:', error);
      // Clear client and related state on error
       if (mqttClient) {
         try { mqttClient.end(true); } catch (e) { console.error("Error ending MQTT client after error:", e);}
       }
      mqttClient = null;
      connectionPromise = null; // Ensure promise is cleared on error
      isConnecting = false;
    });

     // Handle graceful shutdown
    process.on('SIGINT', () => {
        if (mqttClient) {
            console.log("SIGINT received, disconnecting MQTT client...");
            mqttClient.end(true, () => { // Force close and provide callback
                console.log('MQTT client disconnected on app termination');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });

    handlersAttached = true;
}

function getMqttClient(): Promise<mqtt.MqttClient> {
  // If already connected, return immediately
  if (mqttClient && mqttClient.connected) {
    return Promise.resolve(mqttClient);
  }

  // If a connection is already in progress, return the existing promise
  if (isConnecting && connectionPromise) {
     console.log("Connection already in progress, returning existing promise.");
    return connectionPromise;
  }

  // If client exists but is not connected and not trying to reconnect, force end
  if (mqttClient && !mqttClient.connected && !mqttClient.reconnecting) {
      console.log("Client exists but is disconnected and not reconnecting, ending it.");
      try {
          mqttClient.end(true); // Force close cleanly
      } catch(e) { console.error("Error ending disconnected client:", e); }
       mqttClient = null;
       handlersAttached = false; // Allow re-attaching handlers
   }

  // Initiate new connection attempt
   isConnecting = true;
  console.log(`Initiating new MQTT connection to ${MQTT_BROKER_URL}...`);

  // Create the promise that callers will wait on
  connectionPromise = new Promise((resolve, reject) => {
    // Create new client instance
    const newClient = mqtt.connect(MQTT_BROKER_URL, MQTT_CONNECT_OPTIONS);
    mqttClient = newClient; // Assign globally immediately

     // Attach persistent handlers if not already done (should only happen once)
     attachEventHandlers(newClient);

    // --- Handlers specific to THIS connection attempt --- 
    const connectHandler = async () => {
        console.log(`MQTT client connected: ${MQTT_CLIENT_ID}`);
         isConnecting = false;
         // Remove temporary handlers for this attempt
         newClient.removeListener('error', errorHandler);
          // Re-attach message handler here as well to be extra safe
          console.log("Re-attaching message handler post-connect...");
          newClient.removeAllListeners('message'); // Remove first
          newClient.on('message', (topic, payload) => {
              handleMqttMessage(topic, payload);
          });
          // Subscribe
          try {
              console.log("Attempting subscriptions...");
              await newClient.subscribeAsync('stat/+/POWER');
              console.log('MQTT: Subscribed to stat/+/POWER');
              await newClient.subscribeAsync('tele/+/STATE');
              console.log('MQTT: Subscribed to tele/+/STATE');
              resolve(newClient); // Resolve the promise ONCE connected and subscribed
          } catch (subError) {
              console.error("MQTT subscription error during connect:", subError);
              // Attempt to close client on subscription error
               try { newClient.end(true); } catch (e) { console.error("Error ending client after sub error:", e); }
               mqttClient = null;
               connectionPromise = null;
               isConnecting = false;
              reject(subError); // Reject the promise on subscription error
          }
    };

     const errorHandler = (error: Error) => {
         console.error('MQTT connection error during initial connect:', error);
         isConnecting = false;
          // Remove temporary handlers for this attempt
         newClient.removeListener('connect', connectHandler);
         // Ensure client is nullified
          if (mqttClient === newClient) {
              mqttClient = null;
              connectionPromise = null; // Clear promise
          }
          try { newClient.end(true); } catch (e) { /* Ignore */ }
         reject(error); // Reject the promise on connection error
     };

    // Attach temporary handlers for this specific connection attempt
    newClient.once('connect', connectHandler);
    newClient.once('error', errorHandler);

    // Note: We don't reject on 'close' or 'offline' here because the 
    // persistent handlers attached via attachEventHandlers will clear 
    // the global mqttClient state, causing subsequent calls to getMqttClient 
    // to initiate a new connection attempt.

  });

  return connectionPromise;
}

// --- MQTT Publish Helper --- (Now waits for connection)
async function publishMqttMessage(topic: string, message: string | Buffer): Promise<void> {
    try {
        const client = await getMqttClient(); // Wait for a connected client
         if (!client || !client.connected) { // Double check, though promise should ensure connection
            console.error(`MQTT client became disconnected unexpectedly before publishing to ${topic}`);
            throw new Error('MQTT client disconnected unexpectedly');
        }
        // console.log(`MQTT PUB: ${topic} -> ${message}`); // Debug log
        await client.publishAsync(topic, message);
    } catch (error) {
        console.error(`Failed to get connected client or publish MQTT message to ${topic}:`, error);
        throw error; // Re-throw to be handled by caller
    }
}

// Helper function to get the MQTT device identifier (e.g., "spot_21")
function getDeviceMqttId(device: BulbDeviceData): string {
    const ipParts = device.ip.split('.');
    if (ipParts.length !== 4) {
        console.warn(`Invalid IP format for device ${device.id}: ${device.ip}. Cannot generate MQTT ID.`);
        // Return a default or throw an error, depending on desired handling
        return `spot_unknown_${device.id}`; // Or throw new Error(...)
    }
    return `spot_${ipParts[3]}`;
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null;
}

// --- File Operations ---

// readDevicesFromFile now uses the cache
async function readDevicesFromFile(): Promise<BulbDeviceData[]> {
  return await loadDevicesAndInitializeCache();
}

async function writeDevicesToFile(devices: BulbDeviceData[]): Promise<void> {
  try {
    const data = JSON.stringify(devices, null, 2); // Pretty print JSON
    await fs.writeFile(DEVICES_FILE_PATH, data, 'utf-8');
  } catch (error) {
    console.error("Error writing devices file:", error);
    throw error;
  }
}

// Ensure devices are loaded before starting MQTT
loadDevicesAndInitializeCache().then(() => {
    getMqttClient(); // Initialize MQTT connection after devices are loaded
}).catch(error => {
    console.error("Failed to initialize device cache:", error);
    // Decide how to handle this - maybe exit or try again?
});

// --- MQTT Message Handler Logic ---
async function handleMqttMessage(topic: string, payload: Buffer): Promise<void> {
    console.log(`[MQTT MSG Received] Topic: ${topic}`); // Log raw message receipt
    const message = payload.toString();
    const deviceId = getDeviceIdFromTopic(topic);

    if (!deviceId) {
        // console.log(`Ignoring message from unknown device topic: ${topic}`);
        return;
    }

    // console.log(`Handling MQTT message for device ${deviceId} from topic ${topic}`); // Debug

    let statusUpdate: Partial<BulbStatus> = {};

    if (topic.endsWith('/POWER')) {
        // Handle stat/+/POWER messages
        statusUpdate.power = message === 'ON' ? 'ON' : 'OFF';
        // Tasmota power ON might reset brightness to last non-zero value, OFF sets Dimmer to 0 conceptually
        // We can't know the exact brightness without a STATE update, but can infer power state
        if (statusUpdate.power === 'OFF') {
           statusUpdate.Dimmer = 0; // Assume brightness is 0 when off
        } else {
           // When turning ON, we don't know the previous brightness level yet,
           // wait for STATE update or assume a default? Let's wait.
        }
    } else if (topic.endsWith('/STATE')) {
        // Handle tele/+/STATE messages (JSON payload)
        try {
            const state = JSON.parse(message);
            // console.log(`Parsed STATE for ${deviceId}:`, state); // Debug
            statusUpdate.power = state.POWER === 'ON' ? 'ON' : 'OFF';
            statusUpdate.Dimmer = state.Dimmer; // Brightness 0-100
            statusUpdate.CT = state.CT; // Color Temp (mireds)
            // Tasmota state provides color as "RR,GG,BB" or "RR,GG,BB,WW" or "RR,GG,BB,WW,CW"
            // It also provides a single 'Color' field "RRGGBB[WW[CC]]"
            if (state.Color) {
                // Prefer the combined hex color string
                statusUpdate.color = state.Color.substring(0, 6); // Extract RRGGBB part
                 // Parse RGB from the main Color string if needed
                 if (statusUpdate.color) { // Ensure color is defined before parsing
                     const rgbInt = parseInt(statusUpdate.color, 16);
                     statusUpdate.red = (rgbInt >> 16) & 255;
                     statusUpdate.green = (rgbInt >> 8) & 255;
                     statusUpdate.blue = rgbInt & 255;
                 }
            }
            // Update other fields as needed from the state object
            // statusUpdate.temperature = ... // requires conversion from CT if needed
            statusUpdate.brightness = state.Dimmer; // Map Dimmer to brightness

        } catch (e) {
            console.error(`Failed to parse STATE JSON for topic ${topic}: ${message}`, e);
            return; // Don't update status if parse fails
        }
    } else if (topic.endsWith('/RESULT')) {
        // Handle stat/+/RESULT messages (often sent after commands)
        try {
            const result = JSON.parse(message);
            // console.log(`Parsed RESULT for ${deviceId}:`, result); // Debug

            // Extract status from the nested object if the command was 'Status X'
            // Or directly if the result contains the state (e.g., after a Power command)
            const state = result.Status || result.StatusSTS || result; // Check common Tasmota status objects

            if (state.POWER) {
                 statusUpdate.power = state.POWER === 'ON' ? 'ON' : 'OFF';
             }
            if (state.Dimmer !== undefined) {
                 statusUpdate.Dimmer = state.Dimmer;
                 statusUpdate.brightness = state.Dimmer; // Map Dimmer to brightness
             }
            if (state.CT !== undefined) {
                statusUpdate.CT = state.CT;
                // Optionally update kelvinTemperature if CT changes
                // statusUpdate.kelvinTemperature = Math.round(1000000 / state.CT);
             }
             if (state.Color) {
                 // Prefer the combined hex color string if available
                 const colorString = Array.isArray(state.Color) ? state.Color.join(',') : state.Color;
                 if (typeof colorString === 'string' && colorString.includes(',')) {
                     // If color is like "R,G,B[,W[,C]]", parse it
                     const parts = colorString.split(',').map(Number);
                     statusUpdate.red = parts[0];
                     statusUpdate.green = parts[1];
                     statusUpdate.blue = parts[2];
                     // Create hex string from RGB
                     statusUpdate.color = ((parts[0] << 16) + (parts[1] << 8) + parts[2]).toString(16).padStart(6, '0');
                 } else if (typeof colorString === 'string' && /^[0-9a-fA-F]{6,}/.test(colorString)) {
                      // If color is hex RRGGBB[WW[CC]]
                      statusUpdate.color = colorString.substring(0, 6);
                      const rgbInt = parseInt(statusUpdate.color, 16);
                      statusUpdate.red = (rgbInt >> 16) & 255;
                      statusUpdate.green = (rgbInt >> 8) & 255;
                      statusUpdate.blue = rgbInt & 255;
                 }
             }
             // Add other relevant fields from RESULT if needed

        } catch (e) {
            console.error(`Failed to parse RESULT JSON for topic ${topic}: ${message}`, e);
            // Don't update status if parse fails, but log the ignore
            console.log(`[MQTT MSG Ignored] Failed to parse RESULT JSON from topic: ${topic}`);
            return; // Exit early
        }
    }

    if (Object.keys(statusUpdate).length > 0) {
        console.log(`[Status Update Ready] Device: ${deviceId}, Update:`, statusUpdate); // Log the update object
        await updateDeviceLastStatus(deviceId, statusUpdate);
    } else {
        console.log(`[MQTT MSG Ignored] No relevant status found in message from topic: ${topic}`);
    }
}

// Helper function to find device ID from MQTT Topic (e.g., "stat/spot_21/POWER")
function getDeviceIdFromTopic(topic: string): string | null {
    // Assumes topic format like "type/spot_XXX/command"
    const parts = topic.split('/');
    if (parts.length >= 2 && parts[1].startsWith('spot_')) {
        const ipSuffix = parts[1].substring(5); // Extract "XXX" from "spot_XXX"
        const deviceId = deviceIpSuffixToIdMap[ipSuffix];
        if (deviceId) {
            return deviceId;
        } else {
            // console.warn(`No device ID found for IP suffix: ${ipSuffix} from topic: ${topic}`);
        }
    }
    return null;
}

// --- Device Control Logic --- REFACTORED FOR MQTT

// Helper to update the last_status in the devices.json file AND in the cache
async function updateDeviceLastStatus(deviceId: string, newStatus: Partial<BulbStatus>): Promise<void> {
    // Ensure cache is loaded before attempting update
    const devices = await loadDevicesAndInitializeCache();

    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    if (deviceIndex === -1) {
        // This might happen if a message arrives before the device is in devices.json
        // Or if the IP suffix mapping failed.
        console.warn(`Device with ID ${deviceId} not found in cache for status update. Ignoring.`);
        return;
    }

    console.log(`[Cache Update] Updating device: ${deviceId}. Current Status:`, devices[deviceIndex].last_status);
    console.log(`[Cache Update] Applying update:`, newStatus);

    // Merge partial new status with existing last_status in the cache
    // Create last_status object if it doesn't exist
    if (!devices[deviceIndex].last_status) {
         devices[deviceIndex].last_status = {};
    }
    devices[deviceIndex].last_status = { ...devices[deviceIndex].last_status, ...newStatus };

    console.log(`[Cache Update] New Status for ${deviceId}:`, devices[deviceIndex].last_status); // Log the final merged status

    // Asynchronously write the updated cache back to the file
    // No need to await this here, let it happen in the background
    // Consider adding throttling/debouncing if updates are very frequent
    writeDevicesToFile(devices).catch(error => {
        console.error(`Failed background write to devices.json for ${deviceId}:`, error);
        // Potential issue: If write fails, cache and file are desynced.
        // Could implement a retry mechanism or flag for inconsistency.
    });
}


/**
 * Sets the color of a device using Tasmota's `cmnd/.../Color` command.
 * @param device The device data.
 * @param hexColor The color in hex format (e.g., "#9c5e5e").
 */
async function setDeviceColor(device: BulbDeviceData, hexColor: string): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const colorValue = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor; // Remove leading #

    // Validate hex color format (basic check)
    if (!/^[0-9a-fA-F]{6}$/.test(colorValue)) {
         console.error(`Invalid hex color format: ${hexColor} for device ${device.id}`);
         return false;
     }

    const topic = `cmnd/${deviceMqttId}/Color`;
    const message = colorValue;

    console.log(`MQTT: Setting color for ${device.id} (${device.ip}) -> ${topic}: ${message}`);

    try {
        await publishMqttMessage(topic, message);
        // OPTIONAL: Optimistically update status cache immediately.
        // The actual status update should arrive via MQTT subscription shortly after.
        // await updateDeviceLastStatus(device.id, { color: colorValue });
        return true;
    } catch (error) {
        console.error(`Error in setDeviceColor for ${device.ip} via MQTT:`, error);
        return false;
    }
}


/**
 * Turns a specific device ON using MQTT command `cmnd/spot_<id>/Power 1`.
 * Note: This just turns the power on, it doesn't restore previous color/brightness.
 */
async function turnDeviceOn(device: BulbDeviceData): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const topic = `cmnd/${deviceMqttId}/Power`;
    const message = "1"; // 1 for ON

    console.log(`MQTT: Turning on device ${device.id} (${device.ip}) -> ${topic}: ${message}`);
    try {
        await publishMqttMessage(topic, message);
        // OPTIONAL: Optimistic update
        // await updateDeviceLastStatus(device.id, { power: 'ON' });
        return true;
    } catch (error) {
        console.error(`Error turning on device ${device.id} (${device.ip}) via MQTT:`, error);
        return false;
    }
}

/**
 * Turns a specific device OFF using MQTT command `cmnd/spot_<id>/Power 0`.
 */
async function turnDeviceOff(device: BulbDeviceData): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const topic = `cmnd/${deviceMqttId}/Power`;
    const message = "0"; // 0 for OFF

    console.log(`MQTT: Turning off device ${device.id} (${device.ip}) -> ${topic}: ${message}`);
    try {
        await publishMqttMessage(topic, message);
        // OPTIONAL: Optimistic update
        // await updateDeviceLastStatus(device.id, { power: 'OFF', Dimmer: 0, brightness: 0 });
        return true;
    } catch (error) {
        console.error(`Error turning off device ${device.id} (${device.ip}) via MQTT:`, error);
        return false;
    }
}


// --- Functions for Multiple Devices --- REFACTORED

/**
 * Turns on all specified devices (or all if none specified) concurrently by toggling.
 * @param deviceIds Optional array of device IDs. If omitted, applies to all devices.
 */
export async function turnOnAllDevices(deviceIds?: string[]): Promise<void> {
    console.log(`Turning on devices via MQTT: ${deviceIds ? deviceIds.join(', ') : 'All'}`);
    let devicesToControl = await readDevicesFromFile();
    if (deviceIds && deviceIds.length > 0) {
        devicesToControl = devicesToControl.filter(d => deviceIds.includes(d.id));
    }

    if (devicesToControl.length === 0) {
        console.warn("No matching devices found to turn on.");
        return;
    }

    const promises = devicesToControl.map(device => turnDeviceOn(device)); // Uses MQTT version
    try {
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
            const device = devicesToControl[index];
            if (result.status === 'rejected') {
                console.error(`Failed to turn on device ${device.id} (${device.ip}) via MQTT:`, result.reason);
            } else if (result.value === false) {
                 console.warn(`Command to turn on device ${device.id} (${device.ip}) via MQTT failed (returned false).`);
            }
        });
        console.log(`Finished turning on ${deviceIds ? 'specified' : 'all'} devices via MQTT.`);
    } catch (error) {
        console.error("Error during turnOnAllDevices MQTT execution:", error);
    }
}

/**
 * Turns off all specified devices (or all if none specified) concurrently using MQTT.
 * @param deviceIds Optional array of device IDs. If omitted, applies to all devices.
 */
export async function turnOffAllDevices(deviceIds?: string[]): Promise<void> {
    console.log(`Turning off devices via MQTT: ${deviceIds ? deviceIds.join(', ') : 'All'}`);
    let devicesToControl = await readDevicesFromFile();
    if (deviceIds && deviceIds.length > 0) {
        devicesToControl = devicesToControl.filter(d => deviceIds.includes(d.id));
    }

     if (devicesToControl.length === 0) {
        console.warn("No matching devices found to turn off.");
        return;
    }

    // Use the new MQTT-based function
    const promises = devicesToControl.map(device => turnDeviceOff(device)); // Use MQTT version

     try {
        const results = await Promise.allSettled(promises);
         results.forEach((result, index) => {
            const device = devicesToControl[index];
            if (result.status === 'rejected') {
                console.error(`Failed to turn off device ${device.id} (${device.ip}) using MQTT:`, result.reason);
            } else if (result.value === false) {
                 console.warn(`Command to turn off device ${device.id} (${device.ip}) using MQTT failed (returned false).`);
            }
        });
        console.log(`Finished turning off ${deviceIds ? 'specified' : 'all'} devices via MQTT.`);
    } catch (error) {
        console.error("Error during turnOffAllDevices MQTT execution:", error);
    }
}

/**
 * Sets the color for specified devices (or all if none specified) concurrently using MQTT.
 * @param hexColor The color in hex format (e.g., "#9c5e5e").
 * @param deviceIds Optional array of device IDs. If omitted, applies to all devices.
 */
export async function setDeviceColorAll(hexColor: string, deviceIds?: string[]): Promise<void> {
    console.log(`Setting color to ${hexColor} via MQTT for devices: ${deviceIds ? deviceIds.join(', ') : 'All'}`);
    let devicesToControl = await readDevicesFromFile();
    if (deviceIds && deviceIds.length > 0) {
        devicesToControl = devicesToControl.filter(d => deviceIds.includes(d.id));
    }

     if (devicesToControl.length === 0) {
        console.warn(`No matching devices found to set color to ${hexColor}.`);
        return;
    }

    const promises = devicesToControl.map(device => setDeviceColor(device, hexColor)); // Use MQTT version
    try {
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
            const device = devicesToControl[index];
            if (result.status === 'rejected') {
                console.error(`Failed to set color for device ${device.id} (${device.ip}) via MQTT:`, result.reason);
            } else if (result.value === false) {
                console.warn(`Command to set color for device ${device.id} (${device.ip}) via MQTT failed (returned false).`);
            }
        });
        console.log(`Finished setting color for ${deviceIds ? 'specified' : 'all'} devices via MQTT.`);
    } catch (error) {
        console.error("Error during setDeviceColorAll MQTT execution:", error);
    }
}

// Helper function to convert Kelvin to Mired and clamp to Tasmota range
function kelvinToMired(kelvin: number): number {
    // Tasmota CT range: 153 (coolest, ~6500K) to 500 (warmest, ~2000K)
    const mired = Math.round(1000000 / kelvin);
    return Math.max(153, Math.min(500, mired));
}

/**
 * Sets the color temperature of a device using Tasmota's `cmnd/.../CT` command.
 * @param device The device data.
 * @param kelvin The desired temperature in Kelvin (e.g., 2700, 4000, 6500).
 */
async function setDeviceTemperature(device: BulbDeviceData, kelvin: number): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const miredValue = kelvinToMired(kelvin);

    const topic = `cmnd/${deviceMqttId}/CT`;
    const message = String(miredValue);

    console.log(`MQTT: Setting temperature for ${device.id} (${device.ip}) to ${kelvin}K (Mired: ${miredValue}) -> ${topic}: ${message}`);

    try {
        await publishMqttMessage(topic, message);
        // Optional: Optimistic update (convert mired back to kelvin for consistency?)
        // const updatedKelvin = Math.round(1000000 / miredValue);
        // await updateDeviceLastStatus(device.id, { CT: miredValue, temperature: updatedKelvin });
        return true;
    } catch (error) {
        console.error(`Error in setDeviceTemperature for ${device.ip} via MQTT:`, error);
        return false;
    }
}

/**
 * Sets the temperature for specified devices (or all if none specified) concurrently using MQTT.
 * @param kelvin The temperature in Kelvin.
 * @param deviceIds Optional array of device IDs. If omitted, applies to all devices.
 */
export async function setDeviceTemperatureAll(kelvin: number, deviceIds?: string[]): Promise<void> {
    console.log(`Setting temperature to ${kelvin}K via MQTT for devices: ${deviceIds ? deviceIds.join(', ') : 'All'}`);
    let devicesToControl = await readDevicesFromFile();
    if (deviceIds && deviceIds.length > 0) {
        devicesToControl = devicesToControl.filter(d => deviceIds.includes(d.id));
    }

     if (devicesToControl.length === 0) {
        console.warn(`No matching devices found to set temperature to ${kelvin}K.`);
        return;
    }

    const promises = devicesToControl.map(device => setDeviceTemperature(device, kelvin));
    try {
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
            const device = devicesToControl[index];
            if (result.status === 'rejected') {
                console.error(`Failed to set temperature for device ${device.id} (${device.ip}) via MQTT:`, result.reason);
            } else if (result.value === false) {
                console.warn(`Command to set temperature for device ${device.id} (${device.ip}) via MQTT failed (returned false).`);
            }
        });
        console.log(`Finished setting temperature for ${deviceIds ? 'specified' : 'all'} devices via MQTT.`);
    } catch (error) {
        console.error("Error during setDeviceTemperatureAll MQTT execution:", error);
    }
}

// --- Exports --- REVISED
export {
    type BulbDeviceData,
    type BulbStatus,
    readDevicesFromFile, // Still export this, it uses the cache now
    // writeDevicesToFile, // Don't export write directly, updates happen via MQTT handler
    // --- MQTT based functions ---
    turnDeviceOff,
    turnDeviceOn,
    setDeviceColor,
    setDeviceTemperature, // Export the single device function
    // --- Multi-device functions (already exported) ---
    // turnOnAllDevices, // Already exported
    // turnOffAllDevices, // Already exported
    // setDeviceColorAll, // Already exported
    // setDeviceTemperatureAll // Already exported
    // Removed: sendGetRequest, toggleDevice, getDeviceStatus
}; 