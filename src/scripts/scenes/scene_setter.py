import tinytuya
import json

def get_all_devices() -> dict:
    with open('devices.json') as f:
        data = json.load(f)
    devices = {
        "bulbs": [],
        "switches": []
    }
    for device in data:
        if device["ip"] == "":
            continue
        if device["product_name"] == "60W Tune + Color":
            device_instantiation = tinytuya.BulbDevice(device["id"], device["ip"], device["key"])
            device_instantiation.set_version(3.3)
            devices["bulbs"].append(device_instantiation)
        if device["product_name"] == "KS-7012":
            device_instantiation = tinytuya.OutletDevice(device["id"], device["ip"], device["key"])
            device_instantiation.set_version(3.3)
            devices["switches"].append(device_instantiation)
    return devices

def main():
    devices = get_all_devices()


    for bulbDevice in devices["bulbs"]:
        bulbDevice.set_mode("scene")
        print(bulbDevice.status())
        bulbDevice.set_value(25, "011414020384012c012c0000000014140202bc01f401f40000000014140201f402bc02bc00000000141402012c0384038400000000")

if __name__ == "__main__":
    main()

# c9 3030 02 0160 03e8 03e8 0000000030300200ee03e803e800000000
# 01 4646 02 3e80 2bc0 0000 00046460202bc3e800000000