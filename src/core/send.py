import aiohttp
import asyncio

async def send_post_request(ip, url, payload):
    headers = {
        "Host": ip,
        "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0",
        "Accept": "*/*",
        "Accept-Language": "en-GB,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Referer": f"http://{ip}/app?",
        "Content-Type": "text/plain;charset=UTF-8",
        "Origin": f"http://{ip}",
        "Connection": "keep-alive",
        "Priority": "u=0"
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as response:
            return await response.text()

async def send_get_request(ip, url):
    headers = {
        "Host": ip,
        "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0",
        "Accept": "*/*",
        "Accept-Language": "en-GB,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Referer": f"http://{ip}/app?",
        "Origin": f"http://{ip}",
        "Connection": "keep-alive",
        "Priority": "u=0"
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as response:
            return await response.text()

