import { parseTasmotaMessage } from './tasmota';
import { BulbStatus } from './devices';

describe('lib/tasmota', () => {
    describe('parseTasmotaMessage', () => {
        // --- POWER topic tests ---
        it('should parse POWER ON message', () => {
            const topic = 'stat/spot_test/POWER';
            const payload = Buffer.from('ON');
            const expected: Partial<BulbStatus> = { power: 'ON' };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should parse POWER OFF message', () => {
            const topic = 'stat/spot_test/POWER';
            const payload = Buffer.from('OFF');
            const expected: Partial<BulbStatus> = { power: 'OFF', Dimmer: 0, brightness: 0 };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        // --- STATE topic tests ---
        it('should parse basic STATE message (ON, Dimmer)', () => {
            const topic = 'tele/spot_test/STATE';
            const payload = Buffer.from(JSON.stringify({ POWER: 'ON', Dimmer: 50 }));
            const expected: Partial<BulbStatus> = { power: 'ON', Dimmer: 50, brightness: 50 };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should parse STATE message with Color (Hex)', () => {
            const topic = 'tele/spot_test/STATE';
            const payload = Buffer.from(JSON.stringify({ POWER: 'ON', Dimmer: 80, Color: '1A2B3C' }));
            const expected: Partial<BulbStatus> = {
                power: 'ON',
                Dimmer: 80,
                brightness: 80,
                color: '1A2B3C',
                red: 26,
                green: 43,
                blue: 60,
            };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should parse STATE message with Color Temperature (CT)', () => {
            const topic = 'tele/spot_test/STATE';
            const payload = Buffer.from(JSON.stringify({ POWER: 'ON', Dimmer: 100, CT: 370 })); // 2700K
            const expected: Partial<BulbStatus> = {
                power: 'ON',
                Dimmer: 100,
                brightness: 100,
                CT: 370,
            };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should handle STATE message with invalid Color format', () => {
            const topic = 'tele/spot_test/STATE';
            const payload = Buffer.from(JSON.stringify({ POWER: 'ON', Color: 'invalid' }));
            const expected: Partial<BulbStatus> = { power: 'ON' }; // Color is ignored
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should return null for STATE message with invalid JSON', () => {
            const topic = 'tele/spot_test/STATE';
            const payload = Buffer.from('{"POWER:"ON"}'); // Invalid JSON
            expect(parseTasmotaMessage(topic, payload)).toBeNull();
        });

        // --- RESULT topic tests ---
        it('should parse simple RESULT message (e.g., after Power toggle)', () => {
            const topic = 'stat/spot_test/RESULT';
            const payload = Buffer.from(JSON.stringify({ POWER: 'ON' }));
            const expected: Partial<BulbStatus> = { power: 'ON' };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should parse RESULT message with nested Status object', () => {
            const topic = 'stat/spot_test/RESULT';
            const payload = Buffer.from(JSON.stringify({ Status: { POWER: 'OFF', Dimmer: 0 } }));
            const expected: Partial<BulbStatus> = { power: 'OFF', Dimmer: 0, brightness: 0 };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should parse RESULT message with StatusSTS object', () => {
            const topic = 'stat/spot_test/RESULT';
            // Example from Tasmota docs (Status 10)
            const payload = Buffer.from(JSON.stringify({
                StatusSTS: {
                    POWER: 'ON',
                    Dimmer: 75,
                    Color: 'BEBF350000', // RRGGBBWWCC
                    CT: 250, // 4000K
                }
            }));
            const expected: Partial<BulbStatus> = {
                power: 'ON',
                Dimmer: 75,
                brightness: 75,
                color: 'BEBF35',
                red: 190,
                green: 191,
                blue: 53,
                CT: 250,
            };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

        it('should parse RESULT message with Color as comma-separated string', () => {
            const topic = 'stat/spot_test/RESULT';
            const payload = Buffer.from(JSON.stringify({ Color: '255,0,0' }));
            const expected: Partial<BulbStatus> = {
                color: 'ff0000',
                red: 255,
                green: 0,
                blue: 0,
            };
            expect(parseTasmotaMessage(topic, payload)).toEqual(expected);
        });

         it('should handle RESULT message with invalid Color format (comma)', () => {
            const topic = 'stat/spot_test/RESULT';
            const payload = Buffer.from(JSON.stringify({ Color: '255,0,invalid' }));
            // Should return null because no valid fields were found
            expect(parseTasmotaMessage(topic, payload)).toBeNull();
        });

         it('should handle RESULT message with unhandled Color format', () => {
            const topic = 'stat/spot_test/RESULT';
            const payload = Buffer.from(JSON.stringify({ Color: 12345 })); // Number color?
            expect(parseTasmotaMessage(topic, payload)).toBeNull();
        });

        it('should return null for RESULT message with invalid JSON', () => {
            const topic = 'stat/spot_test/RESULT';
            const payload = Buffer.from('{"Status: {"POWER": "ON"}}'); // Invalid JSON
            expect(parseTasmotaMessage(topic, payload)).toBeNull();
        });

         it('should return null for RESULT message with no relevant fields', () => {
            const topic = 'stat/spot_test/RESULT';
            const payload = Buffer.from(JSON.stringify({ Command: 'Unknown' }));
            expect(parseTasmotaMessage(topic, payload)).toBeNull();
        });

        // --- Other/Invalid topic tests ---
        it('should return null for irrelevant topics', () => {
            const topic = 'cmnd/spot_test/Color';
            const payload = Buffer.from('FF0000');
            expect(parseTasmotaMessage(topic, payload)).toBeNull();
        });

        it('should return null for topic with incorrect prefix', () => {
            const topic = 'info/spot_test/STATE';
            const payload = Buffer.from(JSON.stringify({ POWER: 'ON' }));
            expect(parseTasmotaMessage(topic, payload)).toBeNull();
        });
    });
}); 