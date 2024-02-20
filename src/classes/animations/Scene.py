import tinytuya 
import json
"""
Scene class
Scenes are a collection of rotations that are played in sequence.
Each scene is represented byt a string.
The string is sent to the device to be played.
String structure :

scene_number : 2 chars + speed of the transition : 4 chars (0 to 6464) + transition_mode : 2 chars (00 - static, 01 - flashing, 02 - breathing) + color : 12 chars (Red, Green, Blue) + Shade of White : 8 chars (Shade of white ? perhaps brighness)

A rotation is simply everything that comes after a scene number.
"""

class Scene:
    def __init__(self, name:str, scene_number:str="01"):
        self.name = name
        self.rotations = []
        self.scene_number = scene_number
    def build(self):
        scene_string = self.scene_number
        for rotation in self.rotations:
            if type(rotation) == str:
                scene_string += rotation
            elif type(rotation) == Rotation:
                scene_string += rotation.build()
            else:
                raise ValueError("Invalid rotation type")
        return scene_string


def format_to_hex(value:int):
    # all the hex string must be 4 characters long with leading 0s
    return str(format(value, '04x'))




class Rotation:
    def __init__(self):
        self.red = "1000"
        self.green = "1000"
        self.blue = "1000"
        self.white_string = "00000000"
        self.duration = "4646"
        self.transition_mode = "02"

    def set_color(self, red:int, green:int, blue:int):
        if red < 0 or red > 1000:
            raise ValueError("Red value must be between 0 and 1000")
        if green < 0 or green > 1000:
            raise ValueError("Green value must be between 0 and 1000")
        if blue < 0 or blue > 1000:
            raise ValueError("Blue value must be between 0 and 1000")
        # all the hex string must be 4 characters long with leading 0s
        self.red = str(format_to_hex(red))
        self.green = str(format_to_hex(green))
        self.blue = str(format_to_hex(blue))
        return self
    
    def set_white(self, white:int):
        if self.red != "000" or self.green != "000" or self.blue != "000":
            raise ValueError("White value can only be set if the color is white")
        if white < 0 or white > 1000:
            raise ValueError("White value must be between 0 and 1000")
        self.white_string = str(format_to_hex(white))
        return self

    def set_duration(self, duration_1:int, duration_2:int):
        if duration_1 < 0 or duration_2 > 100:
            raise ValueError("Duration value must be between 0 and 100")
        duration_string = str(hex(duration_1)[2:] + hex(duration_2)[2:])
        self.duration = duration_string
        return self
    
    def set_transition_mode(self, transition_mode:int):
        if transition_mode < 0 or transition_mode > 2:
            raise ValueError("Transition mode must be between 0 and 2")
        self.transition_mode = "0" + str(transition_mode)
        return self

    def build(self):
        return f"{self.duration}{self.transition_mode}{self.red}{self.green}{self.blue}{self.white_string}"


def get_all_devices():
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

if __name__ == "__main__":
    # an interactive way to create scenes
    scene = Scene(input("Enter the name of the scene : "))
    while True:
        rotation = Rotation()

        # Validate and set color
        while True:
            try:
                red = int(input("Red (0-1000): "))
                green = int(input("Green (0-1000): "))
                blue = int(input("Blue (0-1000): "))
                if 0 <= red <= 1000 and 0 <= green <= 1000 and 0 <= blue <= 1000:
                    rotation.set_color(red, green, blue)
                    break
                else:
                    print("Invalid color values. Please enter values between 0 and 1000.")
            except ValueError:
                print("Invalid input. Please enter numeric values.")

        # Validate and set duration
        while True:
            try:
                duration_1 = int(input("Duration 1 (0-100): "))
                duration_2 = int(input("Duration 2 (0-100): "))
                if 0 <= duration_1 <= 100 and 0 <= duration_2 <= 100:
                    rotation.set_duration(duration_1, duration_2)
                    break
                else:
                    print("Invalid duration values. Please enter values between 0 and 100.")
            except ValueError:
                print("Invalid input. Please enter numeric values.")

        # Validate and set transition mode
        while True:
            try:
                transition_mode = int(input("Transition mode (0 - static, 1 - flashing, 2 - breathing): "))
                if 0 <= transition_mode <= 2:
                    rotation.set_transition_mode(transition_mode)
                    break
                else:
                    print("Invalid transition mode. Please enter a value between 0 and 2.")
            except ValueError:
                print("Invalid input. Please enter numeric values.")

        scene.rotations.append(rotation)
        if input("Add another rotation ? (Y/N) : ").lower() == "n":
            break
    print(scene.build())
    input("Do you want to play the scene ? (Press enter to continue)")
    devices = get_all_devices()
    for bulbDevice in devices["bulbs"]:
        bulbDevice.set_mode("scene")
        print(bulbDevice.status())
        bulbDevice.set_value(25, scene.build())
        print(bulbDevice.status())
        print("Scene successfully uploaded !")


#4646 02 02bc 3e80 0000 000