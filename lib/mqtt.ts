import mqtt from "mqtt";

import { getDeviceIdFromTopic, updateDeviceStatus } from "./devices"; // Import device helpers
import { parseTasmotaMessage } from "./tasmota"; // Import the Tasmota parser

// --- Constants ---
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://10.0.0.195:1883"; // Default if not set
const MQTT_CLIENT_ID = `wifi-lights-server-${Math.random().toString(16).substring(2, 8)}`;
const MQTT_USERNAME = process.env.MQTT_USERNAME; // Can be undefined if no auth
const MQTT_PASSWORD = process.env.MQTT_PASSWORD; // Can be undefined if no auth

const MQTT_CONNECT_OPTIONS: mqtt.IClientOptions = {
  clientId: MQTT_CLIENT_ID,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  connectTimeout: 5000, // 5 seconds
  reconnectPeriod: 1000, // Try reconnecting every second
  clean: true, // Start with a clean session
};

// --- State ---
let mqttClient: mqtt.MqttClient | null = null;
let connectionPromise: Promise<mqtt.MqttClient> | null = null;
let isConnecting = false;
let handlersAttached = false;
let subscriptionsDone = false;

// --- Topics ---
const TasmotaStateTopic = "tele/+/STATE";
const TasmotaPowerStatusTopic = "stat/+/POWER";
const TasmotaResultTopic = "stat/+/RESULT"; // Added for RESULT parsing

// --- Private Functions ---

/**
 * Handles incoming MQTT messages, parses them, and updates device status.
 */
async function handleMqttMessage(
  topic: string,
  payload: Buffer,
): Promise<void> {
  // console.log(`[MQTT MSG Received] Topic: ${topic}`); // Verbose log
  const deviceId = getDeviceIdFromTopic(topic);

  if (!deviceId) {
    // console.log(`[MQTT MSG Ignored] Unknown device topic: ${topic}`);
    return;
  }

  // Use the dedicated parser
  const statusUpdate = parseTasmotaMessage(topic, payload);

  // parseTasmotaMessage returns null if parsing fails or topic is irrelevant
  if (!statusUpdate) {
    return;
  }

  if (statusUpdate && Object.keys(statusUpdate).length > 0) {
    console.log(
      `[MQTT Status Update] Device: ${deviceId}, Update:`,
      statusUpdate,
    );
    await updateDeviceStatus(deviceId, statusUpdate);
  } else {
    // console.log(`[MQTT MSG Ignored] No relevant status found in message from topic: ${topic}`);
  }
}

// --- Tasmota Message Parsers (Moved here from lights.ts) ---
// Moved to lib/tasmota.ts
// function parsePowerMessage(message: string): Partial<BulbStatus> { ... }
// function parseStateMessage(message: string): Partial<BulbStatus> { ... }
// function parseResultMessage(message: string): Partial<BulbStatus> | null { ... }

/**
 * Attaches persistent event handlers to the MQTT client.
 */
