import subprocess
import requests

def get_arp_table():
    result = subprocess.run(['arp', '-a'], capture_output=True, text=True)
    return result.stdout


def send_post_request(ip, url, payload):
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
    response = requests.post(url, headers=headers, data=payload)
    return response.status_code

