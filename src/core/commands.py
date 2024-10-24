from src.core.devices import BulbDevice
import json

def get_devices():
    with open("devices.json", "r") as file:
        devices = json.load(file)
        device_objects = []
        for device in devices:
            device_objects.append(BulbDevice(device["name"], device["ip"]))

    return device_objects

