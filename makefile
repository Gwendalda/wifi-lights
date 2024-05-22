SERVICE_NAME=wifi-lights.service
SERVICE_FILE=/etc/systemd/system/$(SERVICE_NAME)
PYTHON_SCRIPT=./src/scripts/running/switch_status_watcher.py
SCAN_COMMAND="python3 -m tinytuya scan"
WORKING_DIR=$(HOME)/wifi-lights

all: install

install: create-service enable-service

create-service:
	@echo "Creating systemd service file..."
	@sudo bash -c "printf '%s\n' '\
[Unit]\n\
Description=WiFi Lights Service\n\
After=network.target\n\
\n\
[Service]\n\
User=$(USER)\n\
WorkingDirectory=$(WORKING_DIR)\n\
ExecStart=/usr/bin/python3 $(PYTHON_SCRIPT)\n\
Restart=on-failure\n\
RestartSec=5\n\
ExecStartPre=/usr/bin/python3 -m pip install -r $(WORKING_DIR)/requirements.txt\n\
ExecStartPost=/usr/bin/bash -c \"[[ \$$? -ne 0 ]] && $(SCAN_COMMAND) && sudo systemctl restart $(SERVICE_NAME)\"\n\
\n\
[Install]\n\
WantedBy=multi-user.target\n\
' > $(SERVICE_FILE)"
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
