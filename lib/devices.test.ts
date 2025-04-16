import fs from 'fs/promises';
// Import types, but not functions initially due to resetModules
import type { BulbDeviceData, BulbStatus } from './devices';

// Mock fs/promises
jest.mock('fs/promises');

// Get a typed reference AFTER mocking. We'll use this to configure mocks INSIDE tests.
const mockedFs = fs as jest.Mocked<typeof fs>;

// --- Test Data ---
const mockDevicesData: BulbDeviceData[] = [
    { id: 'dev1', ip: '10.0.0.21', last_status: { power: 'ON', brightness: 50 } },
    { id: 'dev2', ip: '10.0.0.22', last_status: { power: 'OFF' } },
    { id: 'dev3', ip: '10.0.0.23/invalid', last_status: {} }, // Invalid IP for testing getDeviceMqttId
];
const mockDevicesJson = JSON.stringify(mockDevicesData, null, 2);

// --- Test Suite ---
describe('lib/devices', () => {
    let devicesModule: typeof import('./devices');

    beforeEach(() => {
        jest.resetModules(); // Reset modules to clear internal cache state
        jest.useFakeTimers();

        // Re-require the module AFTER resetting modules
        devicesModule = require('./devices'); 
        
        // Clear mock call history before each test
        mockedFs.readFile.mockClear();
        mockedFs.writeFile.mockClear();
        // We will set mockResolvedValue/mockRejectedValue within each test or describe block as needed.
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('getDevices (loading and caching)', () => {
        it('should read from file on first call', async () => {
            // Configure mock specifically for this test
            mockedFs.readFile.mockResolvedValue(mockDevicesJson);
            
            const devices = await devicesModule.getDevices();

            expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
            expect(mockedFs.readFile).toHaveBeenCalledWith(expect.stringContaining('devices.json'), 'utf-8');
            expect(devices).toHaveLength(mockDevicesData.length);
            expect(devices[0].id).toBe('dev1');
        });

        it('should return cached data on subsequent calls', async () => {
            // Configure mock specifically for this test scenario
            mockedFs.readFile.mockResolvedValue(mockDevicesJson);

            await devicesModule.getDevices(); // First call - populates cache
            mockedFs.readFile.mockClear(); // Clear call count after first call

            const devices = await devicesModule.getDevices(); // Second call - should use cache

            expect(mockedFs.readFile).not.toHaveBeenCalled(); // Should NOT read again
            expect(devices).toHaveLength(mockDevicesData.length);
        });

        it('should handle concurrent calls correctly', async () => {
            // Configure mock specifically for this test scenario
            mockedFs.readFile.mockResolvedValue(mockDevicesJson);

            const promise1 = devicesModule.getDevices();
            const promise2 = devicesModule.getDevices();
            const [devices1, devices2] = await Promise.all([promise1, promise2]);

            expect(mockedFs.readFile).toHaveBeenCalledTimes(1); // Should only read once
            expect(devices1).toEqual(devices2);
            expect(devices1).toHaveLength(mockDevicesData.length);
        });

        it('should return empty array if file does not exist (ENOENT)', async () => {
            const error: any = new Error('File not found');
            error.code = 'ENOENT';
            // Configure mock specifically for this test scenario
            mockedFs.readFile.mockRejectedValue(error);
            
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const devices = await devicesModule.getDevices();

            expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
            expect(devices).toEqual([]);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
            consoleWarnSpy.mockRestore();
        });

        it('should re-throw other file read errors', async () => {
            const error = new Error('Read permission denied');
             // Configure mock specifically for this test scenario
            mockedFs.readFile.mockRejectedValue(error);

            await expect(devicesModule.getDevices()).rejects.toThrow('Read permission denied');
            expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
        });
        
        it('should initialize last_status to empty object if missing', async () => {
            const devicesWithoutStatus = [{ id: 'dev4', ip: '10.0.0.24' }];
            // Configure mock specifically for this test scenario
            mockedFs.readFile.mockResolvedValue(JSON.stringify(devicesWithoutStatus));
            const devices = await devicesModule.getDevices();
            expect(devices[0].last_status).toEqual({});
        });
    });

    describe('getDeviceIdFromTopic', () => {
         // Load cache before tests in this block
         beforeEach(async () => {
            mockedFs.readFile.mockResolvedValue(mockDevicesJson);
            await devicesModule.getDevices(); // Load cache and build map
            mockedFs.readFile.mockClear(); // Clear calls from setup
        });

        it('should find device ID for valid topic', () => {
            expect(devicesModule.getDeviceIdFromTopic('stat/spot_21/POWER')).toBe('dev1');
            expect(devicesModule.getDeviceIdFromTopic('tele/spot_22/STATE')).toBe('dev2');
        });

        it('should return null for unknown IP suffix', () => {
            expect(devicesModule.getDeviceIdFromTopic('stat/spot_99/POWER')).toBeNull();
        });

        it('should return null for invalid topic format', () => {
            expect(devicesModule.getDeviceIdFromTopic('stat/POWER')).toBeNull();
            expect(devicesModule.getDeviceIdFromTopic('stat//POWER')).toBeNull();
            expect(devicesModule.getDeviceIdFromTopic('stat/notaspot_21/POWER')).toBeNull();
        });
    });

    describe('updateDeviceStatus (and debounced write)', () => {
         // Load initial data before tests in this block
        beforeEach(async () => {
            mockedFs.readFile.mockResolvedValue(mockDevicesJson);
            await devicesModule.getDevices();
            mockedFs.readFile.mockClear(); 
        });

        it('should update status in cache for existing device', async () => {
            const update: Partial<BulbStatus> = { power: 'OFF', brightness: 0 };
            await devicesModule.updateDeviceStatus('dev1', update);

            // Call getDevices again to retrieve from potentially updated cache
            const devices = await devicesModule.getDevices(); 
            const updatedDevice = devices.find(d => d.id === 'dev1');

            expect(updatedDevice?.last_status.power).toBe('OFF');
            expect(updatedDevice?.last_status.brightness).toBe(0);
        });

        it('should merge partial updates', async () => {
            const update: Partial<BulbStatus> = { color: '#FF0000' };
            await devicesModule.updateDeviceStatus('dev1', update);

            const devices = await devicesModule.getDevices(); 
            const updatedDevice = devices.find(d => d.id === 'dev1');

            expect(updatedDevice?.last_status.power).toBe('ON'); // Original value
            expect(updatedDevice?.last_status.brightness).toBe(50); // Original value
            expect(updatedDevice?.last_status.color).toBe('#FF0000'); // New value
        });

         it('should not update status for non-existent device', async () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const update: Partial<BulbStatus> = { power: 'ON' };
            await devicesModule.updateDeviceStatus('dev99', update);
            
            const devices = await devicesModule.getDevices();
            const initialDevices = JSON.parse(mockDevicesJson);
            
            expect(devices).toEqual(initialDevices.map((d: BulbDeviceData) => ({...d, last_status: d.last_status || {}}))); 
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('dev99 not found'));
            consoleWarnSpy.mockRestore();
        });

        it('should schedule a debounced write on update', async () => {
            await devicesModule.updateDeviceStatus('dev1', { brightness: 100 });

            expect(mockedFs.writeFile).not.toHaveBeenCalled();
            // Advance time
            jest.advanceTimersByTime(1100); 
            expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
            // Check written data
            const writtenData = JSON.parse(mockedFs.writeFile.mock.calls[0][1] as string);
            expect(writtenData.find((d: BulbDeviceData) => d.id === 'dev1')?.last_status?.brightness).toBe(100);
        });

        it('should reset debounce timer on subsequent updates', async () => {
            await devicesModule.updateDeviceStatus('dev1', { brightness: 10 });
            expect(mockedFs.writeFile).not.toHaveBeenCalled();

            jest.advanceTimersByTime(500);
            await devicesModule.updateDeviceStatus('dev2', { power: 'ON' }); 
            expect(mockedFs.writeFile).not.toHaveBeenCalled();

            jest.advanceTimersByTime(600); 
            expect(mockedFs.writeFile).not.toHaveBeenCalled();

            jest.advanceTimersByTime(500); 
            expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
            // Check written data contains both updates
            const writtenData = JSON.parse(mockedFs.writeFile.mock.calls[0][1] as string);
            expect(writtenData.find((d: BulbDeviceData) => d.id === 'dev1')?.last_status?.brightness).toBe(10);
            expect(writtenData.find((d: BulbDeviceData) => d.id === 'dev2')?.last_status?.power).toBe('ON');
        });
    });

    describe('getDeviceById', () => {
        beforeEach(async () => {
            // Configure mock for this block
            mockedFs.readFile.mockResolvedValue(mockDevicesJson);
            await devicesModule.getDevices(); // Pre-load cache
            mockedFs.readFile.mockClear();
        });

        it('should return device data for existing ID', async () => {
            const device = await devicesModule.getDeviceById('dev1');
            expect(device).toBeDefined();
            expect(device?.id).toBe('dev1');
            expect(device?.ip).toBe('10.0.0.21');
        });

        it('should return undefined for non-existent ID', async () => {
            const device = await devicesModule.getDeviceById('dev99');
            expect(device).toBeUndefined();
        });
    });

    describe('getDeviceMqttId', () => {
        // No beforeEach needed for this pure function
        it('should generate correct MQTT ID for valid IP', () => {
            const device: BulbDeviceData = { id: 'dev1', ip: '10.0.0.21', last_status: {} };
            expect(devicesModule.getDeviceMqttId(device)).toBe('spot_21');
        });

        it('should handle IPs with leading zeros in suffix', () => {
             const device: BulbDeviceData = { id: 'dev4', ip: '10.0.0.05', last_status: {} };
             expect(devicesModule.getDeviceMqttId(device)).toBe('spot_05');
        });

        it('should return placeholder for invalid IP format', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const device: BulbDeviceData = { id: 'dev3', ip: '10.0.0.23/invalid', last_status: {} };
            expect(devicesModule.getDeviceMqttId(device)).toBe('spot_invalid_dev3');
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid IP format or suffix for device dev3'));
            consoleWarnSpy.mockRestore();
        });

        it('should return placeholder for IP with missing parts', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const device: BulbDeviceData = { id: 'dev4', ip: '10.0.0', last_status: {} };
            expect(devicesModule.getDeviceMqttId(device)).toBe('spot_invalid_dev4');
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid IP format or suffix for device dev4'));
            consoleWarnSpy.mockRestore();
        });
    });

     describe('forceWriteDevicesToFile', () => {
         beforeEach(async () => {
            // Configure mock for this block
            mockedFs.readFile.mockResolvedValue(mockDevicesJson);
            await devicesModule.getDevices(); // Pre-load cache
            mockedFs.readFile.mockClear();
        });

        it('should write immediately even if no update occurred', async () => {
            await devicesModule.forceWriteDevicesToFile();
            expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
            // Check it writes the state loaded in beforeEach
            expect(mockedFs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('devices.json'),
                mockDevicesJson, 
                'utf-8'
            );
        });

        it('should clear pending debounce timer and write immediately', async () => {
            await devicesModule.updateDeviceStatus('dev1', { brightness: 99 });
            expect(mockedFs.writeFile).not.toHaveBeenCalled();

            await devicesModule.forceWriteDevicesToFile();
            expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);

            const writtenData = JSON.parse(mockedFs.writeFile.mock.calls[0][1] as string);
            expect(writtenData.find((d: BulbDeviceData) => d.id === 'dev1')?.last_status?.brightness).toBe(99);

            // Advance timer - should not trigger another write
            jest.advanceTimersByTime(1100);
            expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
        });
    });
}); 