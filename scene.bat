# set_scene.bat
# Test script to verify argument passing
# $1: Target Hex Color (e.g., FF0000)
# $2: Target Brightness (Dimmer, e.g., 80)

sendGet 10.0.0.195:3000 "Executing set_scene.bat with Args: Color=$1 Dimmer=$2"

# Use Backlog to send commands sequentially
backlog Color $1; Dimmer $2