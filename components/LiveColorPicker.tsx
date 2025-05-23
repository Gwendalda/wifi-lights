/**
 * LiveColorPicker component that provides a color picker interface for controlling light devices.
 * Supports live color updates with throttling and device selection.
 */
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

interface LiveColorPickerProps {
  selectedDeviceIds: Set<string>;
  // Pass the function that handles API calls from the main page
  onColorChange: (hexColor: string, deviceIds?: string[]) => Promise<void>;
  isDisabled?: boolean;
}

/**
 * Converts HSL color values to hexadecimal color code.
 * @param {number} h - Hue value (0-360)
 * @param {number} s - Saturation value (0-100)
 * @param {number} l - Lightness value (0-100)
 * @returns {string} Hexadecimal color code
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Renders a color picker interface for controlling light devices.
 * @param {LiveColorPickerProps} props - Component props
 * @returns {JSX.Element} Color picker interface
 */
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

  /**
   * Sends color update to selected devices with throttling.
   * @param {string} hexColor - Color to send
   */
  const sendColorUpdate = useCallback(
    (hexColor: string) => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }

      throttleTimeoutRef.current = setTimeout(() => {
        const targetDeviceIds = selectedDeviceIds.size > 0
          ? Array.from(selectedDeviceIds)
          : undefined;

        onColorChange(hexColor, targetDeviceIds)
          .then(() => {
            lastSentColorRef.current = hexColor;
          })
          .catch((err) => {
            console.error("Failed to send color update:", err);
          });
        throttleTimeoutRef.current = null;
      }, THROTTLE_DELAY);
    },
    [onColorChange, selectedDeviceIds]
  );

  /**
   * Handles color selection based on mouse position.
   * @param {React.MouseEvent<HTMLDivElement>} event - Mouse event
   */
  const handleColorPick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!pickerRef.current) return;

      const rect = pickerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const hue = Math.round(x * 360);
      const hexColor = hslToHex(hue, 100, 50);

      if (hexColor !== lastSentColorRef.current) {
        sendColorUpdate(hexColor);
      }
    },
    [sendColorUpdate]
  );

  /**
   * Handles mouse down event on the color picker.
   * @param {React.MouseEvent<HTMLDivElement>} event - Mouse event
   */
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    setIsDragging(true);
    lastSentColorRef.current = null;
    handleColorPick(event);
    event.preventDefault();
  };

  /**
   * Handles mouse move event on the color picker.
   * @param {React.MouseEvent<HTMLDivElement>} event - Mouse event
   */
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || isDisabled) return;
    handleColorPick(event);
    event.preventDefault();
  };

  /**
   * Handles mouse up or leave events on the color picker.
   */
  const handleMouseUpOrLeave = () => {
    if (isDragging) {
      setIsDragging(false);
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
        className={`relative w-full h-16 rounded-md cursor-pointer border ${
          isDisabled 
            ? "opacity-50 cursor-not-allowed border-gray-700" 
            : "border-gray-500 hover:border-gray-400"
        }`}
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
