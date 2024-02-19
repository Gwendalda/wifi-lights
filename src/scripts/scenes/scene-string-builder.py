def hex_format(value, length):
    """Format value as hexadecimal with a given length."""
    return f"{value:0{length}x}"

def create_color_string(hue, saturation, level):
    """Create a color string based on hue, saturation, and level."""
    return hex_format(hue, 4) + hex_format(saturation, 4) + hex_format(level, 4) + "0000"

def create_white_string(shade):
    """Create a white string based on shade."""
    return "000000000000" + hex_format(shade, 8)

def create_scene_string(scene_index, speed, transition, colors):
    """Create a scene string based on index, speed, transition, and colors."""
    scene_string = hex_format(scene_index, 2) + hex_format(speed, 4) + hex_format(transition, 2)
    for color in colors:
        if color['type'] == 'color':
            scene_string += create_color_string(color['hue'], color['saturation'], color['level'])
        elif color['type'] == 'white':
            scene_string += create_white_string(color['shade'])
    return scene_string

def main():
    # Example input process for a single scene with two colors
    scene_index = int(input("Scene index (0-?): "))
    speed = int(input("Speed (0-100, will be duplicated): ")) * 1016 // 100  # Convert to 0-6464 scale
    transition = int(input("Transition (0: static, 1: flashing, 2: breathing): "))
    
    # Example for adding colors
    colors = []
    while True:
        color_type = input("Add color or white (type 'color' or 'white', 'done' to finish): ")
        if color_type == 'done':
            break
        if color_type == 'color':
            hue = int(input("Hue (0-360): "))
            saturation = int(input("Saturation (0-1000): "))
            level = int(input("Level (1-1000): "))
            colors.append({'type': 'color', 'hue': hue, 'saturation': saturation, 'level': level})
        elif color_type == 'white':
            shade = int(input("Shade of white (0-1000): "))
            colors.append({'type': 'white', 'shade': shade})
    
    # Create and display the scene string
    scene_string = create_scene_string(scene_index, speed, transition, colors)
    print(f"Scene string: {scene_string}")

# Run the program
main()
