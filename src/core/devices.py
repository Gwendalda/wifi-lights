from src import *
from src.core.send import send_post_request, send_get_request
import json
import asyncio
import threading


class BulbDevice: 
    def __init__(self, id, ip, last_status=None):
        self.id = id
        self.ip = ip
        self.last_status = last_status

    async def get_status(self):
        try:
            url = f"http://{self.ip}/app"
            response = await send_get_request(self.ip, url)
            self.status = response
            return response
        except Exception as e:
            print(f"Error: {e}")
            return None
    
    async def send_rgbbt(self, x, red, green, blue, brightness, temperature):
        url = f"http://{self.ip}/api/channels"
        payload = [x, red, green, blue, brightness, temperature]
        status_code = await send_post_request(self.ip, url, payload=payload)
        return status_code

    async def turn_on(self):
        if self.last_status["brightness"] == 0 and self.last_status["red"] == 0 and self.last_status["green"] == 0 and self.last_status["blue"] == 0 and self.last_status["temperature"] == 0:
            self.last_status = {"brightness": 50, "red": 70, "green": 0, "blue": 0, "temperature": 30}
            self.save()
            await self.send_rgbbt(0, 70, 0, 0, 50, 30)
        else:
            await self.send_rgbbt(0, self.last_status["red"], self.last_status["green"], self.last_status["blue"], self.last_status["brightness"], self.last_status["temperature"])
        return None

    async def turn_off(self):
        await send_get_request(self.ip, "http://{ip}/cm?cmnd=Power%20Off".format(ip=self.ip))
        return None
    
    @staticmethod
    def get_devices():
        with open("/home/gwendalda/wifi-lights/devices.json", "r") as file:
            devices = json.load(file)
            device_objects = []
            for device in devices:
                device_objects.append(BulbDevice(device["id"], device["ip"], last_status=device["last_status"]))

        return device_objects

    def save(self):
        with open("/home/gwendalda/wifi-lights/devices.json", "r") as file:
            devices = json.load(file)
            for device in devices:
                if device["id"] == self.id:
                    device["last_status"] = self.last_status
                    break
        with open("/home/gwendalda/wifi-lights/devices.json", "w") as file:
            json.dump(devices, file)

    @staticmethod
    def save_devices(devices):
        with open("/home/gwendalda/wifi-lights/devices.json", "w") as file:
            device_data = []
            for device in devices:
                device_data.append({"id": device.id, "ip": device.ip, "last_status": device.last_status})
            json.dump(device_data, file)

    def __str__(self):
        return f"{self.id} - {self.ip}"

    def __repr__(self):
        return f"{self.id} - {self.ip}"
    

    @classmethod
    def turn_on_all_devices(cls):
        devices = cls.get_devices()
        threads = []
        
        def turn_on_device(device):
            asyncio.run(device.turn_on())
        
        for device in devices:
            thread = threading.Thread(target=turn_on_device, args=(device,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()

    @classmethod
    def turn_off_all_devices(cls):
        devices = cls.get_devices()
        threads = []
        
        def turn_off_device(device):
            asyncio.run(device.turn_off())
        
        for device in devices:
            thread = threading.Thread(target=turn_off_device, args=(device,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
