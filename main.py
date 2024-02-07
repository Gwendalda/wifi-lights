import tinytuya
import json
from tkinter import Tk, Scale, Label, HORIZONTAL

def load_devices(filename="devices.json"):
    with open(filename, "r") as file:
        devices = json.load(file)
    return devices

def change_light_color(devices, color):
    for device_info in devices:
        device = tinytuya.BulbDevice(device_info['id'], device_info['ip'], device_info['key'])
        device.set_version(3.3)
        device.set_colour(color[0], color[1], color[2])

def update_color(val):
    color = (red_slider.get(), green_slider.get(), blue_slider.get())
    change_light_color(devices, color)

# Load devices
devices = load_devices()

# Setup GUI
root = Tk()
root.title("Real-Time Color Picker for Lights")

red_slider = Scale(root, from_=0, to=255, orient=HORIZONTAL, label="Red", command=update_color)
red_slider.pack(anchor='center')

green_slider = Scale(root, from_=0, to=255, orient=HORIZONTAL, label="Green", command=update_color)
green_slider.pack(anchor='center')

blue_slider = Scale(root, from_=0, to=255, orient=HORIZONTAL, label="Blue", command=update_color)
blue_slider.pack(anchor='center')

root.mainloop()
