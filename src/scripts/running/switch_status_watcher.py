import time
import tinytuya
import json
import pprint
import os

SNAPSHOT_PATH = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(os.path.dirname(__file__)))))+ "/snapshot.json"
SCENES_PATH = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(os.path.dirname(__file__)))))+ "/scenes.json"

def get_all_devices() -> dict:

    with open(SNAPSHOT_PATH) as f:
        data = json.load(f)["devices"]
    devices = {
        "bulbs": [],
        "switches": []
    }
    for device in data:
        if device["ip"] == "":
            continue
        if device["err"]:
            continue
        if "1" not in device["dps"]["dps"]:
            device_instantiation = tinytuya.BulbDevice(device["id"], device["ip"], device["key"])
            device_instantiation.set_version(3.3)
            devices["bulbs"].append(device_instantiation)
        if "1" in device["dps"]['dps']:
            device_instantiation = tinytuya.OutletDevice(device["id"], device["ip"], device["key"])
            device_instantiation.set_version(3.3)
            devices["switches"].append(device_instantiation)
        
    return devices


def change_scene(brightness_level, scenes: dict, bulbs: list):
    print(brightness_level)
    for bulb in bulbs:
        bulb.set_mode('scene')
        bulb.set_value(25, scenes[brightness_level], nowait=True)     


def simple_brightness(brightness_level):
    if brightness_level < 50:
        return "1"
    if brightness_level < 90:
        return "2"
    if brightness_level < 135:
        return "3"
    if brightness_level < 190:
        return "4"
    if brightness_level < 235:
        return "5"
    return "6"

def main():
    try:
        devices = get_all_devices()
        switch = devices["switches"][0]
        switch.set_version(3.3)
    except FileNotFoundError:
        print("Snapshot file not found")
        tinytuya.scan()
        print("Scanning for devices and creating snapshot")
        devices = get_all_devices()
        switch = devices["switches"][0]
        switch.set_version(3.3)
    current_on_off_status = None
    current_brighness_status = None
    with open(SCENES_PATH) as f:
                scenes = json.load(f)
    while True:
        status = switch.status()
        if 'dps' not in status.keys():
            continue
        for bulb in devices["bulbs"]:
            time0 = time.time()

            if time.time() - time0 > 5:
                print("Timeout")
                tinytuya.scan()
                devices = get_all_devices()
                switch = devices["switches"][0]
                switch.set_version(3.3)   
        if status["dps"]['1'] == False and devices["bulbs"][0].status()["dps"]['20'] == True and current_on_off_status != False:
            print("Switch is off")
            current_on_off_status = False
            for bulb in devices["bulbs"]:
                bulb.turn_off(nowait=True)
        if status["dps"]['1'] == True and devices["bulbs"][0].status()["dps"]['20'] == False and current_on_off_status != True:
            print("Switch is on")
            current_on_off_status = True
            #print(devices["bulbs"][0].status()["dps"]['20'])
            for bulb in devices["bulbs"]:
                bulb.turn_on(nowait=True)
        if status['dps']['2'] != current_brighness_status:
            print("Brightness has changed")
            current_brighness_status = status['dps']['2']
            change_scene(simple_brightness(status['dps']['2']), scenes, devices["bulbs"])

if __name__ == "__main__":
    main()
    