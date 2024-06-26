WORKING_DIR=/home/gwendal/wifi-lights
SERVICE_NAME=wifi-lights.service
SERVICE_FILE=/etc/systemd/system/$(SERVICE_NAME)
PYTHON_SCRIPT=$(WORKING_DIR)/src/scripts/running/switch_status_watcher.py
SCAN_COMMAND="python3 -m tinytuya scan"


all: install

install: install-dependencies create-service enable-service 

install-dependencies:
	@echo "installing dependencies..."
	python3 -m venv /home/gwendal/wifi-lights/venv
	@/home/gwendal/wifi-lights/venv/bin/pip install -r /home/gwendal/wifi-lights/requirements.txt

create-service:
	@echo "Creating systemd service file..."
	@sudo cp $(WORKING_DIR)/wifi-lights.service $(SERVICE_FILE)
	@sudo systemctl daemon-reload
	@echo "Service file created at $(SERVICE_FILE)"

enable-service:
	@echo "Enabling and starting the service..."
	@sudo systemctl enable $(SERVICE_NAME)
	@sudo systemctl start $(SERVICE_NAME)
	@echo "Service $(SERVICE_NAME) enabled and started."

uninstall:
	@echo "Stopping and disabling the service..."
	@sudo systemctl stop $(SERVICE_NAME)
	@sudo systemctl disable $(SERVICE_NAME)
	@echo "Removing service file..."
	@sudo rm -f $(SERVICE_FILE)
	@sudo systemctl daemon-reload
	@echo "Service $(SERVICE_NAME) uninstalled."

status:
	@sudo systemctl status $(SERVICE_NAME)

restart:
	@sudo systemctl restart $(SERVICE_NAME)

clean:
	@sudo systemctl stop $(SERVICE_NAME)
	@sudo systemctl disable $(SERVICE_NAME)
	@sudo rm -f $(SERVICE_FILE)
	@sudo systemctl daemon-reload
	@echo "Service $(SERVICE_NAME) cleaned."