function attachEventHandlers(client: mqtt.MqttClient) {
  if (handlersAttached && client === mqttClient) return; // Avoid duplicate handlers on same client

  console.log("[MQTT] Attaching persistent event handlers...");

  // Remove existing listeners first to prevent duplicates
  client.removeAllListeners("message");
  client.removeAllListeners("connect"); // Also remove connect listener if re-attaching
  client.removeAllListeners("reconnect");
  client.removeAllListeners("close");
  client.removeAllListeners("offline");
  client.removeAllListeners("error");

  client.on("message", (topic, payload) => {
    handleMqttMessage(topic, payload);
  });

  client.on("connect", () => {
    console.log(`[MQTT Event] Connected: ${client.options.clientId}`);
    isConnecting = false;
    // Resubscribe on successful (re)connection
    subscribeToTopics(client);
  });

  client.on("reconnect", () => {
    console.log("[MQTT Event] Reconnecting...");
    isConnecting = true; // Mark as connecting during reconnect attempts
    subscriptionsDone = false; // Need to resubscribe after reconnect
  });

  client.on("close", () => {
    console.log("[MQTT Event] Connection closed.");
    if (client === mqttClient) {
      // Only clear state if it's the active client
      mqttClient = null;
      connectionPromise = null;
      isConnecting = false;
      handlersAttached = false;
      subscriptionsDone = false;
    }
  });

  client.on("offline", () => {
    console.log("[MQTT Event] Client offline.");
    if (client === mqttClient) {
      mqttClient = null;
      connectionPromise = null;
      isConnecting = false;
      handlersAttached = false;
      subscriptionsDone = false;
    }
  });

  client.on("error", (error) => {
    console.error("[MQTT Event] Client error:", error);
    if (client === mqttClient) {
      // Attempt to end the client, but don't block/wait indefinitely
      try {
        client.end(true);
      } catch (e) {
        console.error("[MQTT] Error ending client after error event:", e);
      }
      mqttClient = null;
      connectionPromise = null;
      isConnecting = false;
      handlersAttached = false;
      subscriptionsDone = false;
    }
  });

  // Handle graceful shutdown
  // Ensure this is only attached once per process
  if (
    !process.listeners("SIGINT").some((l) => l.name === "bound sigintHandler")
  ) {
    const sigintHandler = () => {
      if (mqttClient && mqttClient.connected) {
        console.log("[MQTT] SIGINT received, disconnecting MQTT client...");
        mqttClient.end(true, () => {
          // Force close
          console.log("[MQTT] Client disconnected on app termination");
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on("SIGINT", sigintHandler);
  }

  handlersAttached = true;
}

/**
 * Subscribes the client to the necessary Tasmota topics.
 */
async function subscribeToTopics(client: mqtt.MqttClient): Promise<void> {
  if (subscriptionsDone) {
    // console.log("[MQTT] Subscriptions already performed for this connection.");
    return;
  }
  try {
    console.log("[MQTT] Subscribing to topics...");
    // Use QoS 1 for potentially better reliability on status updates
    await client.subscribeAsync(TasmotaStateTopic, { qos: 1 });
    console.log(`[MQTT] Subscribed to ${TasmotaStateTopic}`);
    await client.subscribeAsync(TasmotaPowerStatusTopic, { qos: 1 });
    console.log(`[MQTT] Subscribed to ${TasmotaPowerStatusTopic}`);
    await client.subscribeAsync(TasmotaResultTopic, { qos: 1 });
    console.log(`[MQTT] Subscribed to ${TasmotaResultTopic}`);
    subscriptionsDone = true; // Mark subscriptions as done for this connection cycle
    console.log("[MQTT] Subscriptions complete.");
  } catch (subError) {
    console.error("[MQTT] Subscription error:", subError);
    subscriptionsDone = false; // Reset flag on error
    // Optional: attempt to close client or handle differently
    // throw subError; // Re-throwing might be handled by the connect logic
  }
}

// --- Public API ---

/**
 * Gets a connected MQTT client instance. Handles connection logic, retries, and state.
 * This should be the primary way to obtain a client for publishing.
 * @returns A promise that resolves with a connected MqttClient instance.
 */
export function getMqttClient(): Promise<mqtt.MqttClient> {
  if (mqttClient && mqttClient.connected && subscriptionsDone) {
    return Promise.resolve(mqttClient);
  }

  if (isConnecting && connectionPromise) {
    console.log(
      "[MQTT] Connection attempt already in progress, returning existing promise.",
    );

    return connectionPromise;
  }

  // If client exists but is disconnected/reconnecting, return promise that resolves on next 'connect' event
  if (mqttClient && !mqttClient.connected) {
    console.log(
      "[MQTT] Client exists but is not fully connected/subscribed, returning promise...",
    );
    // If already connecting, return existing promise
    if (isConnecting && connectionPromise) return connectionPromise;

    // Otherwise, create a new promise waiting for the 'connect' event
    return new Promise((resolve, reject) => {
      const connectListener = () => {
        // console.log("[MQTT] Reconnected via listener, resolving promise.");
        if (mqttClient && mqttClient.connected && subscriptionsDone) {
          resolve(mqttClient);
        } else {
          // This state shouldn't ideally happen if connect fires and subscribes work
          console.error(
            "[MQTT] Reconnect listener fired but client not ready?",
          );
          reject(new Error("MQTT client reconnected but was not ready."));
        }
      };
      const errorListener = (err: Error) => {
        console.error("[MQTT] Error while waiting for reconnect:", err);
        // Add null check before removing listeners
        if (mqttClient) {
          mqttClient.removeListener("connect", connectListener);
        }
        reject(err);
      };

      // Attach listeners that will be cleaned up
      // Check mqttClient still exists before attaching
      if (mqttClient) {
        mqttClient.once("connect", connectListener);
        mqttClient.once("error", errorListener);
      } else {
        // This case should ideally not be reachable if the outer check was correct
        console.error(
          "[MQTT] mqttClient became null unexpectedly while setting up reconnect listeners.",
        );
        reject(new Error("MQTT Client state error during reconnect setup."));
      }
      // Add a timeout? If reconnect fails indefinitely?
    });
  }

  // Initiate a new connection
  isConnecting = true;
  subscriptionsDone = false; // Reset subscriptions flag
  console.log(`[MQTT] Initiating new connection to ${MQTT_BROKER_URL}...`);

  connectionPromise = new Promise((resolve, reject) => {
    const newClient = mqtt.connect(MQTT_BROKER_URL, MQTT_CONNECT_OPTIONS);

    // Assign globally *before* attaching handlers that might use it
    mqttClient = newClient;

    // Attach persistent handlers (will include the 'connect' handler)
    attachEventHandlers(newClient);

    // Handlers specific to *this* initial connection attempt's promise
    const initialConnectHandler = () => {
      // The persistent 'connect' handler in attachEventHandlers
      // now handles subscription logic. We just resolve the promise here.
      console.log("[MQTT] Initial connection successful.");
      if (newClient.connected && subscriptionsDone) {
        resolve(newClient);
      } else {
        // If subscriptions failed during connect, the promise should be rejected
        // This path might indicate an issue if connect fires but subs don't complete
        console.warn(
          "[MQTT] Initial connect fired, but subscriptions not marked done. Waiting...",
        );
        // Re-check in a moment, maybe subscriptions are slightly delayed?
        setTimeout(() => {
          if (newClient.connected && subscriptionsDone) {
            resolve(newClient);
          } else if (!newClient.connected) {
            reject(
              new Error(
                "MQTT client disconnected after initial connect before subscriptions completed.",
              ),
            );
          } else {
            reject(
              new Error(
                "MQTT client connected but subscriptions failed to complete.",
              ),
            );
          }
        }, 500); // Wait 500ms for subscriptions
      }
    };

    const initialErrorHandler = (error: Error) => {
      console.error("[MQTT] Error during initial connection attempt:", error);
      // Clean up temporary listeners for this attempt
      newClient.removeListener("connect", initialConnectHandler);
      // Persistent error handler in attachEventHandlers will handle client state cleanup
      isConnecting = false; // Reset connecting flag
      connectionPromise = null; // Clear the promise
      reject(error);
    };

    // Attach temporary listeners for *this* connection promise
    newClient.once("connect", initialConnectHandler);
    newClient.once("error", initialErrorHandler);
  });

  return connectionPromise;
}

/**
 * Publishes a single MQTT message to a specific topic.
 * Ensures the client is connected before publishing.
 * @param topic The MQTT topic.
 * @param message The message payload (string or Buffer).
 * @param options Optional MQTT publish options.
 */
export async function publishMqttMessage(
  topic: string,
  message: string | Buffer,
  options?: mqtt.IClientPublishOptions,
): Promise<void> {
  try {
    const client = await getMqttClient(); // Wait for connected & subscribed client

    // console.log(`[MQTT PUB] ${topic} -> ${message}`); // Debug log
    await client.publishAsync(topic, message, options);
  } catch (error) {
    console.error(`[MQTT PUB Error] Failed to publish to ${topic}:`, error);
    throw error; // Re-throw to allow caller to handle
  }
}

/**
 * Publishes a command string to multiple devices by constructing the correct
 * Tasmota cmnd topic for each device ID.
 * e.g., command = "Power ON" for deviceId "light1" with mqttId "spot_21"
 * becomes publish("cmnd/spot_21/Power", "ON")
 *
 * @param deviceIds Array of internal device IDs.
 * @param command The full command string (e.g., "Color FF0000", "Dimmer 50", "addRepeatingEvent 1 1 1 exec foo.txt").
 * @param options Optional MQTT publish options.
 */
export async function publishCommandsToDevices(
    deviceIds: string[],
    command: string,
    options?: mqtt.IClientPublishOptions
): Promise<void> {
    if (!command) {
        console.warn("[MQTT Publish] Empty command provided. Skipping publish.");
        return;
    }

    console.log(`[MQTT Publish] Publishing command "${command}" to ${deviceIds.length} devices: ${deviceIds.join(', ')}`);

    // Import necessary device functions here to avoid circular dependency issues at module load
    const { getDeviceById, getDeviceMqttId } = await import('@/lib/devices');

    const publishPromises = deviceIds.map(async (deviceId) => {
        const device = await getDeviceById(deviceId);
        if (!device) {
            console.warn(`[MQTT Publish] Device ${deviceId} not found. Skipping publish for this device.`);
            return; // Skip this device
        }

        const mqttId = getDeviceMqttId(device);
        if (mqttId.includes('invalid')) {
             console.warn(`[MQTT Publish] Invalid MQTT ID for device ${deviceId}. Skipping publish.`);
             return; // Skip invalid device
        }

        // Split command into command name and payload
        // Assumes command is like "CommandName Payload" or just "CommandName"
        const commandParts = command.trim().split(/\s+/);
        const commandName = commandParts[0];
        const payload = commandParts.slice(1).join(' '); // Re-join payload if it had spaces

        if (!commandName) {
            console.warn(`[MQTT Publish] Could not extract command name from "${command}" for device ${deviceId}. Skipping.`);
            return;
        }

        const topic = `cmnd/${mqttId}/${commandName}`;

        try {
            // console.log(`[MQTT Publish] Sending to ${topic}: ${payload || '<empty>'}`); // Verbose log
            await publishMqttMessage(topic, payload, options);
        } catch (error) {
            console.error(`[MQTT Publish] Error publishing command "${commandName}" to device ${deviceId} (${topic}):`, error);
            // Optionally re-throw or collect errors
        }
    });

    // Wait for all publish attempts to complete
    await Promise.all(publishPromises);
    // console.log(`[MQTT Publish] Finished publishing command "${command}" to devices.`);
}

/**
 * Disconnects the MQTT client gracefully.
 */
export async function disconnectMqtt(): Promise<void> {
  const client = mqttClient; // Capture current client

  if (client && client.connected) {
    console.log("[MQTT] Disconnecting client...");
    try {
      await client.endAsync(true); // Force close if needed
      console.log("[MQTT] Client disconnected successfully.");
    } catch (error) {
      console.error("[MQTT] Error during disconnect:", error);
    }
  }
  // Clear state regardless of connection status
  mqttClient = null;
  connectionPromise = null;
  isConnecting = false;
  handlersAttached = false;
  subscriptionsDone = false;
}

// Optional: Auto-connect on module load or require explicit connect call?
// Let's require an explicit connect call for better control.
// console.log("[MQTT] Module loaded. Call getMqttClient() to connect.");
