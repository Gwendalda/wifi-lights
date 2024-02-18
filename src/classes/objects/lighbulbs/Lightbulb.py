import tinytuya
import json

from overrides import override

class LightBulb(tinytuya.BulbDevice):
    def __init__(self, device_id, ip, local_key):
        super().__init__(device_id, ip, local_key)
        self._device_id = device_id
        self._ip = ip
        self._local_key = local_key

    @override
    def get_status(self):
        return super().status()

    @override
    def set_status(self, status):
        return super().set_status(status)

    @override
    def get_colour(self):
        return super().colour()

    @override
    def set_colour(self, colour):
        return super().set_colour(colour)

    @override
    def get_brightness(self):
        return super().brightness()

    @override
    def set_brightness(self, brightness):
        return super().set_brightness(brightness)

    @override
    def get_temperature(self):
        return super().temperature()

    @override
    def set_temperature(self, temperature):
        return super().set_temperature(temperature)

    @override
    def get_mode(self):
        return super().mode()

    @override
    def set_mode(self, mode):
        return super().set_mode(mode)

    @override
    def get_scene(self):
        return super().scene()

    @override
    def set_scene(self, scene):
        return super().set_scene(scene)

    @override
    def get_music(self):
        return super().music()

    @override
    def set_music(self, music):
        return super().set_music(music)

    @override
    def get_name(self):
        return super().name()

    @override
    def set_name(self, name):
        return super().set_name(name)

    @override
    def get_version(self):
        return super().version()

    @override
    def get_model(self):
        return super().model()

    @override
    def get_dps(self):
        return super().dps()

    @override
    def set_dps(self, dps):
        return super().set_dps(dps)

    @override
    def get_all(self):
        return super().all()