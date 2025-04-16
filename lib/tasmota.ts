import { BulbStatus } from "./devices";
// Potentially import miredToKelvin if needed for consistent status reporting
// import { miredToKelvin } from './utils';

/**
 * Parses Tasmota stat/+/POWER messages.
 * @param message Payload string ("ON" or "OFF").
 * @returns Partial device status update.
 */
function parsePowerMessage(message: string): Partial<BulbStatus> {
  const statusUpdate: Partial<BulbStatus> = {};

  statusUpdate.power = message === "ON" ? "ON" : "OFF";
  if (statusUpdate.power === "OFF") {
    statusUpdate.Dimmer = 0;
    statusUpdate.brightness = 0;
  }

  return statusUpdate;
}

/**
 * Parses Tasmota tele/+/STATE messages (JSON payload).
 * @param message Payload string (JSON).
 * @returns Partial device status update.
 */
function parseStateMessage(message: string): Partial<BulbStatus> {
  const state = JSON.parse(message); // Can throw error, should be caught by caller
  const statusUpdate: Partial<BulbStatus> = {};

  statusUpdate.power = state.POWER === "ON" ? "ON" : "OFF";
  if (state.Dimmer !== undefined) {
    statusUpdate.Dimmer = state.Dimmer;
    statusUpdate.brightness = state.Dimmer; // Keep brightness synced with Dimmer for now
  }
  if (state.CT !== undefined) {
    statusUpdate.CT = state.CT;
    // statusUpdate.temperature = miredToKelvin(state.CT); // Optional conversion
  }

  // Extract the 6-char hex color from Tasmota's 'Color' field if present
  if (state.Color && typeof state.Color === "string") {
    // Try parsing both RRGGBB[WWCW] and R,G,B[,W[,CW]] formats
    let hexColor: string | null = null;
    if (state.Color.includes(",")) {
      const parts = state.Color.split(",").map(Number);
      if (parts.length >= 3 && !parts.slice(0, 3).some(isNaN)) {
        statusUpdate.red = parts[0];
        statusUpdate.green = parts[1];
        statusUpdate.blue = parts[2];
        hexColor = ((parts[0] << 16) + (parts[1] << 8) + parts[2])
          .toString(16)
          .padStart(6, "0");
      }
    } else if (/^[0-9a-fA-F]{6,}/.test(state.Color)) {
      // Assume RRGGBB format if no comma
      hexColor = state.Color.substring(0, 6);
    }

    if (hexColor) {
      statusUpdate.color = hexColor.toLowerCase(); // Store as lowercase hex
      // Re-parse RGB from the hex color for consistency
      const rgbInt = parseInt(statusUpdate.color, 16);
      statusUpdate.red = (rgbInt >> 16) & 255;
      statusUpdate.green = (rgbInt >> 8) & 255;
      statusUpdate.blue = rgbInt & 255;
    }

    // Store the raw Tasmota Color string as well
    statusUpdate.Color = state.Color;
  }

  // Add new fields
  if (state.Fade !== undefined) {
    statusUpdate.Fade = state.Fade === "ON" ? "ON" : "OFF";
  }
  if (state.Speed !== undefined && typeof state.Speed === 'number') {
    statusUpdate.Speed = state.Speed;
  }
  if (state.HSBColor !== undefined && typeof state.HSBColor === 'string') {
    statusUpdate.HSBColor = state.HSBColor;
  }
  // Prefer individual channels if available, fallback to Channel array
  if (state.Channel1 !== undefined && typeof state.Channel1 === 'number') statusUpdate.Channel1 = state.Channel1;
  if (state.Channel2 !== undefined && typeof state.Channel2 === 'number') statusUpdate.Channel2 = state.Channel2;
  if (state.Channel3 !== undefined && typeof state.Channel3 === 'number') statusUpdate.Channel3 = state.Channel3;
  if (state.Channel4 !== undefined && typeof state.Channel4 === 'number') statusUpdate.Channel4 = state.Channel4;
  if (state.Channel5 !== undefined && typeof state.Channel5 === 'number') statusUpdate.Channel5 = state.Channel5;
  else if (state.Channel !== undefined && Array.isArray(state.Channel) && state.Channel.every((c: any) => typeof c === 'number')) {
    // Only parse array if individual channels weren't found
    statusUpdate.Channel = state.Channel;
    // Optionally populate individual fields from array if needed elsewhere
    // if (state.Channel.length >= 5) {
    //   statusUpdate.Channel1 = state.Channel[0];
    //   // ... etc
    // }
  }

  return statusUpdate;
}

/**
 * Parses Tasmota stat/+/RESULT messages (JSON payload).
 * Often contains status info after a command.
 * @param message Payload string (JSON).
 * @returns Partial device status update, or null if no relevant info.
 */
