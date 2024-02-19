import time
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
    switch = devices["switches"][0]
    switch.set_version(3.3)
    print(switch)
    current_on_off_status = None
    current_brighness_status = None
    while True:
        status = switch.status()
        if status["dps"]['1'] == False and devices["bulbs"][0].status()["dps"]['20'] == True and current_on_off_status != False:
            print("Switch is off")
            current_on_off_status = False
            for bulb in devices["bulbs"]:
                bulb.turn_off(nowait=True)
        if status["dps"]['1'] == True and devices["bulbs"][0].status()["dps"]['20'] == False and current_on_off_status != True:
            print("Switch is on")
            current_on_off_status = True
            bulb_status = devices["bulbs"][0].status()
            print(bulb_status)
            for bulb in devices["bulbs"]:
                bulb.turn_on(nowait=True)
        if status['dps']['2'] != current_brighness_status and current_on_off_status == True:
            print("Brightness has changed")
            current_brighness_status = status['dps']['2']
            for bulb in devices["bulbs"]:
                bulb.set_brightness(current_brighness_status, nowait=True)


if __name__ == "__main__":
     main()
    #devices = get_all_devices()
    #for bulb in devices["bulbs"]:
        #bulb.set_colour(255, 125, 125, nowait=True)
        #bulb.set_mode(mode='color', nowait=True)
        #bulb.set_mode(mode='scene', nowait=True)
        #bulb.set_value(25, """c9303002016003e803e80000000030300200ee03e803e800000000""")
        #0201fc0200c8032001b800000000032001b80000
        #time.sleep(0.5)