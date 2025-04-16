// import mqtt from 'mqtt'; // MQTT logic moved to mqtt.ts
import { kelvinToMired } from "./utils";
import {
    BulbDeviceData,
    getDevices,
    getDeviceMqttId,
    // REMOVED: addDeviceAnimation,
    // REMOVED: removeDeviceAnimation,
    // REMOVED: removeAllDeviceAnimations
} from "./devices";
import { getMqttClient, publishMqttMessage, disconnectMqtt } from "./mqtt";
import { 
    buildTasmotaPowerCommand,
    buildTasmotaColorCommand,
    buildTasmotaCTCommand,
    buildTasmotaFadeCommand,
    buildTasmotaSpeedCommand,
    buildTasmotaDimmerCommand
} from './tasmota'; // Import command builders
import { BulbStatus } from "./devices"; // Ensure BulbStatus is imported if not already

// Define the structure for device data and status
// Moved to devices.ts

// const DEVICES_FILE_PATH = path.join(process.cwd(), 'devices.json'); // Moved to devices.ts

// --- MQTT Configuration ---
// Moved to mqtt.ts
// const MQTT_BROKER_URL = 'mqtt://10.0.0.195:1883';
// const MQTT_CLIENT_ID = `wifi-lights-server-${Math.random().toString(16).substring(2, 8)}`; // Unique client ID
// const MQTT_CONNECT_OPTIONS: mqtt.IClientOptions = {
//   clientId: MQTT_CLIENT_ID,
//   // Add username/password here if needed
//   username: process.env.MQTT_USERNAME, // Read from environment variable
//   password: process.env.MQTT_PASSWORD, // Read from environment variable
//   connectTimeout: 5000, // 5 seconds
//   reconnectPeriod: 1000, // Try reconnecting every second if disconnected
// };

// --- Assumed Channel Mapping (Based on common RGBWWC setups) ---
// This might belong in a Tasmota-specific module if created, or stay here if lights.ts remains the main API.
// const CHANNEL_RED = 1;
// const CHANNEL_GREEN = 2;
// const CHANNEL_BLUE = 3;
// const CHANNEL_WARM_WHITE = 4;
// const CHANNEL_COLD_WHITE = 5;

// Keep track of devices in memory -> Moved to devices.ts
// Keep track of MQTT client -> Moved to mqtt.ts

// --- MQTT Client Instance ---
// Moved to mqtt.ts
// let mqttClient: mqtt.MqttClient | null = null;
// let connectionPromise: Promise<mqtt.MqttClient> | null = null;
// let isConnecting = false;
// let handlersAttached = false; // Flag to ensure handlers are attached only once

// Function to attach persistent event handlers
// Moved to mqtt.ts
// function attachEventHandlers(client: mqtt.MqttClient) { ... }

// Function to get MQTT client
// Moved to mqtt.ts
// function getMqttClient(): Promise<mqtt.MqttClient> { ... }

// --- MQTT Publish Helper ---
// Moved to mqtt.ts
// async function publishMqttMessage(topic: string, message: string | Buffer): Promise<void> { ... }

// Helper function to get the MQTT device identifier (e.g., "spot_21")
// Moved to devices.ts

// --- File Operations ---
// Moved to devices.ts

// Initialization logic
// Should be handled explicitly by the application startup, e.g., in server.js or API route
// getDevices().then(() => {
//     console.log("Device cache initialized.");
//     // Initialize MQTT after devices are potentially loaded
//     getMqttClient().then(() => {
//         console.log("MQTT Client initialization started.");
//     }).catch(mqttError => {
//         console.error("Failed to initialize MQTT client:", mqttError);
//     });
// }).catch(deviceError => {
//     console.error("Failed to initialize device cache:", deviceError);
// });

// --- MQTT Message Handler Logic ---
// Moved to mqtt.ts
// async function handleMqttMessage(topic: string, payload: Buffer): Promise<void> { ... }

// Helper function to find device ID from MQTT Topic
// Moved to devices.ts

// --- Device Control Logic --- (Now uses imported functions)

