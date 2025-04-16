"use client"; // Required for hooks like useState, useEffect and event handlers

import { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Listbox, ListboxItem } from "@heroui/listbox";
import { Snippet } from "@heroui/snippet";
import { Spinner } from "@heroui/spinner";
import { Selection } from "@react-types/shared"; // Import Selection type if available, or use 'any'
import { Tabs, Tab } from "@heroui/tabs"; // Import Tabs component
import { Slider } from "@heroui/slider"; // Import Slider component
import { Switch } from "@heroui/switch"; // Correct import for Switch component
import { Accordion, AccordionItem } from "@heroui/accordion"; // Correct import path
import { Icon } from "@iconify/react"; // Correct import path
import { Input } from "@heroui/input"; // Import Input for file name display

// Use the renamed type exported from lib/lights
import type { LightDeviceData as BulbDeviceData } from "@/lib/lights";
// import LightVisualization from '@/components/LightVisualization'; // Keep commented if not used

export default function Home() {
  const [devices, setDevices] = useState<BulbDeviceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false); // Separate loading for actions
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff");
  const [selectedTemperature, setSelectedTemperature] = useState<number>(4000);
  const [brightnessLevel, setBrightnessLevel] = useState<number>(100); // Standard brightness
  const [activeDeviceEvents, setActiveDeviceEvents] = useState<Record<string, any[] | null>>({});
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const tempThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const brightnessThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Throttle for brightness
  const TEMP_THROTTLE_DELAY = 150;
  const BRIGHTNESS_THROTTLE_DELAY = 150; // Throttle delay for brightness
  const [rawCommand, setRawCommand] = useState<string>(""); // State for raw command input
  const [animationDuration, setAnimationDuration] = useState<number>(10); // Added for animation duration
  const [scriptFile, setScriptFile] = useState<File | null>(null); // State for the script file
  const [scriptContent, setScriptContent] = useState<string | null>(null); // State for the script content
  const [isUploadingScript, setIsUploadingScript] = useState<boolean>(false); // Loading state for script upload

  const fetchDeviceStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Assuming /api/lights/status fetches the devices.json content
      // We might need a dedicated endpoint or fetch devices.json directly if static
      // For now, let's assume it exists and returns { devices: BulbDeviceData[] }
      const response = await fetch("/api/lights/status"); // Placeholder: Adjust if status endpoint differs

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }
      const data = await response.json();

      setDevices(data.devices || []); // Ensure devices is always an array
    } catch (err: any) {
      console.error("Error fetching device status:", err);
      setError(err.message || "Could not load device status.");
      setDevices([]); // Clear devices on error
    } finally {
      setIsLoading(false);
    }
  };

  // Generic function to handle API calls for actions
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
        const errorData = await response.json().catch(() => ({})); // Try parsing error response

        throw new Error(
          `Failed to ${actionName}: ${response.statusText} ${errorData.error ? `- ${errorData.error}` : ""}`,
        );
      }
      console.log(`${actionName} successful`);
      // Refetch status after a short delay to allow devices to update
      setTimeout(fetchDeviceStatus, 1000);
    } catch (err: any) {
      console.error(`Error during ${actionName}:`, err);
      setError(err.message || `Could not perform action: ${actionName}.`);
    } finally {
      // Let the refetch handle the final loading state change
      setIsActionLoading(false); // Ensure action loading state is always reset
    }
  };

  // --- Control Functions (Simplified Target Logic) ---
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
    setBrightnessLevel(brightnessValue); // Update UI immediately

    // Clear existing timeout
    if (brightnessThrottleTimeoutRef.current) {
      clearTimeout(brightnessThrottleTimeoutRef.current);
    }

    // Set new timeout to send API request
    brightnessThrottleTimeoutRef.current = setTimeout(async () => {
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      const target = targetDeviceIds ? `${targetDeviceIds.length} selected devices` : 'all devices';
      console.log(`Throttled Brightness Change: Sending ${brightnessValue}% to ${target}`);
      try {
        const response = await fetch("/api/lights/brightness", { // New API route
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brightness: brightnessValue, ...(targetDeviceIds && { deviceIds: targetDeviceIds }) }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            `Brightness change failed: ${response.statusText} ${errorData.error ? `- ${errorData.error}` : ""}`,
          );
        }
      } catch (err: any) {
        console.error("Error during brightness change:", err);
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
              // Send selected IDs if any, otherwise backend fetches all
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
              setActiveDeviceEvents({}); // Clear on invalid data
          }
      } catch (error) {
          console.error("UI: Error fetching active events:", error);
          setError(`Failed to load active events. ${error instanceof Error ? error.message : ''}`);
          setActiveDeviceEvents({}); // Clear on error
      } finally {
          setIsLoadingEvents(false);
      }
  };

  // --- Handler for Cancelling an Animation ---
  const handleCancelAnimation = async (deviceId: string, eventId: number) => {
    console.log(`UI: Requesting cancellation for event ${eventId} on ${deviceId}`);
    // Use handleApiAction for consistency with loading/error display
    await handleApiAction(
        '/api/lights/cancel-animation',
        { deviceId, eventId },
        `cancel animation ${eventId} on ${deviceId}`
    );
    // Optionally, refetch events after cancellation attempt
    setTimeout(handleFetchEvents, 1000); // Refetch after 1s delay
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
      // Optionally, refetch events after clear attempt
      setTimeout(handleFetchEvents, 1000); // Refetch after 1s delay
  };

  // --- Handler for Sending Raw Command ---
  const handleSendRawCommand = () => {
      if (rawCommand.trim() === "") {
          setError("Command cannot be empty."); // Use main error state for simplicity
          return;
      }
      const targetDeviceIds = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;
      console.log(`UI: Sending raw command "${rawCommand}" to ${targetDeviceIds ? 'selected' : 'all'} devices.`);
      // Use handleApiAction for loading/error handling
      handleApiAction(
          '/api/lights/raw-command',
          { command: rawCommand, ...(targetDeviceIds && { deviceIds: targetDeviceIds }) },
          `send raw command`
      );
      // Optionally clear textarea after sending
      // setRawCommand("");
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
                    setError(null); // Clear previous errors
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
            event.target.value = ''; // Reset file input
        }
    } else {
        setScriptFile(null);
        setScriptContent(null);
    }
  };

  // --- Handler for Uploading Script ---
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
      // Provide feedback based on the result object (successfulUploads, failedUploads etc.)
      // For simplicity, just show a success message or the main error
      setError(null); // Clear previous errors on success
      alert(`Script upload process finished. Success: ${result.successfulUploads?.length || 0}, Failed: ${result.failedUploads?.length || 0}, Skipped: ${result.skippedUploads?.length || 0}. Check console for details.`); // Simple feedback
      // Optionally clear file input after successful upload
      // setScriptFile(null);
      // setScriptContent(null);
      // if (fileInputRef.current) fileInputRef.current.value = ''; // Requires creating a ref

    } catch (err: any) {
      console.error("Error uploading script:", err);
      setError(err.message || "Could not upload script.");
    } finally {
      setIsUploadingScript(false);
    }
  };

  // Fetch initial status on component mount
  useEffect(() => {
    fetchDeviceStatus();
    const intervalId = setInterval(() => {
        // Force a re-render by updating a dummy state or re-fetching
        // This is crude; a more sophisticated state management might be better
        setDevices(currentDevices => [...currentDevices]); // Trigger re-render
    }, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  // Handler for selection change in Listbox
  // Adjust the type 'Selection' based on @heroui/listbox actual implementation
  const handleSelectionChange = (keys: Selection | "all") => {
    if (keys === "all") {
      // Assuming 'all' might be a value from the component
      setSelectedDeviceIds(new Set(devices.map((d) => d.id)));
    } else if (keys instanceof Set) {
      // Assuming keys is Set<string> or similar
      setSelectedDeviceIds(new Set(keys as Set<string>));
    } else {
      setSelectedDeviceIds(new Set()); // Fallback for unknown type
    }
  };

  // Aggregate events from state for UI display
  const aggregatedEvents = Object.entries(activeDeviceEvents)
      .filter(([, events]) => events !== null && events.length > 0)
      .flatMap(([deviceId, events]) => events?.map(event => ({ ...event, deviceId })) ?? []);

  // Determine target description for titles
  const targetDescription = selectedDeviceIds.size > 0
      ? `(${selectedDeviceIds.size} selected)`
      : devices.length > 0 ? "(All devices)" : "";

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left Column: Device List & Status + Active Animations */}
      <div className="md:col-span-1 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <h2 className="text-xl font-semibold">Devices</h2>
          </CardHeader>
          <CardBody>
            {isLoading && (
              <div className="flex justify-center items-center p-4">
                <Spinner label="Loading devices..." />
              </div>
            )}
            {/* Show general error here */}
            {error && !isActionLoading && (
              <Snippet className="w-full mb-4" color="danger">
                Error: {error}
              </Snippet>
            )}

            {!isLoading && devices.length === 0 && !error && (
              <p className="text-center text-gray-500">
                No devices found. Check devices.json or server connection.
              </p>
            )}

            {!isLoading && devices.length > 0 && (
              <Listbox
                aria-label="Select Devices"
                className="border border-gray-700 rounded-md max-h-96 overflow-y-auto" // Add styling
                disallowEmptySelection={false}
                selectionMode="multiple"
                variant="flat"
                selectedKeys={selectedDeviceIds}
                // @ts-ignore // Use ts-ignore if type 'Selection' causes issues, adjust based on library
                onSelectionChange={handleSelectionChange}
              >
                {devices.map((device) => (
                  <ListboxItem key={device.id} textValue={`${device.id}`}>
                    <div className="flex justify-between items-center w-full">
                      <span className="font-medium">{device.id}</span>
                      {/* Status indicator based on MQTT power state */}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${device.last_status?.power === "ON" ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"}`}
                      >
                        {device.last_status?.power === "ON" ? "On" : "Off"}
                      </span>
                      {/* Show Dimmer % if available */}
                      {device.last_status?.power === "ON" && typeof device.last_status?.Dimmer === 'number' && (
                        <span className="text-xs text-gray-400 ml-2">
                          {device.last_status.Dimmer}%
                        </span>
                      )}
                    </div>
                  </ListboxItem>
                ))}
              </Listbox>
            )}
          </CardBody>
        </Card>

        {/* --- Active Events Card (Restructured) --- */}
        <Card className="shadow-lg">
          <CardHeader className="flex justify-between items-center">
            {/* Title on the left */}
            <div className="flex items-center">
              <h2 className="text-xl font-semibold">Active Events ({aggregatedEvents.length})</h2>
              <span className="ml-2 text-xs text-gray-500">(Live Query)</span>
            </div>
            {/* Buttons on the right */}
            <div className="flex items-center gap-1">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Refresh Events"
                onClick={(e) => { e.stopPropagation(); handleFetchEvents(); }}
                isDisabled={isLoadingEvents}
                isLoading={isLoadingEvents}
              >
                <Icon icon="mdi:refresh" width="16" />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                aria-label="Clear All Events (Selected/All)"
                onClick={(e) => { e.stopPropagation(); handleClearAllAnimations(); }}
                isDisabled={isActionLoading}
                title={`Clear all events on ${selectedDeviceIds.size > 0 ? 'selected' : 'all'} devices`}
              >
                <Icon icon="mdi:delete-sweep-outline" width="16" />
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0"> {/* Remove padding from CardBody */}
            <Accordion variant="bordered" onSelectionChange={(keys) => {
              // Fetch events when accordion opens (assuming single item)
              if (keys instanceof Set && keys.has('active-events-list')) {
                  handleFetchEvents();
              }
            }}>
              <AccordionItem
                key="active-events-list" // Unique key for the list item
                aria-label="Events List" // More appropriate label
                title="View/Hide Event List" // Simple title for the trigger
                // REMOVED: Buttons from title prop
              >
                {/* Content remains the same: spinner, empty message, or list */}
                {isLoadingEvents && <Spinner size="sm" label="Loading events..." />}
                {!isLoadingEvents && aggregatedEvents.length === 0 && (
                  <p className="text-sm text-gray-500 p-4 text-center">No active repeating events found.</p>
                )}
                {!isLoadingEvents && aggregatedEvents.length > 0 && (
                  <ul className="space-y-2 p-2 max-h-60 overflow-y-auto">
                    {aggregatedEvents.map((event) => (
                      <li key={`${event.deviceId}-${event.id}`}
                          className="flex items-center justify-between p-2 bg-gray-800 rounded text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">Dev: {event.deviceId} (ID: {event.id})</span>
                          <span className="text-gray-400 text-xs">Int: {event.interval?.toFixed(3)}s Rep: {event.repeats} Cmd: {event.command}</span>
                        </div>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          aria-label="Cancel Event"
                          onClick={() => handleCancelAnimation(event.deviceId, event.id)}
                          isDisabled={isActionLoading}
                        >
                            <Icon icon="mdi:trash-can-outline" width="16" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionItem>
            </Accordion>
          </CardBody>
        </Card>
      </div>

      {/* Center Column: Controls */}
      <div className="md:col-span-2">
        {/* Show action-specific error/loading here */}
        {isActionLoading && (
          <div className="flex justify-center items-center p-4">
            <Spinner label="Performing action..." />
          </div>
        )}
        {/* Show only the action error when isActionLoading is true */}
        {error && isActionLoading && (
          <Snippet className="w-full mb-4" color="danger">
            Error: {error}
          </Snippet>
        )}

        <Tabs fullWidth aria-label="Control Modes">
          <Tab key="color" title="Color & Brightness">
            <div className="space-y-6 py-4">
              {/* Unified Device Controls Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Device Controls {targetDescription}</h2>
                </CardHeader>
                <CardBody className="space-y-4">
                  {/* On/Off Buttons */}
                  <div className="flex gap-4 justify-center">
                    <Button color="primary" isDisabled={isActionLoading || devices.length === 0} isLoading={isActionLoading} onClick={turnOn}>Turn On</Button>
                    <Button color="secondary" isDisabled={isActionLoading || devices.length === 0} isLoading={isActionLoading} onClick={turnOff}>Turn Off</Button>
                  </div>
                  {/* Set Color */}
                  <div className="flex gap-4 items-center justify-center">
                    <label className="font-medium" htmlFor="controlColorPicker">Color:</label>
                    <input className="h-10 w-16 border border-gray-600 rounded cursor-pointer bg-gray-700 p-1" disabled={isActionLoading || devices.length === 0} id="controlColorPicker" type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} />
                    <Button color="warning" isDisabled={isActionLoading || devices.length === 0} isLoading={isActionLoading} onClick={setColor}>Set Color</Button>
                  </div>
                  {/* Standard Brightness Slider */}
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <Slider
                        label="Brightness"
                        minValue={0}
                        maxValue={100}
                        step={1}
                        value={brightnessLevel}
                        className="max-w-md mx-auto"
                        renderValue={({ children, ...props }) => (
                            <output {...props}>{`${brightnessLevel}%`}</output>
                        )}
                        onChange={handleBrightnessChange} // Trigger on drag
                        isDisabled={isActionLoading || devices.length === 0}
                    />
                  </div>
                  {selectedDeviceIds.size === 0 && devices.length > 0 && (
                     <p className="text-center text-xs text-gray-400 mt-1">
                       (No devices selected, controls affect all devices)
                     </p>
                  )}
                </CardBody>
              </Card>

              {/* --- Color Animation Card --- */}
              <Card className="shadow-lg">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Color Animation {targetDescription}</h2>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex gap-4 items-center justify-center">
                    <label className="font-medium" htmlFor="animationColorPicker">Target Color:</label>
                    <input
                      className="h-10 w-16 border border-gray-600 rounded cursor-pointer bg-gray-700 p-1"
                      disabled={isActionLoading || devices.length === 0}
                      id="animationColorPicker"
                      type="color"
                      value={selectedColor} // Reuse existing color state for now
                      onChange={(e) => setSelectedColor(e.target.value)}
                    />
                  </div>
                  {/* Animation Duration Slider */}
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <Slider
                      label="Animation Duration (seconds)"
                      minValue={1}
                      maxValue={60} // Example max duration
                      step={1}
                      value={animationDuration} // Needs new state variable
                      className="max-w-md mx-auto"
                      renderValue={({ children, ...props }) => (
                        <output {...props}>{`${animationDuration}s`}</output>
                      )}
                      onChange={handleAnimationDurationChange} // Needs new handler
                      isDisabled={isActionLoading || devices.length === 0}
                    />
                  </div>
                  <Button
                    color="success" // Or another appropriate color
                    variant="solid"
                    onClick={handleStartColorFade} // Needs new handler
                    isDisabled={isActionLoading || devices.length === 0}
                    isLoading={isActionLoading}
                    fullWidth
                  >
                    Start Color Fade
                  </Button>
                  <p className="text-center text-xs text-gray-400 mt-1">
                    Smoothly transitions to the target color over the specified duration.
                  </p>
                </CardBody>
              </Card>

              {/* --- Custom Command Card (Debug) --- */}
              <Card className="shadow-lg">
                 <CardHeader>
                    <h2 className="text-xl font-semibold">Custom Command {targetDescription} (Debug)</h2>
                 </CardHeader>
                 <CardBody className="space-y-3">
                     {/* Use standard HTML textarea */}
                     <label htmlFor="rawCommandInput" className="block text-sm font-medium text-gray-300 mb-1">Command String</label>
                     <textarea
                        id="rawCommandInput"
                        placeholder="Enter raw command (e.g., dimmer 50, color ff0000)"
                        value={rawCommand}
                        onChange={(e) => setRawCommand(e.target.value)} // Standard onChange
                        disabled={isActionLoading || devices.length === 0}
                        rows={3} // Use rows attribute
                        className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                     />
                     <Button
                         color="default"
                         variant="ghost"
                         onClick={handleSendRawCommand}
                         isDisabled={isActionLoading || devices.length === 0 || rawCommand.trim() === ""}
                         isLoading={isActionLoading}
                         fullWidth // Make button full width
                     >
                         Send Command
                     </Button>
                     <p className="text-center text-xs text-gray-400 mt-1">
                        Sends command via HTTP POST to /api/cmnd on target devices.
                        No validation performed. Use with caution.
                    </p>
                 </CardBody>
              </Card>

            </div>
          </Tab>
          <Tab key="temperature" title="Temperature">
            <div className="space-y-6 py-4">
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Set Temperature {targetDescription}</h2>
                </CardHeader>
                <CardBody>
                  <Slider
                    label="Temperature (Kelvin)"
                    maxValue={6500}
                    minValue={2000}
                    step={50}
                    value={selectedTemperature}
                    className="max-w-md mx-auto"
                    renderValue={({ children, ...props }) => (
                      <output {...props}>{`${selectedTemperature} K`}</output>
                    )}
                    onChange={handleTemperatureChange}
                    isDisabled={isActionLoading || devices.length === 0}
                  />
                  <p className="text-center text-sm text-gray-400 mt-2">
                    Adjust slider to set light temperature (2000K Warm - 6500K Cool).
                  </p>
                   {selectedDeviceIds.size === 0 && devices.length > 0 && (
                     <p className="text-center text-xs text-gray-400 mt-1">
                       (No devices selected, affects all devices)
                     </p>
                  )}
                </CardBody>
              </Card>
            </div>
          </Tab>
          <Tab key="advanced" title="Advanced">
            {/* Advanced Controls Card */}
            <Card className="mb-4">
              <CardHeader>
                <h4 className="text-lg font-semibold">Advanced Controls</h4>
              </CardHeader>
              <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Raw Command Section */}
                <Card className="col-span-1 md:col-span-2">
                  <CardHeader>Raw Tasmota Command</CardHeader>
                  <CardBody className="flex flex-col gap-2">
                    <Input
                      label="Command"
                      placeholder="e.g., Power Toggle"
                      value={rawCommand}
                      onChange={(e) => setRawCommand(e.target.value)}
                    />
                    <Button
                      color="secondary"
                      onClick={handleSendRawCommand}
                      isLoading={isActionLoading}
                      isDisabled={isActionLoading || rawCommand.trim() === ""}
                    >
                      Send Command to {selectedDeviceIds.size > 0 ? `${selectedDeviceIds.size} Selected` : "All"}
                    </Button>
                  </CardBody>
                </Card>

                {/* Custom Script Upload Section */}
                <Card className="col-span-1 md:col-span-2">
                  <CardHeader>Custom Script Upload (.bat)</CardHeader>
                  <CardBody className="flex flex-col gap-3">
                      <label className="block">
                          <span className="sr-only">Choose script file</span>
                          <input
                              type="file"
                              accept=".bat"
                              onChange={handleFileChange}
                              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                          />
                      </label>
                      {scriptFile && (
                         <Snippet hideSymbol color="default" className="text-sm">{scriptFile.name}</Snippet>
                      )}
                     <Button
                       color="secondary"
                       onClick={handleUploadScript}
                       isLoading={isUploadingScript}
                       isDisabled={isUploadingScript || !scriptFile || selectedDeviceIds.size === 0}
                     >
                       {isUploadingScript ? "Uploading..." : `Upload to ${selectedDeviceIds.size} Selected`}
                     </Button>
                      {isUploadingScript && <Spinner size="sm" />}
                      {/* Display error specific to upload below the button? */}
                  </CardBody>
                </Card>

                {/* Active Events Section */}
                <Card className="col-span-1 md:col-span-2">
                  {/* Existing active events content */}
                </Card>
              </CardBody>
            </Card>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}