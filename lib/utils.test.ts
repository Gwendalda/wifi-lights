import { hexToRgb, kelvinToMired, miredToKelvin } from './utils';

describe('lib/utils', () => {
    describe('hexToRgb', () => {
        it('should convert valid 6-digit hex colors', () => {
            expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
            expect(hexToRgb('0000FF')).toEqual({ r: 0, g: 0, b: 255 });
            expect(hexToRgb('fFfFfF')).toEqual({ r: 255, g: 255, b: 255 });
            expect(hexToRgb('1a2B3c')).toEqual({ r: 26, g: 43, b: 60 });
        });

        it('should convert valid 3-digit hex colors', () => {
            expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('0f0')).toEqual({ r: 0, g: 255, b: 0 });
            expect(hexToRgb('00F')).toEqual({ r: 0, g: 0, b: 255 });
            expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
        });

        it('should return null for invalid hex strings', () => {
            expect(hexToRgb('')).toBeNull();
            expect(hexToRgb('#')).toBeNull();
            expect(hexToRgb('#12345')).toBeNull();
            expect(hexToRgb('#1234567')).toBeNull();
            expect(hexToRgb('GGHHII')).toBeNull();
            expect(hexToRgb('#ff00gg')).toBeNull();
            expect(hexToRgb('red')).toBeNull();
            expect(hexToRgb(null as any)).toBeNull();
            expect(hexToRgb(undefined as any)).toBeNull();
        });
    });

    describe('kelvinToMired', () => {
        it('should correctly convert Kelvin to Mired', () => {
            expect(kelvinToMired(6500)).toBe(154); // Approx 153.8
            expect(kelvinToMired(2700)).toBe(370); // Approx 370.37
            expect(kelvinToMired(4000)).toBe(250);
            expect(kelvinToMired(2000)).toBe(500);
            expect(kelvinToMired(10000)).toBe(100);
        });

        it('should handle zero or negative Kelvin', () => {
            expect(kelvinToMired(0)).toBe(500); // Default to warmest
            expect(kelvinToMired(-100)).toBe(500);
        });
    });

    describe('miredToKelvin', () => {
        it('should correctly convert Mired to Kelvin', () => {
            expect(miredToKelvin(154)).toBe(6494); // Approx 6493.5
            expect(miredToKelvin(370)).toBe(2703); // Approx 2702.7
            expect(miredToKelvin(250)).toBe(4000);
            expect(miredToKelvin(500)).toBe(2000);
            expect(miredToKelvin(100)).toBe(10000);
        });

        it('should handle zero or negative Mired', () => {
            expect(miredToKelvin(0)).toBe(6500); // Default guess
            expect(miredToKelvin(-100)).toBe(6500);
        });
    });
}); 