/**
 * Sets the color of a device using Tasmota commands.
 * @param device The device data.
 * @param hexColor The color in hex format (e.g., "#9c5e5e").
 * @returns True if the command was sent, false otherwise (e.g., invalid color).
 */
async function setDeviceColor(device: BulbDeviceData, hexColor: string): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const command = buildTasmotaColorCommand(deviceMqttId, hexColor);

    if (!command) {
        console.error(`Invalid hex color format: ${hexColor} for device ${device.id}`);
        return false; // Invalid color format handled by builder
    }
    
    console.log(`MQTT: Setting color for ${device.id} (${device.ip}) -> ${command.topic}: ${command.payload}`);

    try {
        await publishMqttMessage(command.topic, command.payload);
        // Optional: optimistic update (already commented out)
        return true;
    } catch (error) {
        console.error(`Error in setDeviceColor for ${device.ip} via MQTT:`, error);
        return false;
    }
}

/**
 * Turns a specific device ON using Tasmota commands.
 * @param device The device data.
 * @returns True if the command was sent, false otherwise.
 */
async function turnDeviceOn(device: BulbDeviceData): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const command = buildTasmotaPowerCommand(deviceMqttId, 'ON');

    console.log(`MQTT: Turning on device ${device.id} (${device.ip}) -> ${command.topic}: ${command.payload}`);
    try {
        await publishMqttMessage(command.topic, command.payload);
        // Optional: optimistic update (already commented out)
        return true;
    } catch (error) {
        console.error(`Error turning on device ${device.id} (${device.ip}) via MQTT:`, error);
        return false;
    }
}

/**
 * Turns a specific device OFF using Tasmota commands.
 * @param device The device data.
 * @returns True if the command was sent, false otherwise.
 */
async function turnDeviceOff(device: BulbDeviceData): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const command = buildTasmotaPowerCommand(deviceMqttId, 'OFF');

    console.log(`MQTT: Turning off device ${device.id} (${device.ip}) -> ${command.topic}: ${command.payload}`);
    try {
        await publishMqttMessage(command.topic, command.payload);
        // Optional: optimistic update (already commented out)
        return true;
    } catch (error) {
        console.error(`Error turning off device ${device.id} (${device.ip}) via MQTT:`, error);
        return false;
    }
}

/**
 * Sets the color temperature of a device using Tasmota commands.
 * @param device The device data.
 * @param kelvin The desired temperature in Kelvin.
 * @returns True if the command was sent, false otherwise.
 */
async function setDeviceTemperature(device: BulbDeviceData, kelvin: number): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const miredValue = kelvinToMired(kelvin); // Convert kelvin
    const command = buildTasmotaCTCommand(deviceMqttId, miredValue);

    console.log(`MQTT: Setting temperature for ${device.id} (${device.ip}) to ${kelvin}K (Mired: ${miredValue}) -> ${command.topic}: ${command.payload}`);

    try {
        await publishMqttMessage(command.topic, command.payload);
        // Optional: optimistic update (already commented out)
        return true;
    } catch (error) {
        console.error(`Error in setDeviceTemperature for ${device.ip} via MQTT:`, error);
        return false;
    }
}

/**
 * Sets the fade state of a device using Tasmota commands.
 * @param device The device data.
 * @param state The desired fade state ("ON" or "OFF").
 * @returns True if the command was sent, false otherwise.
 */
async function setDeviceFade(device: BulbDeviceData, state: 'ON' | 'OFF'): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const command = buildTasmotaFadeCommand(deviceMqttId, state);

    console.log(`MQTT: Setting fade for ${device.id} (${device.ip}) to ${state} -> ${command.topic}: ${command.payload}`);

    try {
        await publishMqttMessage(command.topic, command.payload);
        return true;
    } catch (error) {
        console.error(`Error in setDeviceFade for ${device.ip} via MQTT:`, error);
        return false;
    }
}

/**
 * Sets the speed of a device using Tasmota commands.
 * @param device The device data.
 * @param speedValue The desired speed (1-40).
 * @returns True if the command was sent, false otherwise.
 */