function parseResultMessage(message: string): Partial<BulbStatus> | null {
  const result = JSON.parse(message); // Can throw error, should be caught by caller
  // Check common status objects within RESULT
  const state = result.Status || result.StatusSTS || result; // Use result directly as fallback
  const statusUpdate: Partial<BulbStatus> = {};
  let hasUpdate = false;

  if (state.POWER !== undefined) {
    statusUpdate.power = state.POWER === "ON" ? "ON" : "OFF";
    hasUpdate = true;
  }
  if (state.Dimmer !== undefined) {
    statusUpdate.Dimmer = state.Dimmer;
    statusUpdate.brightness = state.Dimmer;
    hasUpdate = true;
  }
  if (state.CT !== undefined) {
    statusUpdate.CT = state.CT;
    // statusUpdate.temperature = miredToKelvin(state.CT); // Optional conversion
    hasUpdate = true;
  }
  if (state.Color) {
    const colorInput = state.Color;
    let parsedColor: string | null = null;

    if (typeof colorInput === "string" && colorInput.includes(",")) {
      // Format "R,G,B[,W[,C]]"
      const parts = colorInput.split(",").map(Number);

      if (parts.length >= 3 && !parts.slice(0, 3).some(isNaN)) {
        statusUpdate.red = parts[0];
        statusUpdate.green = parts[1];
        statusUpdate.blue = parts[2];
        parsedColor = ((parts[0] << 16) + (parts[1] << 8) + parts[2])
          .toString(16)
          .padStart(6, "0");
      }
    } else if (
      typeof colorInput === "string" &&
      /^[0-9a-fA-F]{6,}/.test(colorInput)
    ) {
      // Format "RRGGBB[WW[CC]]"
      parsedColor = colorInput.substring(0, 6);
    }

    if (parsedColor) {
      statusUpdate.color = parsedColor;
      // Ensure parsedColor is valid before using
      if (parsedColor) {
        const rgbInt = parseInt(statusUpdate.color, 16); // statusUpdate.color guaranteed string here

        statusUpdate.red = (rgbInt >> 16) & 255;
        statusUpdate.green = (rgbInt >> 8) & 255;
        statusUpdate.blue = rgbInt & 255;
      }
      hasUpdate = true;
    } else if (typeof colorInput === "string") {
      console.warn(
        `[Tasmota Parser] Unhandled Color format in RESULT: ${colorInput}`,
      );
    }
  }

  // Check for individual Channel1-5 properties in the state object
  if (state.Channel1 !== undefined && typeof state.Channel1 === 'number') { statusUpdate.Channel1 = state.Channel1; hasUpdate = true; }
  if (state.Channel2 !== undefined && typeof state.Channel2 === 'number') { statusUpdate.Channel2 = state.Channel2; hasUpdate = true; }
  if (state.Channel3 !== undefined && typeof state.Channel3 === 'number') { statusUpdate.Channel3 = state.Channel3; hasUpdate = true; }
  if (state.Channel4 !== undefined && typeof state.Channel4 === 'number') { statusUpdate.Channel4 = state.Channel4; hasUpdate = true; }
  if (state.Channel5 !== undefined && typeof state.Channel5 === 'number') { statusUpdate.Channel5 = state.Channel5; hasUpdate = true; }

  // Add other fields from STATE (Fade, Speed, HSBColor - Added for consistency)
  if (state.Fade !== undefined) {
    statusUpdate.Fade = state.Fade === "ON" ? "ON" : "OFF";
    hasUpdate = true;
  }
  if (state.Speed !== undefined && typeof state.Speed === 'number') {
    statusUpdate.Speed = state.Speed;
    hasUpdate = true;
  }
  if (state.HSBColor !== undefined && typeof state.HSBColor === 'string') {
    statusUpdate.HSBColor = state.HSBColor;
    hasUpdate = true;
  }

  return hasUpdate ? statusUpdate : null;
}

/**
 * Parses an incoming Tasmota MQTT message payload based on the topic.
 * Catches JSON parsing errors.
 * @param topic The full MQTT topic.
 * @param payload The message payload buffer.
 * @returns A partial BulbStatus update, or null if the message is irrelevant or invalid.
 */
export function parseTasmotaMessage(topic: string, payload: Buffer): Partial<BulbStatus> | null {
  const message = payload.toString();
  const topicParts = topic.split('/');

  // Basic validation: need at least 3 parts (e.g., prefix/device/command)
  if (topicParts.length < 3) {
    return null;
  }

  const prefix = topicParts[0];
  const command = topicParts[topicParts.length - 1]; // Get the last part as command

  try {
    // Check prefix and command ending
    if (prefix === 'stat' && command === 'POWER') {
      return parsePowerMessage(message);
    } else if (prefix === 'tele' && command === 'STATE') {
      return parseStateMessage(message);
    } else if (prefix === 'stat' && command === 'RESULT') {
      return parseResultMessage(message);
    }
  } catch (e: any) {
    console.error(
      `[Tasmota Parser] Failed to parse JSON for topic ${topic}: ${message}`,
      e,
    );

    return null; // Return null on parsing error
  }

  return null; // Topic didn't match known Tasmota status topics
}

