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

import { LiveColorPicker } from "@/components/LiveColorPicker"; // Import the new component
import { BulbDeviceData } from "@/lib/lights"; // Adjust path if needed
// import LightVisualization from '@/components/LightVisualization'; // Keep commented if not used

export default function Home() {
  const [devices, setDevices] = useState<BulbDeviceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false); // Separate loading for actions
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff"); // Default color white
  const [selectedTemperature, setSelectedTemperature] = useState<number>(4000); // Default 4000K
  const tempThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const TEMP_THROTTLE_DELAY = 150; // ms delay for temperature slider updates

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

  // --- Control Functions ---
  // Handler specifically for the live color picker (no global loading state)
  const handleLiveColorChange = async (
    hexColor: string,
    deviceIds?: string[],
  ) => {
    // Note: No setIsLoading(true) or setError(null) here for smoother dragging
    try {
      const response = await fetch("/api/lights/color", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hexColor, deviceIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Log error but don't set global error state to avoid interrupting drag
        console.error(
          `Live color change failed: ${response.statusText} ${errorData.error ? `- ${errorData.error}` : ""}`,
        );
        // Optional: Throw if you want the promise to reject for the component's catch block
        // throw new Error(`Failed to set live color: ${response.statusText}`);
      } else {
        // console.log(`Live color change to ${hexColor} successful`);
        // No need to refetch status here, MQTT should update it
      }
    } catch (err: any) {
      console.error("Error during live color change:", err);
      // Optional: Throw if needed
    }
    // Note: No setIsLoading(false) here
  };

  const turnAllOn = () => handleApiAction("/api/lights/on", {}, "turn all on");
  const turnAllOff = () =>
    handleApiAction("/api/lights/off", {}, "turn all off");

  const turnSelectedOn = () => {
    if (selectedDeviceIds.size === 0) return;
    handleApiAction(
      "/api/lights/on",
      { deviceIds: Array.from(selectedDeviceIds) },
      "turn selected on",
    );
  };

  const turnSelectedOff = () => {
    if (selectedDeviceIds.size === 0) return;
    handleApiAction(
      "/api/lights/off",
      { deviceIds: Array.from(selectedDeviceIds) },
      "turn selected off",
    );
  };

  const setSelectedColorFunc = () => {
    if (selectedDeviceIds.size === 0) return;
    handleApiAction(
      "/api/lights/color",
      { hexColor: selectedColor, deviceIds: Array.from(selectedDeviceIds) },
      "set selected color",
    );
  };

  const setAllColorFunc = () => {
    handleApiAction(
      "/api/lights/color",
      { hexColor: selectedColor },
      "set all color",
    );
  };

  // Handler for temperature slider changes (throttled)
  const handleTemperatureChange = (value: number | number[]) => {
    const tempValue = Array.isArray(value) ? value[0] : value; // Slider might return array

    if (typeof tempValue !== "number") return;

    setSelectedTemperature(tempValue); // Update UI immediately

    // Clear existing timeout
    if (tempThrottleTimeoutRef.current) {
      clearTimeout(tempThrottleTimeoutRef.current);
    }

    // Set new timeout to send API request
    tempThrottleTimeoutRef.current = setTimeout(async () => {
      const targetDeviceIds =
        selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : undefined;

      console.log(`Throttled Temp Change: Sending ${tempValue}K`);
      try {
        const response = await fetch("/api/lights/temperature", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kelvin: tempValue,
            deviceIds: targetDeviceIds,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          console.error(
            `Temperature change failed: ${response.statusText} ${errorData.error ? `- ${errorData.error}` : ""}`,
          );
        }
      } catch (err: any) {
        console.error("Error during temperature change:", err);
      }
      tempThrottleTimeoutRef.current = null; // Clear ref after execution
    }, TEMP_THROTTLE_DELAY);
  };

  // Fetch initial status on component mount
  useEffect(() => {
    fetchDeviceStatus();
    // Optional polling can be added back here if needed
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

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left Column: Device List & Status */}
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
                    </div>
                  </ListboxItem>
                ))}
              </Listbox>
            )}
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
          <Tab key="color" title="Color">
            <div className="space-y-6 py-4">
              {/* Global Controls */}
              <Card className="shadow-lg">
                <CardHeader>
                  <h2 className="text-xl font-semibold">
                    Global Controls (All Devices)
                  </h2>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex gap-4 justify-center">
                    <Button
                      color="primary"
                      isDisabled={isActionLoading || devices.length === 0}
                      isLoading={isActionLoading}
                      onClick={turnAllOn}
                    >
                      Turn All On
                    </Button>
                    <Button
                      color="secondary"
                      isDisabled={isActionLoading || devices.length === 0}
                      isLoading={isActionLoading}
                      onClick={turnAllOff}
                    >
                      Turn All Off
                    </Button>
                  </div>
                  <div className="flex gap-4 items-center justify-center">
                    <label className="font-medium" htmlFor="globalColorPicker">
                      Set All Color:
                    </label>
                    <input
                      className="h-10 w-16 border border-gray-600 rounded cursor-pointer bg-gray-700 p-1"
                      disabled={isActionLoading || devices.length === 0}
                      id="globalColorPicker"
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                    />
                    <Button
                      color="warning"
                      isDisabled={isActionLoading || devices.length === 0}
                      isLoading={isActionLoading}
                      onClick={setAllColorFunc}
                    >
                      Set All
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {/* Selected Device Controls */}
              <Card className="shadow-lg">
                <CardHeader>
                  <h2 className="text-xl font-semibold">
                    Selected Device Controls ({selectedDeviceIds.size} selected)
                  </h2>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex gap-4 justify-center">
                    <Button
                      color="primary"
                      isDisabled={
                        isActionLoading || selectedDeviceIds.size === 0
                      }
                      isLoading={isActionLoading}
                      onClick={turnSelectedOn}
                    >
                      Turn Selected On
                    </Button>
                    <Button
                      color="secondary"
                      isDisabled={
                        isActionLoading || selectedDeviceIds.size === 0
                      }
                      isLoading={isActionLoading}
                      onClick={turnSelectedOff}
                    >
                      Turn Selected Off
                    </Button>
                  </div>
                  <div className="flex gap-4 items-center justify-center">
                    <label
                      className="font-medium"
                      htmlFor="selectedColorPicker"
                    >
                      Set Selected Color:
                    </label>
                    <input
                      className="h-10 w-16 border border-gray-600 rounded cursor-pointer bg-gray-700 p-1"
                      disabled={isActionLoading || selectedDeviceIds.size === 0}
                      id="selectedColorPicker"
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                    />
                    <Button
                      color="warning"
                      isDisabled={
                        isActionLoading || selectedDeviceIds.size === 0
                      }
                      isLoading={isActionLoading}
                      onClick={setSelectedColorFunc}
                    >
                      Set Selected
                    </Button>
                  </div>
                  {selectedDeviceIds.size === 0 && (
                    <p className="text-center text-sm text-gray-400">
                      Select devices from the list to enable these controls.
                    </p>
                  )}
                </CardBody>
              </Card>

              {/* Live Color Picker */}
              <Card className="shadow-lg">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Live Color Picker</h2>
                </CardHeader>
                <CardBody>
                  <LiveColorPicker
                    isDisabled={isActionLoading} // Disable if another action is in progress
                    selectedDeviceIds={selectedDeviceIds}
                    onColorChange={handleLiveColorChange} // Use the new handler
                  />
                </CardBody>
              </Card>
            </div>
          </Tab>
          <Tab key="temperature" title="Temperature">
            <div className="space-y-6 py-4">
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">
                    Set Temperature (
                    {selectedDeviceIds.size > 0
                      ? `${selectedDeviceIds.size} selected`
                      : "all devices"}
                    )
                  </h2>
                </CardHeader>
                <CardBody>
                  <Slider
                    defaultValue={selectedTemperature}
                    label="Temperature (Kelvin)"
                    maxValue={6500}
                    minValue={2000}
                    step={50}
                    value={selectedTemperature}
                    className="max-w-md mx-auto"
                    // Show current value
                    renderValue={({ children, ...props }) => (
                      <output {...props}>{`${selectedTemperature} K`}</output>
                    )}
                    onChange={handleTemperatureChange} // Update live with throttling
                    // onChangeEnd={handleTemperatureChange} // Or update only on release
                    isDisabled={isActionLoading} // Disable if other actions are running
                  />
                  <p className="text-center text-sm text-gray-400 mt-2">
                    Adjust slider to set light temperature (2000K Warm - 6500K
                    Cool).
                  </p>
                </CardBody>
              </Card>
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