async function setDeviceSpeed(device: BulbDeviceData, speedValue: number): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const command = buildTasmotaSpeedCommand(deviceMqttId, speedValue);

    console.log(`MQTT: Setting speed for ${device.id} (${device.ip}) to ${speedValue} -> ${command.topic}: ${command.payload}`);

    try {
        await publishMqttMessage(command.topic, command.payload);
        return true;
    } catch (error) {
        console.error(`Error in setDeviceSpeed for ${device.ip} via MQTT:`, error);
        return false;
    }
}

/**
 * Sets the brightness (Dimmer) of a specific device using Tasmota commands.
 */
async function setDeviceBrightness(device: BulbDeviceData, brightness: number): Promise<boolean> {
    const deviceMqttId = getDeviceMqttId(device);
    const command = buildTasmotaDimmerCommand(deviceMqttId, brightness);

    console.log(`MQTT: Setting brightness for ${device.id} (${device.ip}) to ${brightness}% -> ${command.topic}: ${command.payload}`);

    try {
        await publishMqttMessage(command.topic, command.payload);
        return true;
    } catch (error) {
        console.error(`Error in setDeviceBrightness for ${device.ip} via MQTT:`, error);
        return false;
    }
}

// --- Functions for Multiple Devices --- REFACTORED

/**
 * Turns on all specified devices (or all if none specified) concurrently using MQTT.
 */
async function turnOnAllDevices(
    deviceIds?: string[],
): Promise<void> {
  console.log(
    `Turning on devices via MQTT: ${deviceIds ? deviceIds.join(", ") : "All"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn("No matching devices found to turn on.");
    return;
  }

  // Then turn devices on
  const promises = devicesToControl.map((device) => turnDeviceOn(device));

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => {
      const device = devicesToControl[index];
      if (result.status === "rejected") {
        console.error(
          `Failed to turn on device ${device.id} (${device.ip}) via MQTT:`,
          result.reason,
        );
      } else if (result.value === false) {
        console.warn(
          `Command to turn on device ${device.id} (${device.ip}) via MQTT failed (returned false).`,
        );
      }
    });
    console.log(
      `Finished turning on ${deviceIds ? "specified" : "all"} devices via MQTT.`,
    );
  } catch (error) {
    console.error("Error during turnOnAllDevices MQTT execution:", error);
  }
}

/**
 * Turns off all specified devices (or all if none specified) concurrently using MQTT.
 */
async function turnOffAllDevices(
    deviceIds?: string[],
): Promise<void> {
  console.log(
    `Turning off devices via MQTT: ${deviceIds ? deviceIds.join(", ") : "All"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn("No matching devices found to turn off.");
    return;
  }

  // Then turn devices off
  const promises = devicesToControl.map((device) => turnDeviceOff(device));

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => {
      const device = devicesToControl[index];
      if (result.status === "rejected") {
        console.error(
          `Failed to turn off device ${device.id} (${device.ip}) using MQTT:`,
          result.reason,
        );
      } else if (result.value === false) {
        console.warn(
          `Command to turn off device ${device.id} (${device.ip}) using MQTT failed (returned false).`,
        );
      }
    });
    console.log(
      `Finished turning off ${deviceIds ? "specified" : "all"} devices via MQTT.`,
    );
  } catch (error) {
    console.error("Error during turnOffAllDevices MQTT execution:", error);
  }
}

/**
 * Sets the color for specified devices (or all if none specified) concurrently using MQTT.
 */
