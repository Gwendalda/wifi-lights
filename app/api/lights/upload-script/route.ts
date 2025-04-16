import { NextResponse } from 'next/server';
import { getDeviceById, getDevices } from '@/lib/devices';
import type { BulbDeviceData } from '@/lib/devices';

// Helper function to upload script to a single device
async function uploadScriptToDevice(device: BulbDeviceData, scriptName: string, scriptContent: string) {
    const ip = device.ip;
    if (!ip) {
        console.warn(`[API UploadScript] No IP found for device ${device.id}, skipping.`);
        return { status: 'skipped', deviceId: device.id };
    }

    const uploadUrl = `http://${ip}/api/lfs/${scriptName}`;
    console.log(`[API UploadScript ${device.id} (${ip})] Attempting upload to ${uploadUrl}`);

    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                // Add necessary headers based on device requirements
                // 'Content-Type': 'text/plain', // Or appropriate type?
            },
            body: scriptContent,
            // Consider adding a timeout? Requires AbortController
        });

        const responseText = await response.text(); // Read text first for better error logging

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
        }

        let result = { responseText }; // Default result if JSON parsing fails
        try {
            result = JSON.parse(responseText); // Tasmota might return JSON: {"fname":"...","size":...}
        } catch (jsonError) {
            console.warn(`[API UploadScript ${device.id} (${ip})] Response was not valid JSON: ${responseText}`);
            // Proceed considering it a success based on status code
        }

        console.log(`[API UploadScript ${device.id} (${ip})] Script uploaded successfully. Response:`, result);
        return { status: 'fulfilled', deviceId: device.id, ip: ip, result };
    } catch (error: any) {
        console.error(`[API UploadScript ${device.id} (${ip})] Failed to upload script:`, error.message || error);
        return { status: 'rejected', deviceId: device.id, ip: ip, reason: error.message || error };
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { deviceIds, scriptName, scriptContent } = body;

        // --- Input Validation ---
        if (!scriptName || typeof scriptName !== 'string' || !scriptName.match(/^[a-zA-Z0-9_\-\.]+\.bat$/i)) {
            return NextResponse.json({ error: 'Missing or invalid scriptName (must be *.bat file)' }, { status: 400 });
        }
        if (!scriptContent || typeof scriptContent !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid scriptContent' }, { status: 400 });
        }
        if (!Array.isArray(deviceIds) || deviceIds.some(id => typeof id !== 'string')) {
            return NextResponse.json({ error: 'Invalid deviceIds format (must be array of strings)' }, { status: 400 });
        }
        if (deviceIds.length === 0) {
            return NextResponse.json({ error: 'No deviceIds provided' }, { status: 400 });
        }

        console.log(`[API UploadScript] Request received for ${deviceIds.length} devices, script: ${scriptName}`);

        // --- Get Device Data (including IPs) ---
        const targetDevices: BulbDeviceData[] = (await Promise.all(
            deviceIds.map((id: string) => getDeviceById(id))
        )).filter(device => device !== undefined) as BulbDeviceData[];

        const foundDeviceIds = targetDevices.map(d => d.id);
        const missingDeviceIds = deviceIds.filter(id => !foundDeviceIds.includes(id));
        if (missingDeviceIds.length > 0) {
            console.warn(`[API UploadScript] Could not find data for devices: ${missingDeviceIds.join(', ')}`);
        }
        if (targetDevices.length === 0) {
            return NextResponse.json({ error: 'None of the specified devices were found' }, { status: 404 });
        }

        // --- Perform Uploads Concurrently ---
        console.log(`[API UploadScript] Starting uploads to ${targetDevices.length} devices...`);
        const uploadPromises = targetDevices.map(device =>
            uploadScriptToDevice(device, scriptName, scriptContent)
        );

        const uploadResults = await Promise.allSettled(uploadPromises);

        // --- Process Results ---
        const successfulUploads: { deviceId: string; ip: string | undefined }[] = [];
        const failedUploads: { deviceId: string; ip?: string | undefined; reason: any }[] = [];
        const skippedUploads: { deviceId: string }[] = [];

        uploadResults.forEach(result => {
            if (result.status === 'fulfilled') {
                if (result.value.status === 'fulfilled') {
                    successfulUploads.push({ deviceId: result.value.deviceId, ip: result.value.ip });
                } else if (result.value.status === 'skipped') {
                    skippedUploads.push({ deviceId: result.value.deviceId });
                } else { // status === 'rejected' inside the helper
                    failedUploads.push({ deviceId: result.value.deviceId, ip: result.value.ip, reason: result.value.reason });
                }
            } else { // Promise itself was rejected (less likely with the helper's try/catch)
                console.error(`[API UploadScript] Unexpected promise rejection:`, result.reason);
                // We don't know which device it was for easily here, might need more robust handling
                failedUploads.push({ deviceId: 'unknown', reason: result.reason });
            }
        });

        console.log(`[API UploadScript] Upload process completed. Success: ${successfulUploads.length}, Failed: ${failedUploads.length}, Skipped: ${skippedUploads.length}`);

        return NextResponse.json({
            message: `Script upload process finished.`,
            successfulUploads,
            failedUploads,
            skippedUploads,
            missingDeviceIds
        }, { status: 200 }); // Return 200 even if some fail, details are in the body

    } catch (error: any) {
        console.error('[API UploadScript] General Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        let status = 500;
        if (error instanceof SyntaxError) status = 400; // Bad request if JSON parse fails (e.g., request body)
        return NextResponse.json({ error: `Failed to process script upload request: ${errorMessage}` }, { status });
    }
} 