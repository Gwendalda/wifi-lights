import tinytuya

class Switch(tinytuya.OutletDevice):
    def __init__(self, device_id, ip, local_key):
        if device_id is None:
            raise ValueError("Device ID is required")
        if ip is None:
            raise ValueError("IP is required")
        if local_key is None:
            raise ValueError("Local Key is required")
        super().__init__(device_id, ip, local_key)

    def get_status(self):
        return super().status()
    
    def set_status(self, status):
        return super().set_status(status)