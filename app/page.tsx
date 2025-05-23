/* eslint-disable */
"use client";

import { useState, useEffect, useRef } from "react";
import type { LightDeviceData as BulbDeviceData } from "@/lib/lights";

export default function Home() {
  const [devices, setDevices] = useState<BulbDeviceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff");
  const [selectedTemperature, setSelectedTemperature] = useState<number>(4000);
  const [brightnessLevel, setBrightnessLevel] = useState<number>(100);
  const [activeDeviceEvents, setActiveDeviceEvents] = useState<Record<string, any[] | null>>({});
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const tempThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const brightnessThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const TEMP_THROTTLE_DELAY = 150;
  const BRIGHTNESS_THROTTLE_DELAY = 150;
  const [rawCommand, setRawCommand] = useState<string>("");
  const [animationDuration, setAnimationDuration] = useState<number>(10);
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [scriptContent, setScriptContent] = useState<string | null>(null);
  const [isUploadingScript, setIsUploadingScript] = useState<boolean>(false);
  const [activeControlTab, setActiveControlTab] = useState<string>("brightness_temp");
  const [isEventsAccordionOpen, setIsEventsAccordionOpen] = useState<boolean>(false);

  const controlTabs = [
    { key: "brightness_temp", title: "Brightness & Temp" },
    { key: "animations", title: "Animations" },
    { key: "scripts", title: "Scripts" },
    { key: "raw_command", title: "Raw Command" },
  ];

  const fetchDeviceStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/lights/status");

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }
      const data = await response.json();

      setDevices(data.devices || []);
    } catch (err: any) {
      console.error("Error fetching device status:", err);
      setError(err.message || "Could not load device status.");
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiAction = async (
    apiUrl: string,
    body: object | null,
    actionName: string,
  ) => {
    setIsActionLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : null,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          `Failed to ${actionName}: ${response.statusText} ${errorData.error ? `- ${errorData.error}` : ""}`,
        );
      }
      console.log(`${actionName} successful`);
      setTimeout(fetchDeviceStatus, 1000);
    } catch (err: any) {
      console.error(`Error during ${actionName}:`, err);
      setError(err.message || `Could not perform action: ${actionName}.`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const turnOn = () => {
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      handleApiAction("/api/lights/on", targetDeviceIds ? { deviceIds: targetDeviceIds } : {}, "turn on");
  };
  const turnOff = () => {
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      handleApiAction("/api/lights/off", targetDeviceIds ? { deviceIds: targetDeviceIds } : {}, "turn off");
  };
  const setColor = () => {
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      handleApiAction(
          "/api/lights/color",
          { hexColor: selectedColor, ...(targetDeviceIds && { deviceIds: targetDeviceIds }) },
          "set color"
      );
  };
  const handleTemperatureChange = (value: number | number[]) => {
    const tempValue = Array.isArray(value) ? value[0] : value;
    if (typeof tempValue !== "number") return;
    setSelectedTemperature(tempValue);

    if (tempThrottleTimeoutRef.current) clearTimeout(tempThrottleTimeoutRef.current);
    tempThrottleTimeoutRef.current = setTimeout(async () => {
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      console.log(`Throttled Temp Change: Sending ${tempValue}K`);
      try {
        await fetch("/api/lights/temperature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kelvin: tempValue, ...(targetDeviceIds && { deviceIds: targetDeviceIds }) }),
        });
        // ... error handling ...
      } catch (err) { /* ... */ }
      tempThrottleTimeoutRef.current = null;
    }, TEMP_THROTTLE_DELAY);
  };

  // --- Handler for Standard Brightness Slider (Throttled) ---
  const handleBrightnessChange = (value: number | number[]) => {
    const brightnessValue = Array.isArray(value) ? value[0] : value;
    if (typeof brightnessValue !== "number") return;
    setBrightnessLevel(brightnessValue);

    setDevices(currentDevices => 
      currentDevices.map(device => {
        if (selectedDeviceIds.size === 0 || selectedDeviceIds.has(device.id)) {
          return {
            ...device,
            last_status: {
              ...device.last_status,
              Dimmer: brightnessValue
            }
          };
        }
        return device;
      })
    );

    if (brightnessThrottleTimeoutRef.current) {
      clearTimeout(brightnessThrottleTimeoutRef.current);
    }

    brightnessThrottleTimeoutRef.current = setTimeout(async () => {
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      const target = targetDeviceIds ? `${targetDeviceIds.length} selected devices` : 'all devices';
      console.log(`Throttled Brightness Change: Sending ${brightnessValue}% to ${target}`);
      try {
        const response = await fetch("/api/lights/brightness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brightness: brightnessValue, ...(targetDeviceIds && { deviceIds: targetDeviceIds }) }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            `Brightness change failed: ${response.statusText} ${errorData.error ? `- ${errorData.error}` : ""}`,
          );  
          fetchDeviceStatus();
        }
      } catch (err: any) {
        console.error("Error during brightness change:", err);
        fetchDeviceStatus();
      }
      brightnessThrottleTimeoutRef.current = null;
    }, BRIGHTNESS_THROTTLE_DELAY);
  };

  // --- Handler for Fetching Active Events ---
  const handleFetchEvents = async () => {
      setIsLoadingEvents(true);
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      console.log(`UI: Fetching events for ${targetDeviceIds ? 'selected' : 'all'} devices.`);
      try {
          const response = await fetch('/api/lights/list-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: targetDeviceIds ? JSON.stringify({ deviceIds: targetDeviceIds }) : null
          });
          if (!response.ok) {
              throw new Error(`Failed to fetch events: ${response.statusText}`);
          }
          const data = await response.json();
          if (data && data.eventsByDevice) {
              setActiveDeviceEvents(data.eventsByDevice);
          } else {
              console.error("UI: Invalid data received from /list-events", data);
              setActiveDeviceEvents({});
          }
      } catch (error) {
          console.error("UI: Error fetching active events:", error);
          setError(`Failed to load active events. ${error instanceof Error ? error.message : ''}`);
          setActiveDeviceEvents({});
      } finally {
          setIsLoadingEvents(false);
      }
  };

  // --- Handler for Cancelling an Animation ---
  const handleCancelAnimation = async (deviceId: string, eventId: number) => {
    console.log(`UI: Requesting cancellation for event ${eventId} on ${deviceId}`);
    await handleApiAction(
        '/api/lights/cancel-animation',
        { deviceId, eventId },
        `cancel animation ${eventId} on ${deviceId}`
    );
    setTimeout(handleFetchEvents, 1000);
  };

  // --- Handler for Clearing All Animations ---
  const handleClearAllAnimations = async () => {
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      console.log(`UI: Clearing all events for ${targetDeviceIds ? 'selected' : 'all'} devices.`);
      await handleApiAction(
          '/api/lights/clear-animations',
          targetDeviceIds ? { deviceIds: targetDeviceIds } : null,
          `clear all animations for ${targetDeviceIds ? 'selected' : 'all'} devices`
      );
      setTimeout(handleFetchEvents, 1000);
  };

  // --- Handler for Sending Raw Command ---
  const handleSendRawCommand = () => {
      if (rawCommand.trim() === "") {
          setError("Command cannot be empty.");
          return;
      }
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      console.log(`UI: Sending raw command "${rawCommand}" to ${targetDeviceIds ? 'selected' : 'all'} devices.`);
      handleApiAction(
          '/api/lights/raw-command',
          { command: rawCommand, ...(targetDeviceIds && { deviceIds: targetDeviceIds }) },
          `send raw command`
      );
  };

  // --- Handler for Animation Duration Change ---
  const handleAnimationDurationChange = (value: number | number[]) => {
    const durationValue = Array.isArray(value) ? value[0] : value;
    if (typeof durationValue !== "number") return;
    setAnimationDuration(durationValue);
  };

  // --- Handler for Starting Color Fade ---
  const handleStartColorFade = () => {
    const targetDeviceIds =
      selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
    console.log(
      `UI: Starting color fade to ${selectedColor} @ ${brightnessLevel}% over ${animationDuration}s for ${targetDeviceIds ? "selected" : "all"} devices.`,
    );
    handleApiAction(
      "/api/lights/animate-color",
      {
        targetColor: selectedColor,
        duration: animationDuration,
        brightness: brightnessLevel,
        ...(targetDeviceIds && { deviceIds: targetDeviceIds }),
      },
      "start color fade animation",
    );
  };

  // --- Handler for Script File Selection ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.name.toLowerCase().endsWith('.bat')) {
            setScriptFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    setScriptContent(text);
                      setError(null);
                } else {
                    setError("Failed to read file content.");
                    setScriptFile(null);
                    setScriptContent(null);
                }
            };
            reader.onerror = () => {
                setError("Error reading file.");
                setScriptFile(null);
                setScriptContent(null);
            };
            reader.readAsText(file);
        } else {
            setError("Invalid file type. Please select a .bat file.");
            setScriptFile(null);
            setScriptContent(null);
            event.target.value = '';
        }
    } else {
        setScriptFile(null);
        setScriptContent(null);
    }
  };

  const handleUploadScript = async () => {
    if (!scriptFile || !scriptContent) {
      setError("Please select a .bat script file first.");
      return;
    }
    if (selectedDeviceIds.size === 0) {
      setError("Please select at least one device to upload the script to.");
      return;
    }

    const targetDeviceIds = Array.from(selectedDeviceIds);
    const scriptName = scriptFile.name;

    console.log(`UI: Uploading script "${scriptName}" to ${targetDeviceIds.length} devices.`);
    setIsUploadingScript(true);
    setError(null);

    try {
      const response = await fetch("/api/lights/upload-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceIds: targetDeviceIds,
          scriptName: scriptName,
          scriptContent: scriptContent,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to upload script: ${response.statusText}`);
      }

      console.log("Script upload finished:", result);
      setError(null);
      alert(`Script upload process finished. Success: ${result.successfulUploads?.length || 0}, Failed: ${result.failedUploads?.length || 0}, Skipped: ${result.skippedUploads?.length || 0}. Check console for details.`);

    } catch (err: any) {
      console.error("Error uploading script:", err);
      setError(err.message || "Could not upload script.");
    } finally {
      setIsUploadingScript(false);
    }
  };

  useEffect(() => {
    fetchDeviceStatus();
    const intervalId = setInterval(() => {
        setDevices(currentDevices => [...currentDevices]);
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const aggregatedEvents = Object.entries(activeDeviceEvents)
      .filter(([, events]) => events !== null && events.length > 0)
      .flatMap(([deviceId, events]) => events?.map(event => ({ ...event, deviceId })) ?? []);

  const targetDescription = selectedDeviceIds.size > 0
      ? `(${selectedDeviceIds.size} selected)`
      : devices.length > 0 ? "(All devices)" : "";

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-6">
        <div className="shadow-lg rounded-lg bg-white dark:bg-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Devices</h2>
          </div>
          <div className="p-4">
            {isLoading && (
              <div className="flex justify-center items-center p-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading devices...</p>
                </div>
              </div>
            )}
            {error && !isActionLoading && (
              <div className="w-full mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700">
                <p className="text-sm text-red-700 dark:text-red-200"><span className="font-semibold">Error:</span> {error}</p>
              </div>
            )}

            {!isLoading && devices.length === 0 && !error && (
              <p className="text-center text-gray-500">
                No devices found. Check devices.json or server connection.
              </p>
            )}

            {!isLoading && devices.length > 0 && (
              <ul
                aria-label="Select Devices"
                className="border border-gray-300 dark:border-gray-700 rounded-md max-h-96 overflow-y-auto divide-y divide-gray-300 dark:divide-gray-700"
              >
                {devices.map((device) => (
                  <li
                    key={device.id}
                    onClick={() => {
                      const newSelectedDeviceIds = new Set(selectedDeviceIds);
                      if (newSelectedDeviceIds.has(device.id)) {
                        newSelectedDeviceIds.delete(device.id);
                      } else {
                        newSelectedDeviceIds.add(device.id);
                      }
                      setSelectedDeviceIds(newSelectedDeviceIds);
                    }}
                    className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedDeviceIds.has(device.id) ? "bg-blue-100 dark:bg-blue-800 dark:text-blue-100 ring-2 ring-blue-500" : "bg-white dark:bg-gray-800"}`}
                    aria-selected={selectedDeviceIds.has(device.id)}
                    role="option"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={`font-medium ${selectedDeviceIds.has(device.id) ? "text-blue-700 dark:text-blue-100" : "text-gray-900 dark:text-white"}`}>{device.id}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${device.last_status?.power === "ON" ? "bg-green-500 text-white" : "bg-gray-500 text-gray-300"}`}
                      >
                        {device.last_status?.power === "ON" ? "On" : "Off"}
                      </span> 
                      {device.last_status?.power === "ON" && typeof device.last_status?.Dimmer === 'number' && (
                        <span className={`text-xs ml-2 ${selectedDeviceIds.has(device.id) ? "text-blue-600 dark:text-blue-200" : "text-gray-400 dark:text-gray-500"}`}>
                          {device.last_status.Dimmer}%
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="shadow-lg rounded-lg bg-white dark:bg-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Active Events ({aggregatedEvents.length})</h2>
              <span className="ml-2 text-xs text-gray-500">(Live Query)</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                aria-label="Refresh Events"
                onClick={(e) => { e.stopPropagation(); handleFetchEvents(); }}
                disabled={isLoadingEvents}
              >
                {isLoadingEvents ? (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>}
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-700 text-red-600 dark:text-red-400 disabled:opacity-50"
                aria-label="Clear All Events (Selected/All)"
                onClick={(e) => { e.stopPropagation(); handleClearAllAnimations(); }}
                disabled={isActionLoading}
                title={`Clear all events on ${selectedDeviceIds.size > 0 ? 'selected' : 'all'} devices`}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zm2-8h6v8H5v-8zm5-6H6L5 2h8l-1 2z" /></svg>
              </button>
            </div>
          </div>
          <div className="p-0">
            <div className="border-t border-gray-200 dark:border-gray-700">
              <h3>
                <button
                  type="button"
                  className="flex items-center justify-between w-full p-4 font-medium text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75"
                  onClick={() => {
                    const newAccordionState = !isEventsAccordionOpen;
                    setIsEventsAccordionOpen(newAccordionState);
                    if (newAccordionState) {
                  handleFetchEvents();
              }
                  }}
                  aria-expanded={isEventsAccordionOpen}
                  aria-controls="active-events-content"
                >
                  <span>View/Hide Event List</span>
                  {isEventsAccordionOpen ? 
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6l-6 6z" /></svg>
                    : <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6l-6-6z" /></svg>}
                </button>
              </h3>
              {isEventsAccordionOpen && (
                <div id="active-events-content" className="p-0">
                  {isLoadingEvents && (
                    <div className="flex justify-center items-center p-4">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading events...</p>
                      </div>
                    </div>
                  )}
                {!isLoadingEvents && aggregatedEvents.length === 0 && (
                  <p className="text-sm text-gray-500 p-4 text-center">No active repeating events found.</p>
                )}
                {!isLoadingEvents && aggregatedEvents.length > 0 && (
                  <ul className="space-y-2 p-2 max-h-60 overflow-y-auto">
                    {aggregatedEvents.map((event) => (
                      <li key={`${event.deviceId}-${event.id}`}
                            className="flex items-center justify-between p-2 bg-gray-700 dark:bg-gray-800 rounded text-sm text-white dark:text-gray-200"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">Dev: {event.deviceId} (ID: {event.id})</span>
                            <span className="text-gray-300 dark:text-gray-400 text-xs">Int: {event.interval?.toFixed(3)}s Rep: {event.repeats} Cmd: {event.command}</span>
                        </div>
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-red-500 dark:hover:bg-red-700 text-white dark:text-red-300 disabled:opacity-50"
                          aria-label="Cancel Event"
                          onClick={() => handleCancelAnimation(event.deviceId, event.id)}
                            disabled={isActionLoading}
                        >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 3v1H4V2h5V1h6v1h5v2h-1v15c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V4H4V2h5V1h6M7 4v15h10V4H7m2 2h2v11H9V6m4 0h2v11h-2V6z" /></svg>
                          </button>
                      </li>
                    ))}
                  </ul>
                )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="md:col-span-2 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="shadow-lg rounded-lg bg-white dark:bg-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Power {targetDescription}
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={turnOn}
                  disabled={isActionLoading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Turn On
                </button>
                <button
                  type="button"
                  onClick={turnOff}
                  disabled={isActionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Turn Off
                </button>
              </div>
        {isActionLoading && (
                <div className="flex justify-center items-center pt-2">
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="ml-2 text-sm text-gray-600 dark:text-gray-400">Processing...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shadow-lg rounded-lg bg-white dark:bg-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Color {targetDescription}
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-full h-10 p-1 border-gray-300 dark:border-gray-600 rounded-md cursor-pointer bg-white dark:bg-gray-700"
                aria-label="Select color"
              />
              <button
                type="button"
                onClick={setColor}
                disabled={isActionLoading}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Set Color
              </button>
            </div>
          </div>
        </div>
        <div className="shadow-lg rounded-lg bg-white dark:bg-gray-800">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-4 px-4" aria-label="Tabs">
              {controlTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveControlTab(tab.key)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm 
                    ${activeControlTab === tab.key
                      ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'}
                  `}
                  aria-current={activeControlTab === tab.key ? 'page' : undefined}
                >
                  {tab.title}
                </button>
              ))}
            </nav>
                  </div>

          <div>
            {activeControlTab === 'brightness_temp' && (
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="brightness-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Brightness {targetDescription}: {brightnessLevel}%
                    </label>
                    <input
                      type="range"
                      id="brightness-slider"
                      aria-label="Brightness"
                      min={0}
                      max={100}
                      step={1}
                      value={brightnessLevel}
                      onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1 accent-blue-600 dark:accent-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="temperature-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Temperature {targetDescription}: {selectedTemperature}K
                    </label>
                    <input
                      type="range"
                      id="temperature-slider"
                      aria-label="Temperature"
                      min={1000}
                      max={10000}
                      step={100}
                      value={selectedTemperature}
                      onChange={(e) => handleTemperatureChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1 accent-blue-600 dark:accent-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
            {activeControlTab === 'animations' && (
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="animation-color-picker" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Target Color for Fade:
                    </label>
                    <input
                      type="color"
                      id="animation-color-picker"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full h-10 p-1 border-gray-300 dark:border-gray-600 rounded-md mt-1 cursor-pointer bg-white dark:bg-gray-700"
                      aria-label="Select target color for animation"
                    />
                  </div>
                  <div>
                    <label htmlFor="animation-duration-slider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Animation Duration {targetDescription}: {animationDuration}s
                    </label>
                    <input
                      type="range"
                      id="animation-duration-slider"
                      aria-label="Animation Duration"
                      min={1}
                      max={60}
                      step={1}
                      value={animationDuration}
                      onChange={(e) => handleAnimationDurationChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1 accent-purple-600 dark:accent-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleStartColorFade}
                    disabled={isActionLoading}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Color Fade
                  </button>
                </div>
            </div>
            )}
            {activeControlTab === 'scripts' && (
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="script-file-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Upload .bat script:
                    </label>
                    <input
                      type="file"
                      id="script-file-input"
                      accept=".bat"
                      onChange={handleFileChange}
                      className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-100 dark:file:bg-blue-700 file:text-blue-700 dark:file:text-blue-100
                                hover:file:bg-blue-200 dark:hover:file:bg-blue-600 cursor-pointer"
                    />
                    {scriptFile && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Selected: {scriptFile.name}</p>}
                  </div>
                  {scriptContent && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Script Preview:</p>
                      <pre className="mt-1 p-2 text-xs bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-md max-h-40 overflow-auto">
                        {scriptContent}
                      </pre>
                    </div>
                    )}
                  <button
                    type="button"
                    onClick={handleUploadScript}
                    disabled={isUploadingScript || !scriptFile || selectedDeviceIds.size === 0}
                    className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingScript ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                    ) : "Upload to Selected Devices"}
                  </button>
                </div>
            </div>
            )}
            {activeControlTab === 'raw_command' && (
              <div className="p-4">
                <div className="space-y-3">
                  <label htmlFor="rawCommandInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Raw Command</label>
                  <textarea
                    id="rawCommandInput"
                    placeholder="Enter raw command (e.g., Dimmer 100)"
                      value={rawCommand}
                      onChange={(e) => setRawCommand(e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  <button
                    type="button"
                      onClick={handleSendRawCommand}
                    disabled={isActionLoading || rawCommand.trim() === ""}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send Command
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}