async function setDeviceColorAll(
  hexColor: string,
  deviceIds?: string[]
): Promise<void> {
  console.log(
    `Setting color to ${hexColor} via MQTT for devices: ${deviceIds ? deviceIds.join(", ") : "All"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn(`No matching devices found to set color to ${hexColor}.`);
    return;
  }

  // Then set the color
  const promises = devicesToControl.map((device) =>
    setDeviceColor(device, hexColor),
  );

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => {
      const device = devicesToControl[index];
      if (result.status === "rejected") {
        console.error(
          `Failed to set color for device ${device.id} (${device.ip}) via MQTT:`,
          result.reason,
        );
      } else if (result.value === false) {
        console.warn(
          `Command to set color for device ${device.id} (${device.ip}) via MQTT failed (returned false).`,
        );
      }
    });
    console.log(
      `Finished setting color for ${deviceIds ? "specified" : "all"} devices via MQTT.`,
    );
  } catch (error) {
    console.error("Error during setDeviceColorAll MQTT execution:", error);
  }
}

/**
 * Sets the temperature for specified devices (or all if none specified) concurrently using MQTT.
 */
async function setDeviceTemperatureAll(
  kelvin: number,
  deviceIds?: string[]
): Promise<void> {
  console.log(
    `Setting temperature to ${kelvin}K via MQTT for devices: ${deviceIds ? deviceIds.join(", ") : "All"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn(`No matching devices found to set temperature to ${kelvin}K.`);
    return;
  }

  // Then set the temperature
  const promises = devicesToControl.map((device) =>
    setDeviceTemperature(device, kelvin),
  );

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => {
      const device = devicesToControl[index];
      if (result.status === "rejected") {
        console.error(
          `Failed to set temperature for device ${device.id} (${device.ip}) via MQTT:`,
          result.reason,
        );
      } else if (result.value === false) {
        console.warn(
          `Command to set temperature for device ${device.id} (${device.ip}) via MQTT failed (returned false).`,
        );
      }
    });
    console.log(
      `Finished setting temperature for ${deviceIds ? "specified" : "all"} devices via MQTT.`,
    );
  } catch (error) {
    console.error(
      "Error during setDeviceTemperatureAll MQTT execution:",
      error,
    );
  }
}

/**
 * Sets the fade state for specified devices (or all if none specified) concurrently using MQTT.
 * @param state The desired fade state ("ON" or "OFF").
 * @param deviceIds Optional array of device IDs. If omitted, applies to all devices.
 */
async function setDeviceFadeAll(
  state: 'ON' | 'OFF',
  deviceIds?: string[],
): Promise<void> {
  console.log(
    `Setting fade to ${state} via MQTT for devices: ${deviceIds ? deviceIds.join(", ") : "All"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn(`No matching devices found to set fade to ${state}.`);
    return;
  }

  const promises = devicesToControl.map((device) => setDeviceFade(device, state));

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => {
      const device = devicesToControl[index];
      if (result.status === "rejected") {
        console.error(
          `Failed to set fade for device ${device.id} (${device.ip}) via MQTT:`,
          result.reason,
        );
      } else if (result.value === false) {
        console.warn(
          `Command to set fade for device ${device.id} (${device.ip}) via MQTT failed (returned false).`,
        );
      }
    });
    console.log(
      `Finished setting fade for ${deviceIds ? "specified" : "all"} devices via MQTT.`,
    );
  } catch (error) {
    console.error("Error during setDeviceFadeAll MQTT execution:", error);
  }
}

/**
 * Sets the speed for specified devices (or all if none specified) concurrently using MQTT.
 * @param speedValue The desired speed (1-40).
 * @param deviceIds Optional array of device IDs. If omitted, applies to all devices.
 */
async function setDeviceSpeedAll(
  speedValue: number,
  deviceIds?: string[],
): Promise<void> {
  console.log(
    `Setting speed to ${speedValue} via MQTT for devices: ${deviceIds ? deviceIds.join(", ") : "All"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn(`No matching devices found to set speed to ${speedValue}.`);
    return;
  }

  const promises = devicesToControl.map((device) => setDeviceSpeed(device, speedValue));

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => {
      const device = devicesToControl[index];
      if (result.status === "rejected") {
        console.error(
          `Failed to set speed for device ${device.id} (${device.ip}) via MQTT:`,
          result.reason,
        );
      } else if (result.value === false) {
        console.warn(
          `Command to set speed for device ${device.id} (${device.ip}) via MQTT failed (returned false).`,
        );
      }
    });
    console.log(
      `Finished setting speed for ${deviceIds ? "specified" : "all"} devices via MQTT.`,
    );
  } catch (error) {
    console.error("Error during setDeviceSpeedAll MQTT execution:", error);
  }
}

