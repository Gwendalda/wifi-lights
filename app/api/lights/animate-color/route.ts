import { NextResponse } from 'next/server';
import { publishCommandsToDevices } from '@/lib/mqtt';
import { getDeviceById, getDeviceMqttId } from '@/lib/devices';
import type { BulbDeviceData } from '@/lib/devices';
import { hexToRgb } from '@/lib/colors';
import { readFile } from 'fs/promises'; // Need file reading again
import path from 'path'; // Need path again

const SCRIPT_NAME = 'color_fade.bat'; // Need script name

// Channel definitions for API-managed delta-based script
const DELTA_R_CH = 6;
const DELTA_G_CH = 7;
const DELTA_B_CH = 8;
const DELTA_COOL_CH = 9;
const DELTA_WARM_CH = 10;
const STEP_DELAY_MS_CH = 11; // Channel holds delay in MS for the backlog command
const STEP_COUNT_CH = 12;    // Channel holds remaining steps

const DESIRED_INTERVAL_SECONDS = 0.1;
const MIN_INTERVAL_SECONDS = 0.002;
const REPEATING_EVENT_ID = 1; // Use ID 1 for the animation event
const SETUP_DELAY_MS = 100; // Delay after setup commands before creating event

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { targetColor, duration, deviceIds: requestedDeviceIds } = body;

    // --- Read Script Content ---
    let scriptContent: string;
    try {
        const scriptPath = path.join(process.cwd(), SCRIPT_NAME);
        scriptContent = await readFile(scriptPath, 'utf8');
        console.log(`[API Animate ScriptExecV2] Using script '${SCRIPT_NAME}'`);
    } catch (err) {
        console.error(`[API Animate ScriptExecV2] Error reading script file '${SCRIPT_NAME}':`, err);
        return NextResponse.json({ error: `Failed to read animation script '${SCRIPT_NAME}'` }, { status: 500 });
    }

    // --- Input Validation ---
    if (!targetColor || typeof targetColor !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid targetColor' }, { status: 400 });
    }
    duration = Number(duration);
    if (isNaN(duration) || duration <= 0) {
      return NextResponse.json({ error: 'Missing or invalid duration' }, { status: 400 });
    }
    if (requestedDeviceIds && (!Array.isArray(requestedDeviceIds) || requestedDeviceIds.some(id => typeof id !== 'string'))) {
        return NextResponse.json({ error: 'Invalid deviceIds format' }, { status: 400 });
    }

    // --- Target State Calculation ---
    const targetRgb = hexToRgb(targetColor);
    if (!targetRgb) {
      return NextResponse.json({ error: 'Invalid hexColor format' }, { status: 400 });
    }
    const targetState = { r: targetRgb.r, g: targetRgb.g, b: targetRgb.b, cool: 0, warm: 0 };

    // --- Animation Parameters ---
    const intervalSeconds = Math.max(MIN_INTERVAL_SECONDS, DESIRED_INTERVAL_SECONDS);
    const totalSteps = Math.max(1, Math.round(duration / intervalSeconds));
    const stepDelayMs = Math.round(intervalSeconds * 1000);
    const intervalSecondsR = parseFloat(intervalSeconds.toFixed(3));

    // --- Determine Target Device Objects ---
    let targetDevices: BulbDeviceData[] = [];
    if (requestedDeviceIds && requestedDeviceIds.length > 0) {
        targetDevices = (await Promise.all(
            requestedDeviceIds.map((id: string) => getDeviceById(id))
        )).filter(device => device !== undefined) as BulbDeviceData[];
    } else {
        const { getDevices } = await import('@/lib/devices');
        targetDevices = await getDevices();
    }
    if (targetDevices.length === 0) {
        return NextResponse.json({ error: 'No target devices found or specified' }, { status: 404 });
    }

    // --- Upload Script (Optional but recommended) ---
    console.log(`[API Animate ScriptExecV2] Ensuring script '${SCRIPT_NAME}' is uploaded...`);
    const uploadPromises = targetDevices.map(async (device) => {
        const ip = device.ip;
        if (!ip) { console.warn(`[API Animate ScriptExecV2 Upload] No IP for ${device.id}, skipping.`); return { status: 'skipped', deviceId: device.id }; }
        const uploadUrl = `http://${ip}/api/lfs/${SCRIPT_NAME}`;
        try {
            const response = await fetch(uploadUrl, { method: 'POST', headers: { 'accept': '*/*' }, body: scriptContent });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return { status: 'fulfilled', deviceId: device.id };
        } catch (error: any) { console.error(`[API Animate ScriptExecV2 Upload ${device.id}] Failed:`, error.message || error); return { status: 'rejected', deviceId: device.id }; }
    });
    await Promise.allSettled(uploadPromises);

    // --- Prepare and Send MQTT Commands ---
    console.log(`[API Animate ScriptExecV2] Setting up animation for ${targetDevices.length} devices. Steps: ${totalSteps}, Interval: ${intervalSecondsR}s`);

    for (const device of targetDevices) {
        const deviceId = device.id;
        const mqttId = getDeviceMqttId(device);
        if (mqttId.includes('invalid')) {
            console.warn(`[API Animate ScriptExecV2 ${deviceId}] Invalid MQTT ID, skipping.`);
            continue;
        }

        // Get Initial State (using logic from previous step)
        let initialR = 0, initialG = 0, initialB = 0, initialCool = 0, initialWarm = 0;
        const status = device.last_status;
        if (status?.power === 'ON') {
            if (typeof status.Color === 'string' && status.Color.includes(',')) {
                 const parts = status.Color.split(',').map(Number);
                 if (parts.length >= 5 && !parts.some(isNaN)) { initialR = parts[0]; initialG = parts[1]; initialB = parts[2]; initialWarm = parts[3]; initialCool = parts[4]; }
                 else if (parts.length >= 3 && !parts.slice(0, 3).some(isNaN)) { initialR = parts[0]; initialG = parts[1]; initialB = parts[2]; }
                 else { initialR = status.red ?? 0; initialG = status.green ?? 0; initialB = status.blue ?? 0; }
             } else { initialR = status.red ?? 0; initialG = status.green ?? 0; initialB = status.blue ?? 0; }
        }
        const initialState = { r: initialR, g: initialG, b: initialB, cool: initialCool, warm: initialWarm };

        // console.log(`[API Animate ScriptExecV2 ${deviceId}] Initial State R:${initialState.r} G:${initialState.g} B:${initialState.b} C:${initialState.cool} W:${initialState.warm}`);
        // console.log(`[API Animate ScriptExecV2 ${deviceId}] Target State R:${targetState.r} G:${targetState.g} B:${targetState.b} C:${targetState.cool} W:${targetState.warm}`);

        // Calculate Deltas
        const deltas = {
            r: (targetState.r - initialState.r) / totalSteps,
            g: (targetState.g - initialState.g) / totalSteps,
            b: (targetState.b - initialState.b) / totalSteps,
            cool: (targetState.cool - initialState.cool) / totalSteps,
            warm: (targetState.warm - initialState.warm) / totalSteps,
        };
        const deltaRR = parseFloat(deltas.r.toFixed(3));
        const deltaGR = parseFloat(deltas.g.toFixed(3));
        const deltaBR = parseFloat(deltas.b.toFixed(3));
        const deltaCR = parseFloat(deltas.cool.toFixed(3));
        const deltaWR = parseFloat(deltas.warm.toFixed(3));

        // console.log(`[API Animate ScriptExecV2 ${deviceId}] Deltas R:${deltaRR} G:${deltaGR} B:${deltaBR} C:${deltaCR} W:${deltaWR}`);

        // --- Send Setup Commands FIRST ---
        const setupCommands = [
            `setChannel ${DELTA_R_CH} ${deltaRR}`,
            `setChannel ${DELTA_G_CH} ${deltaGR}`,
            `setChannel ${DELTA_B_CH} ${deltaBR}`,
            `setChannel ${DELTA_COOL_CH} ${deltaCR}`,
            `setChannel ${DELTA_WARM_CH} ${deltaWR}`,
            `setChannel ${STEP_DELAY_MS_CH} ${stepDelayMs}`,
            `setChannel ${STEP_COUNT_CH} ${totalSteps}`
        ];
        console.log(`[API Animate ScriptExecV2 ${deviceId}] Sending ${setupCommands.length} setup commands...`);
        for (const command of setupCommands) {
            await publishCommandsToDevices([deviceId], command);
            await new Promise(resolve => setTimeout(resolve, 25)); // Short delay between setup commands
        }

        // --- Wait for setup to process ---
        console.log(`[API Animate ScriptExecV2 ${deviceId}] Waiting ${SETUP_DELAY_MS}ms for setup to complete...`);
        await new Promise(resolve => setTimeout(resolve, SETUP_DELAY_MS));

        // --- Send Event Creation Commands ---
        const eventCommands = [
             `cancelRepeatingEvent ${REPEATING_EVENT_ID}`,
             `addRepeatingEventID  ${intervalSecondsR} ${totalSteps} ${REPEATING_EVENT_ID} exec ${SCRIPT_NAME}`
        ];
        console.log(`[API Animate ScriptExecV2 ${deviceId}] Sending ${eventCommands.length} event commands...`);
         for (const command of eventCommands) {
            await publishCommandsToDevices([deviceId], command);
            await new Promise(resolve => setTimeout(resolve, 50)); // Delay between cancel and add
        }

        console.log(`[API Animate ScriptExecV2 ${deviceId}] Setup complete, animation event added.`);
    }

    console.log('[API Animate ScriptExecV2] All device animation setups initiated.');
    return NextResponse.json({ message: 'Script-based delta fade V2 animation started' }, { status: 200 });

  } catch (error: any) {
    console.error('[API Animate ScriptExecV2] Error starting animation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    let status = 500;
    if (error instanceof SyntaxError) status = 400;
    return NextResponse.json({ error: `Failed to start animation: ${errorMessage}` }, { status });
  }
} 