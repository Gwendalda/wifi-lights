import time
import json 
import tinytuya
from Lightbulb import LightBulb

     
def create_light_matrix(lights:list, rows=4, cols=4):
    matrix = [[None for _ in range(cols)] for _ in range(rows)]
    for light in lights:
        _, position = light.name.split(" ")
        row, col = map(int, position.split("-"))
        matrix[row-1][col-1] = light
    return matrix

def gradual_brightness_change(light:LightBulb, start_percentage, end_percentage, steps=5, duration=0.2):
    step_size = (end_percentage - start_percentage) / steps
    for i in range(steps + 1):
        
        current_percentage = start_percentage + step_size * i
        print(current_percentage)
        print(light.get_status())
        light.set_brightness_percentage(round(current_percentage))
        time.sleep(duration / steps)

def water_drop_pulse(light, duration=2):
    # Brighten up to 100% then dim back to original brightness (50%) within the specified duration
    half_duration = duration / 2
    gradual_brightness_change(light, 50, 100, steps=10, duration=half_duration)
    gradual_brightness_change(light, 100, 50, steps=10, duration=half_duration)

def water_drop_effect(matrix, start_row, start_col):
    initial_light = matrix[start_row][start_col]
    if initial_light:
        water_drop_pulse(initial_light, duration=2)
if __name__ == "__main__":
    lights = LightBulb.load_devices("devices.json")
    matrix = create_light_matrix(lights)
    # For the purpose of this example, start_row and start_col are set to simulate starting from the middle
    water_drop_effect(matrix, 1, 1)  # Assuming Light 2-2 is in the middle

