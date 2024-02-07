import json
import time
import tinytuya


def load_devices(filepath):
    with open(filepath, 'r') as file:
        devices = json.load(file)
    output = []
    for d in devices:
        device = tinytuya.BulbDevice(d['id'], d['ip'], d['key'])
        device.set_version(3.3)
        output.append(device)

    return output


def set_brightness(devices, brightness):
    for device_info in devices:
        device = tinytuya.BulbDevice(
            device_info['id'], device_info['ip'], device_info['key'])
        # Set the protocol version; adjust if necessary
        device.set_version(3.3)
        device.set_brightness_percentage(brightness)
        print(f"Set brightness of {device_info['name']} to {brightness}%")


def read_status(device):
    status = device.status()
    print(f"Device is currently %r" % status)


if __name__ == "__main__":
    filepath = 'devices.json'  # Update this path
    devices = load_devices(filepath)
    set_brightness(devices, 50)
