# WiFi Lights Control Application

This is a Next.js web application to control Tasmota-based WiFi lights (like RGB spot lights) via MQTT.

## Features

-   Real-time status updates via MQTT subscriptions.
-   Control individual or all lights:
    -   Turn On/Off
    -   Set Color (Hex)
    -   Set Color Temperature (Kelvin)
-   Web UI built with Next.js (App Router) and Tailwind CSS.

## Technologies Used

-   [Next.js 15](https://nextjs.org/)
-   [React](https://react.dev/)
-   [Tailwind CSS](https://tailwindcss.com/)
-   [TypeScript](https://www.typescriptlang.org/)
-   [MQTT.js](https://github.com/mqttjs/MQTT.js)
-   [Tasmota](https://tasmota.github.io/docs/) (Device Firmware)

## Setup

### 1. Prerequisites

-   Node.js (v18 or later recommended)
-   npm, yarn, or pnpm
-   An MQTT Broker (e.g., Mosquitto) running on your network.
-   Tasmota-flashed WiFi lights configured to connect to your MQTT broker.

### 2. Installation

Clone the repository and install dependencies:

```bash
# Clone the repository (replace with your actual repo URL if needed)
git clone <your-repository-url>
cd wifi-lights # Or your project directory name

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

### 3. MQTT Broker Setup

This application requires an MQTT broker to communicate with the lights. 

-   **Installation:** If you don't have one, you can install [Mosquitto](https://mosquitto.org/download/). For Docker users:
    ```bash
    docker run -it -p 1883:1883 -p 9001:9001 --name mosquitto eclipse-mosquitto mosquitto -c /mosquitto-no-auth.conf
    ```
    (This runs Mosquitto without authentication. For production, configure authentication.)
-   **Configuration:** Ensure your Tasmota devices are configured with the IP address and port (usually 1883) of your MQTT broker. If your broker requires authentication, note the username and password.

### 4. Application Configuration

Create a `.env.local` file in the project root directory to store your MQTT broker details:

```dotenv
# .env.local

# Required: URL of your MQTT broker
MQTT_BROKER_URL=mqtt://YOUR_BROKER_IP:1883 

# Optional: Credentials if your broker requires authentication
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password
```

Replace `YOUR_BROKER_IP` with the actual IP address of your MQTT broker. Add username/password if needed.

### 5. Device Configuration (`devices.json`)

Create a `devices.json` file in the project root. This file maps your application's internal device IDs to the device IP addresses. The application uses the **last octet** of the IP address to derive the default Tasmota MQTT topic (e.g., `10.0.0.21` becomes `spot_21`).

**Important:** Ensure the MQTT topic used by your Tasmota devices matches the pattern `spot_XXX`, where `XXX` is the last octet of the device's IP address. You might need to configure the "Topic" setting in Tasmota (use `%chipid%` or `%hostname%` if they result in the correct suffix, or set it manually).

Example `devices.json`:

```json
[
  {
    "id": "living_room_spot_1",
    "ip": "10.0.0.21",
    "last_status": {}
  },
  {
    "id": "kitchen_spot_1",
    "ip": "10.0.0.22",
    "last_status": { "power": "OFF" }
  },
  {
    "id": "office_spot",
    "ip": "10.0.0.35",
    "last_status": {}
  }
]
```

-   `id`: A unique identifier you choose for the light within this application.
-   `ip`: The current IP address of the Tasmota device.
-   `last_status`: Leave as `{}` initially. The application will populate this automatically as it receives status updates via MQTT.

## Project Structure Overview

-   `app/`: Next.js App Router pages (UI).
-   `components/`: React components used in the UI.
-   `lib/`:
    -   `devices.ts`: Handles loading, caching, and updating `devices.json`.
    -   `mqtt.ts`: Manages MQTT connection, subscriptions, and publishing.
    -   `tasmota.ts`: Parses incoming Tasmota status messages from MQTT.
    -   `utils.ts`: General utility functions (e.g., color conversion).
    -   `lights.ts`: Main API layer coordinating the other modules and exposing control functions.
-   `public/`: Static assets.
-   `styles/`: Global styles and Tailwind configuration.
-   `devices.json`: Your device definitions (you create this).
-   `.env.local`: Your MQTT broker configuration (you create this).

## Running the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or your configured port) in your browser.

## Building for Production

```bash
npm run build
npm run start
```

## Linting

```bash
npm run lint
```

## License

Licensed under the [MIT license](LICENSE).
