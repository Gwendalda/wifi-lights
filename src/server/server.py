from flask import Flask
from flask import request
from flask import jsonify
import asyncio
app = Flask(__name__)
from src.core.send import send_post_request, send_get_request
from src.core.devices import *
from flask import request, jsonify

# Flask app route to handle incoming data from the ESP32
@app.route('/update', methods=['GET'])
def update():
    try:
        pin = request.args.get("pin")
        state = request.args.get("state")

        if pin is None or state is None:
            return jsonify({"error": "Invalid data received"}), 400

        # Process the data (e.g., toggle a light, log the event, etc.)
        print(f"Button pressed on pin {pin}, state: {state}")
        print(f"Getting devices")
        devices = BulbDevice.get_devices()
        if state == "1":
            BulbDevice.turn_on_all_devices()
        else:
            print("turning off")
            BulbDevice.turn_off_all_devices()
        return jsonify({"message": "Button press processed"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Failed to process button press"}), 500

