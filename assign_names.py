import tinytuya
import json
import time

# Load devices from JSON file
def load_devices(filename="devices.json"):
    with open(filename) as file:
        data = json.load(file)
    return data

# Function to make a light flicker
def flicker_light(device):
    d = tinytuya.BulbDevice(device['id'], device['ip'], device['key'])
    d.set_version(3.3)
    for _ in range(5):  # Flicker 5 times
        d.turn_on()
        time.sleep(2)  # Adjust timing as needed
        d.turn_off()
        time.sleep(2)

# Function to prompt for matrix position and update device names
def assign_matrix_positions(devices):
    updated_devices = []
    for device in devices:
        print(f"Flickering device {device['id']} for identification...")
        flicker_light(device)  # Make the light flicker
        # Prompt for row and column positions
        row = input("Enter row number for this device: ")
        column = input("Enter column number for this device: ")
        # Update the device name based on matrix position
        device_name = f"Light {row}-{column}"
        updated_device = {**device, 'name': device_name}
        updated_devices.append(updated_device)
    return updated_devices

# Main function to run the program
def main():
    devices = load_devices()
    updated_devices = assign_matrix_positions(devices)
    # Print updated device list for verification
    print("\nUpdated device list with matrix positions:")
    for device in updated_devices:
        print(f"{device['name']}: {device}")

if __name__ == "__main__":
    main()
