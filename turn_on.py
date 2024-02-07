import json
import tinytuya

def load_devices(filepath):
    with open(filepath, 'r') as file:
        devices = json.load(file)
    return devices

def turn_on_lights(devices):
    for device_info in devices:
        device = tinytuya.BulbDevice(device_info['id'], device_info['ip'], device_info['key'])
        device.set_version(3.3)  # Set the protocol version; adjust if necessary
        device.turn_on()  # '1' is typically the DPS index for power on/off, adjust if your device differs
        print(f"Turned on {device_info['name']}")

if __name__ == "__main__":
    filepath = 'devices.json'  # Update this path
    devices = load_devices(filepath)
    turn_on_lights(devices)
