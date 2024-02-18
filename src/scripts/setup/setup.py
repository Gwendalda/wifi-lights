import tinytuya
import json
def get_all_devices() -> list:
    tinytuya.deviceScan()
    with open('devices.json') as f:
        devices = json.load(f)
    devices_list = []
    for device in devices:
        if device["product_name"] == "KS-7012":
            devices_list.append(tinytuya.OutletDevice(device["id"], device["ip"], device["key"]))
        elif device["product_name"] == "60W Tune + Color":
            devices_list.append(tinytuya.BulbDevice(device["id"], device["ip"], device["key"]))
    return devices_list


if __name__ == "__main__":
    get_all_devices()
    print("Done")
