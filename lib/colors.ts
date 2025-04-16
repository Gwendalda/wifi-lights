export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove leading hash if present
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  // Ensure hex is valid (3 or 6 characters)
  if (!/^[a-f\d]{3}$|^[a-f\d]{6}$/i.test(hex)) {
    return null;
  }

  // Expand shorthand form (e.g., "03F") to full form ("0033FF")
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r, g, b };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0; // Default hue
  let s = 0;
  let l = (max + min) / 2;

  if (max === min) {
    // Achromatic
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  // Convert to degrees and percentage
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100); // Lightness corresponds to OBK 'Dimmer'

  return { h, s, l };
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 360], [0, 100], [0, 100] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   h       The hue
 * @param   s       The saturation
 * @param   l       The lightness
 * @return  {object}           The RGB representation
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
} 