import tinytuya
import json

from overrides import override

class LightBulb(tinytuya.BulbDevice):
    # Device info is a dictionary contained within the devices.json file. It contains a list of device dictionary elements.

    def __init__(self, device_info):
        super().__init__(device_info['id'], device_info['ip'], device_info['key'])
        self.set_version(3.3)
        self.name = device_info['name']
        self.device_info = device_info
        self.row = int(device_info['name'].split(' ')[1].split('-')[0])-1
        self.column = int(device_info['name'].split(' ')[1].split('-')[1])-1


    @staticmethod
    def load_devices(filepath):
        with open(filepath, 'r') as file:
            devices = json.load(file)
        output = []
        for device in devices:
            output.append(LightBulb(device))
        return output
    
    def get_status(self):
        DPS_KEY_CORRESPONDENCE = {
        '20' : 'switch',
        '21' : 'Mode',
        '22' : 'Brightness',
        '23' : 'color_temp',
        '24' : 'Color',
        '25' : 'Scene',
        '26' : 'Left_time',
        '27' : 'Music',
        '28' : 'Debugger',
        '29' : 'Debug'
        }
        status = self.status()
        status_refactor = {}
        for key in status['dps'].keys():
            if key in DPS_KEY_CORRESPONDENCE.keys():
                status_refactor[DPS_KEY_CORRESPONDENCE[key]] = status['dps'][key]
        status_string = f"{self.name} : %r" % status_refactor
        return status_string
    
    def __str__(self):
        return str(self.device_info)


if __name__ == "__main__":
    filepath = 'devices.json'  # Update this path
    devices = LightBulb.load_devices(filepath)
    for device in devices:
        print(device.row, device.column)
        print("\n")