// Future: Add functions here to build Tasmota command topics/payloads
// e.g., buildPowerCommand(mqttId: string, state: 'ON' | 'OFF') -> { topic: string, payload: string }
// e.g., buildColorCommand(mqttId: string, hexColor: string) -> { topic: string, payload: string }
// e.g., buildTemperatureCommand(mqttId: string, mired: number) -> { topic: string, payload: string }

// --- Tasmota Command Builders ---

/**
 * Builds the topic and payload for a Tasmota Power command.
 * @param tasmotaDeviceMqttId The MQTT ID (e.g., "spot_21").
 * @param state The desired power state.
 * @returns Object containing the topic and payload.
 */
export function buildTasmotaPowerCommand(
    tasmotaDeviceMqttId: string,
    state: 'ON' | 'OFF'
): { topic: string; payload: string } {
    const topic = `cmnd/${tasmotaDeviceMqttId}/Power`;
    const payload = state === 'ON' ? '1' : '0';
    return { topic, payload };
}

/**
 * Builds the topic and payload for a Tasmota Color command.
 * @param tasmotaDeviceMqttId The MQTT ID (e.g., "spot_21").
 * @param hexColor The desired color in hex format (e.g., "FF00AA").
 * @returns Object containing the topic and payload, or null if hex is invalid.
 */
export function buildTasmotaColorCommand(
    tasmotaDeviceMqttId: string,
    hexColor: string
): { topic: string; payload: string } | null {
    const sanitizedHex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
    // Basic validation
    if (!/^[0-9a-fA-F]{6}$/.test(sanitizedHex)) {
        console.error(`[Tasmota Builder] Invalid hex color format provided: ${hexColor}`);
        return null;
    }
    const topic = `cmnd/${tasmotaDeviceMqttId}/Color`;
    const payload = sanitizedHex;
    return { topic, payload };
}

/**
 * Builds the topic and payload for a Tasmota CT (Color Temperature) command.
 * @param tasmotaDeviceMqttId The MQTT ID (e.g., "spot_21").
 * @param miredValue The desired color temperature in Mireds.
 * @returns Object containing the topic and payload.
 */
export function buildTasmotaCTCommand(
    tasmotaDeviceMqttId: string,
    miredValue: number
): { topic: string; payload: string } {
    // Tasmota typically expects CT as an integer
    const validatedMired = Math.max(153, Math.min(500, Math.round(miredValue))); // Clamp to typical Tasmota range
    const topic = `cmnd/${tasmotaDeviceMqttId}/CT`;
    const payload = String(validatedMired);
    return { topic, payload };
}

/**
 * Builds the topic and payload for a Tasmota Fade command.
 * @param tasmotaDeviceMqttId The MQTT ID (e.g., "spot_21").
 * @param state The desired fade state ("ON" or "OFF").
 * @returns Object containing the topic and payload.
 */
export function buildTasmotaFadeCommand(
    tasmotaDeviceMqttId: string,
    state: 'ON' | 'OFF'
): { topic: string; payload: string } {
    const topic = `cmnd/${tasmotaDeviceMqttId}/Fade`;
    const payload = state === 'ON' ? '1' : '0';
    return { topic, payload };
}

/**
 * Builds the topic and payload for a Tasmota Speed command.
 * @param tasmotaDeviceMqttId The MQTT ID (e.g., "spot_21").
 * @param speedValue The desired transition speed (1-40).
 * @returns Object containing the topic and payload.
 */
export function buildTasmotaSpeedCommand(
    tasmotaDeviceMqttId: string,
    speedValue: number
): { topic: string; payload: string } {
    // Clamp speed value to Tasmota's valid range (1-40)
    const validatedSpeed = Math.max(1, Math.min(40, Math.round(speedValue)));
    const topic = `cmnd/${tasmotaDeviceMqttId}/Speed`;
    const payload = String(validatedSpeed);
    return { topic, payload };
}

/**
 * Builds the topic and payload for a Tasmota Dimmer command.
 * @param tasmotaDeviceMqttId The MQTT ID (e.g., "spot_21").
 * @param brightnessValue The desired brightness percentage (0-100).
 * @returns Object containing the topic and payload.
 */
export function buildTasmotaDimmerCommand(
    tasmotaDeviceMqttId: string,
    brightnessValue: number
): { topic: string; payload: string } {
    // Clamp brightness value to Tasmota's valid range (0-100)
    const validatedBrightness = Math.max(0, Math.min(100, Math.round(brightnessValue)));
    const topic = `cmnd/${tasmotaDeviceMqttId}/Dimmer`;
    const payload = String(validatedBrightness);
    return { topic, payload };
}
