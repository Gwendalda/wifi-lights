from src.core.send import send_post_request, send_get_request
import json
import asyncio


def get_devices():
    with open("devices.json", "r") as file:
        devices = json.load(file)
    return devices

async def get_status(device):
    try:
        ip = device["ip"]
        url = f"http://{ip}/app"
        response = await send_get_request(ip, url)
        return response
    except Exception as e:
        print(f"Error: {e}")
        return None

toggle_on_off_url = "http://{ip}/index?tgl=130"

async def turn_on(device):
    ip = device["ip"]
    status_code = await send_get_request(ip, "http://{ip}/cm?cmnd=Power%20On".format(ip=ip))
    return status_code

async def turn_off(device):
    ip = device["ip"]
    status_code = await send_get_request(ip, "http://{ip}/cm?cmnd=Power%20Off".format(ip=ip))
    return status_code

async def send_rgbbt(device, x, red, green, blue, brightness, temperature):
    ip = device["ip"]
    url = f"http://{ip}/api/channels"
    # jsonify payload
    payload = [x, red, green, blue, brightness, temperature]
    status_code = await send_post_request(ip, url, payload=payload)
    return status_code


def main():
    devices = get_devices()
    for device in devices:
         # asyncio.run(send_rgbbt(device, 0, 70, 0, 0, 50, 30))
        asyncio.run(turn_off(device))

if __name__ == "__main__":
    main()