/**
 * Sets the brightness for specified devices (or all if none specified) concurrently using MQTT.
 */
async function setDeviceBrightnessAll(
  brightness: number,
  deviceIds?: string[]
): Promise<void> {
  console.log(
    `Setting brightness to ${brightness}% via MQTT for devices: ${deviceIds ? deviceIds.join(", ") : "All"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn(`No matching devices found to set brightness to ${brightness}%.`);
    return;
  }

  const promises = devicesToControl.map((device) =>
    setDeviceBrightness(device, brightness),
  );

  try {
    const results = await Promise.allSettled(promises);
    results.forEach((result, index) => {
      const device = devicesToControl[index];
      if (result.status === "rejected") {
        console.error(
          `Failed to set brightness for device ${device.id} (${device.ip}) via MQTT:`,
          result.reason,
        );
      } else if (result.value === false) {
        console.warn(
          `Command to set brightness for device ${device.id} (${device.ip}) via MQTT failed (returned false).`,
        );
      }
    });
    console.log(
      `Finished setting brightness for ${deviceIds ? "specified" : "all"} devices via MQTT.`,
    );
  } catch (error) {
    console.error("Error during setDeviceBrightnessAll MQTT execution:", error);
  }
}

/**
 * Initiates a smooth, device-side dimmer transition using HTTP POST commands.
 * Sends commands with lowercase names.
 * Assumes firmware supports Backlog, addRepeatingEventID, cancelRepeatingEvent, add_dimmer.
 */
async function startSmoothDimmerTransition(
  deviceId: string,
  targetDimmer: number,
  durationSeconds: number
): Promise<boolean> {
  const devices = await getDevices();
  const device = devices.find(d => d.id === deviceId);

  if (!device) {
    console.error(`[Smooth Dimmer] Device ${deviceId} not found.`);
    return false;
  }

  const deviceIp = device.ip;
  const currentDimmer = device.last_status?.Dimmer ?? 50;
  const eventId = 1; // Fixed integer ID for dimmer fades
  const intervalSeconds = 0.02;

  targetDimmer = Math.max(0, Math.min(100, targetDimmer));

  // Handle direct set case
  if (durationSeconds <= intervalSeconds * 2 || targetDimmer === currentDimmer) {
    console.log(`[Smooth Dimmer] Setting Dimmer ${targetDimmer} directly for ${deviceId}.`);
    const command = `Dimmer ${targetDimmer}`;
    try {
        await fetch(`http://${deviceIp}/api/cmnd`, { method: 'POST', headers:{ 'Content-Type': 'text/plain' }, body: command });
        // REMOVED: removeDeviceAnimation(deviceId, eventId);
        return true;
    } catch (error) {
        console.error(`[Smooth Dimmer] Error sending direct Dimmer command to ${deviceId} (${deviceIp}):`, error);
        // REMOVED: removeDeviceAnimation(deviceId, eventId);
        return false;
    }
  }

  // --- Animation Calculation ---
  const totalSteps = Math.max(1, Math.round(durationSeconds / intervalSeconds));
  const dimmerChange = targetDimmer - currentDimmer;
  const stepValue = dimmerChange / totalSteps;
  const repeats = totalSteps;
  // REMOVED: AnimationInfo tracking

  // Use lowercase commands
  const backlogCommand = `backlog cancelrepeatingevent ${eventId}; addrepeatingeventid ${intervalSeconds.toFixed(3)} ${repeats} ${eventId} add_dimmer ${stepValue.toFixed(3)} 0`;
  const cancelCommand = `cancelrepeatingevent ${eventId}`;

  console.log(`[Smooth Dimmer] Sending to ${deviceId} (${deviceIp}): ${backlogCommand}`);

  try {
    // REMOVED: addDeviceAnimation(deviceId, animationInfo);
    const response = await fetch(`http://${deviceIp}/api/cmnd`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: backlogCommand
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to get error text');
      console.error(`[Smooth Dimmer] Error response from ${deviceId} (${deviceIp}): ${response.status} ${response.statusText} - ${errorText}`);
      // REMOVED: removeDeviceAnimation(deviceId, eventId);
      return false;
    }

    // Schedule the cancellation command
    const cancelDelayMs = durationSeconds * 1000 + 200; // Buffer
    console.log(`[Smooth Dimmer] Scheduling cancelrepeatingevent ${eventId} on ${deviceId} in ${cancelDelayMs}ms`);
    setTimeout(async () => {
        console.log(`[Smooth Dimmer] Sending scheduled cancelrepeatingevent ${eventId} to ${deviceId}`);
        try {
            await fetch(`http://${deviceIp}/api/cmnd`, {
                method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cancelCommand
            });
        } catch (cancelError) {
            console.error(`[Smooth Dimmer] Network error sending cancelrepeatingevent ${eventId} to ${deviceId}:`, cancelError);
        }
        // REMOVED: finally block with removeDeviceAnimation
    }, cancelDelayMs);

    return true;
  } catch (error) {
    console.error(`[Smooth Dimmer] Network error sending command to ${deviceId} (${deviceIp}):`, error);
    // REMOVED: removeDeviceAnimation(deviceId, eventId);
    return false;
  }
}

