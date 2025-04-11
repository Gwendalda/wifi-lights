"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

interface LiveColorPickerProps {
  selectedDeviceIds: Set<string>;
  // Pass the function that handles API calls from the main page
  onColorChange: (hexColor: string, deviceIds?: string[]) => Promise<void>;
  isDisabled?: boolean;
}

// Simple HSL to Hex conversion (consider a library for more robust conversion)
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0"); // convert to Hex and prefix "0" if needed
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

export const LiveColorPicker: React.FC<LiveColorPickerProps> = ({
  selectedDeviceIds,
  onColorChange,
  isDisabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentColorRef = useRef<string | null>(null);

  const THROTTLE_DELAY = 100; // ms - Adjust as needed for responsiveness vs. load

  const handleColorPick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!pickerRef.current) return;

      const rect = pickerRef.current.getBoundingClientRect();
      // Calculate X position relative to the picker element (0 to 1)
      const x = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left) / rect.width),
      );

      // Map X position to Hue (0 to 360)
      const hue = Math.round(x * 360);
      const saturation = 100; // Fixed saturation
      const lightness = 50; // Fixed lightness

      const hexColor = hslToHex(hue, saturation, lightness);

      // Only send if color actually changed and throttling allows
      if (hexColor !== lastSentColorRef.current) {
        // Clear existing timeout if user moves again quickly
        if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current);
        }

        throttleTimeoutRef.current = setTimeout(() => {
          // console.log(`Sending color: ${hexColor}`); // Debug log
          const targetDeviceIds =
            selectedDeviceIds.size > 0
              ? Array.from(selectedDeviceIds)
              : undefined;

          onColorChange(hexColor, targetDeviceIds)
            .then(() => {
              lastSentColorRef.current = hexColor; // Update last sent color on success
            })
            .catch((err) => {
              console.error("Failed to send color update:", err);
              // Optionally show an error state in the picker
            });
          throttleTimeoutRef.current = null; // Clear timeout ref after execution
        }, THROTTLE_DELAY);
      }
    },
    [onColorChange, selectedDeviceIds],
  );

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    setIsDragging(true);
    lastSentColorRef.current = null; // Reset last sent color on new drag
    handleColorPick(event); // Pick color on initial click
    // Prevent text selection during drag
    event.preventDefault();
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || isDisabled) return;
    handleColorPick(event);
    // Prevent text selection during drag
    event.preventDefault();
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      // Clear any pending timeout when dragging stops
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    }
  };

  // Ensure dragging stops if component becomes disabled mid-drag
  useEffect(() => {
    if (isDisabled && isDragging) {
      setIsDragging(false);
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    }
  }, [isDisabled, isDragging]);

  // Generate the CSS gradient background string
  const gradientBackground = `linear-gradient(to right, hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))`;

  return (
    <div className="w-full space-y-2">
      <p className="text-sm text-gray-400 text-center">
        Click and drag to change color live (
        {selectedDeviceIds.size > 0
          ? `${selectedDeviceIds.size} selected`
          : "all devices"}
        )
      </p>
      <div
        ref={pickerRef}
        role="slider"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-label="Live Color Picker"
        tabIndex={isDisabled ? -1 : 0}
        className={`relative w-full h-16 rounded-md cursor-pointer border ${isDisabled ? "opacity-50 cursor-not-allowed border-gray-700" : "border-gray-500 hover:border-gray-400"}`}
        style={{ background: gradientBackground }}
        title={
          isDisabled
            ? "Select devices or wait for current action"
            : "Live color picker"
        }
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseUpOrLeave} // Stop dragging if mouse leaves the area
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
      />
      {/* Optional: Add a swatch to show the currently selected/sent color */}
      {/* <div className="h-4 w-full rounded" style={{ backgroundColor: lastSentColorRef.current || 'transparent' }}></div> */}
    </div>
  );
};
