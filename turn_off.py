import json
import tinytuya


def load_devices(filepath):
    with open(filepath, 'r') as file:
        devices = json.load(file)
    return devices


def turn_off_lights(devices):
    for device_info in devices:
        device = tinytuya.BulbDevice(
            device_info['id'], device_info['ip'], device_info['key'])
        # Set the protocol version; adjust if necessary
        device.set_version(3.3)
        # '1' is typically the DPS index for power on/off, adjust if your device differs
        device.turn_off()
        print(f"Turned on {device_info['name']}")


if __name__ == "__main__":
    filepath = 'devices.json'  # Update this path
    devices = load_devices(filepath)
    turn_off_lights(devices)