/**
 * Sends a command to cancel a specific repeating event on a device.
 * Uses lowercase command.
 */
async function cancelDeviceAnimation(deviceId: string, eventId: number): Promise<boolean> {
    const devices = await getDevices();
    const device = devices.find(d => d.id === deviceId);
    if (!device) {
      console.error(`[Cancel Animation] Device ${deviceId} not found.`);
      return false;
    }

    const deviceIp = device.ip;
    const cancelCommand = `cancelrepeatingevent ${eventId}`;

    console.log(`[Cancel Animation] Sending to ${deviceId} (${deviceIp}): ${cancelCommand}`);

    try {
        await fetch(`http://${deviceIp}/api/cmnd`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: cancelCommand
        });
        // Return true if command was attempted, regardless of device response
        return true;
    } catch (error) {
        console.warn(`[Cancel Animation] Network error sending cancel command for event ${eventId} to ${deviceId}:`, error);
        return false; // Indicate network error occurred
    }
    // REMOVED: finally block with removeDeviceAnimation
}

/**
 * Sends the ClearRepeatingEvents command (lowercase) to specified devices via HTTP.
 */
async function clearAllRepeatingEvents(deviceIds?: string[]): Promise<void> {
  console.log(
    `[Clear Animations] Sending ClearRepeatingEvents to ${deviceIds ? `devices ${deviceIds.join(", ")}` : "all devices"}`,
  );
  let devicesToControl = await getDevices();

  if (deviceIds && deviceIds.length > 0) {
    devicesToControl = devicesToControl.filter((d) => deviceIds.includes(d.id));
  }

  if (devicesToControl.length === 0) {
    console.warn("[Clear Animations] No matching devices found.");
    return;
  }

  const command = "clearrepeatingevents"; // Use lowercase

  const promises = devicesToControl.map(async (device) => {
    try {
      await fetch(`http://${device.ip}/api/cmnd`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: command
      });
      // REMOVED: removeAllDeviceAnimations(device.id);
      return { status: 'fulfilled', deviceId: device.id };
    } catch (error) {
      console.warn(`[Clear Animations] Error sending clearrepeatingevents to ${device.id} (${device.ip}):`, error);
      // REMOVED: removeAllDeviceAnimations(device.id);
      return { status: 'rejected', deviceId: device.id, reason: error };
    }
  });

  await Promise.allSettled(promises);
  console.log(
    `[Clear Animations] Finished attempting ClearRepeatingEvents for ${deviceIds ? "specified" : "all"} devices.`,
  );
}

/**
 * Queries a device for its list of active repeating events.
 * Assumes firmware responds to 'listrepeatingevents' command with JSON.
 * Example Response Format (Guess): { "events": [ { "id": 1, "interval": 0.02, "repeats": 50, "command": "add_dimmer 1.0 0" }, ... ] }
 * @param deviceId The ID of the target device.
 * @returns A promise resolving to an array of event objects, or null if error/not found.
 */
