import tinytuya
import json
def get_all_devices() -> dict:
    try:
        with open('devices.json') as f:
            devices = json.load(f)
        devices_list = {}
        switches = []
        bulbs = []
        for device in devices:
            if device["ip"] == "":
                continue
            if device["product_name"] == "KS-7012":
                switches.append(tinytuya.OutletDevice(device["id"], device["ip"], device["key"]))
            elif device["product_name"] == "60W Tune + Color":
                bulbs.append(tinytuya.BulbDevice(device["id"], device["ip"], device["key"]))
        devices_list["switches"] = switches
        devices_list["bulbs"] = bulbs
        return devices_list
    except Exception as e:
        tinytuya.deviceScan()
        get_all_devices()
    

if __name__ == "__main__":
    print(get_all_devices())
    print("Done")