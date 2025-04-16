/**
 * Converts a hex color string to an RGB object.
 * @param hex - The hex color string (e.g., "#FF00AA", "ff00aa").
 * @returns An object with r, g, b properties (0-255), or null if invalid hex.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Add check for non-string input
  if (typeof hex !== 'string') {
    return null;
  }

  // Remove leading # if present
  const sanitizedHex = hex.startsWith("#") ? hex.slice(1) : hex;

  // Check for valid length (3 or 6 chars)
  if (!/^[a-f\d]{3}$|^[a-f\d]{6}$/i.test(sanitizedHex)) {
    return null;
  }

  // Expand 3-digit hex to 6-digit
  let fullHex = sanitizedHex;

  if (sanitizedHex.length === 3) {
    fullHex = sanitizedHex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);

  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null; // Should not happen with the regex check, but keeps TS happy
}

/**
 * Converts color temperature in Kelvin to Mireds.
 * Mired = 1,000,000 / Kelvin
 * Tasmota devices often use Mireds (range typically 153-500).
 * @param kelvin - Color temperature in Kelvin.
 * @returns Color temperature in Mireds, rounded to the nearest integer.
 */
export function kelvinToMired(kelvin: number): number {
  if (kelvin <= 0) {
    // Return a default or clamp to a reasonable minimum Mired value if Kelvin is invalid
    // 500 Mired corresponds to 2000K, a common lower bound
    return 500;
  }

  return Math.round(1000000 / kelvin);
}

/**
 * Converts color temperature in Mireds to Kelvin.
 * Kelvin = 1,000,000 / Mired
 * @param mired - Color temperature in Mireds.
 * @returns Color temperature in Kelvin, rounded to the nearest integer.
 */
export function miredToKelvin(mired: number): number {
  if (mired <= 0) {
    // Return a default or clamp to a reasonable maximum Kelvin value if Mired is invalid
    // Return 6500K as a default guess if mired is invalid
    return 6500;
  }

  return Math.round(1000000 / mired);
}