async function listDeviceRepeatingEvents(deviceId: string): Promise<any[] | null> {
    const devices = await getDevices();
    const device = devices.find(d => d.id === deviceId);

    if (!device) {
      console.error(`[List Events] Device ${deviceId} not found.`);
      return null;
    }

    const deviceIp = device.ip;
    const command = "listrepeatingevents"; // Lowercase command

    console.log(`[List Events] Sending ${command} to ${deviceId} (${deviceIp})`);

    try {
        // Sending command via POST seems safer if it modifies state or expects arguments later
        // but GET might also work for simple queries. Using POST for consistency.
        const response = await fetch(`http://${deviceIp}/api/cmnd`, {
            method: 'POST', // Or GET? Check firmware docs
            headers: { 'Content-Type': 'text/plain' },
            body: command
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Failed to get error text');
            console.error(`[List Events] Error response from ${deviceId} (${deviceIp}): ${response.status} ${response.statusText} - ${errorText}`);
            return null;
        }

        const responseData = await response.json();
        // Adjust parsing based on actual firmware response structure
        if (responseData && responseData.events && Array.isArray(responseData.events)) {
            console.log(`[List Events] Received ${responseData.events.length} events from ${deviceId}`);
            return responseData.events;
        } else {
            console.warn(`[List Events] Unexpected response format from ${deviceId}:`, responseData);
            return []; // Return empty array for valid response but unexpected structure
        }

    } catch (error: any) {
        // Handle JSON parsing error separately if needed
        if (error instanceof SyntaxError) {
             console.error(`[List Events] Failed to parse JSON response from ${deviceId} (${deviceIp}):`, error);
        } else {
             console.error(`[List Events] Network error querying events from ${deviceId} (${deviceIp}):`, error);
        }
        return null;
    }
}

/**
 * Sends a raw, plain-text command to a specific device via HTTP POST.
 * USE WITH CAUTION - No validation is performed on the command string.
 * @param deviceId The ID of the target device.
 * @param command The raw command string to send.
 * @returns True if the command was sent successfully (HTTP 2xx), false otherwise.
 */
async function sendRawHttpCommand(deviceId: string, command: string): Promise<boolean> {
    const devices = await getDevices();
    const device = devices.find(d => d.id === deviceId);

    if (!device) {
      console.error(`[Raw Command] Device ${deviceId} not found.`);
      return false;
    }

    const deviceIp = device.ip;
    console.log(`[Raw Command] Sending to ${deviceId} (${deviceIp}): "${command}"`);

    try {
        const response = await fetch(`http://${deviceIp}/api/cmnd`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: command
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Failed to get error text');
            console.error(`[Raw Command] Error response from ${deviceId} (${deviceIp}): ${response.status} ${response.statusText} - ${errorText}`);
            return false;
        }
        // Optionally log success response text
        // const responseText = await response.text();
        // console.log(`[Raw Command] Success response from ${deviceId}: ${responseText}`);
        return true;
    } catch (error) {
        console.error(`[Raw Command] Network error sending command to ${deviceId} (${deviceIp}):`, error);
        return false;
    }
}

// --- Exports --- REVISED
export type { BulbDeviceData as LightDeviceData } from "./devices";
export type { BulbStatus as LightStatus } from "./devices";

export {
  // Device access
  getDevices as getAllDevices,
  // Individual device controls
  turnDeviceOff,
  turnDeviceOn,
  setDeviceColor,
  setDeviceTemperature,
  // Bulk device controls
  turnOnAllDevices,
  turnOffAllDevices,
  setDeviceColorAll,
  setDeviceTemperatureAll,
  // MQTT connection
  getMqttClient,
  publishMqttMessage,
  disconnectMqtt,
  // Fade/Speed (via MQTT)
  setDeviceFadeAll,
  setDeviceSpeedAll,
  // Device-Side Animations (via HTTP)
  startSmoothDimmerTransition,
  cancelDeviceAnimation,
  clearAllRepeatingEvents,
  listDeviceRepeatingEvents,
  setDeviceBrightnessAll,
  sendRawHttpCommand,
};


