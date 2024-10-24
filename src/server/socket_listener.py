import socket

LISTEN_IP = '10.0.0.43'  # Listen on all available interfaces
LISTEN_PORT = 5002

ESP32_IP = '10.0.0.40'

# Socket server to listen to ESP32 events
def socket_listener():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # Reuse the address
        server_socket.bind((LISTEN_IP, LISTEN_PORT))
        server_socket.listen()
        print(f"Socket server listening on {LISTEN_IP}:{LISTEN_PORT}")

        while True:
            client_socket, client_address = server_socket.accept()
            with client_socket:
                print(f"Connected by {client_address}")
                while True:
                    data = client_socket.recv(1024)
                    if not data:
                        break
                    print(f"Received data from {ESP32_IP}: {data.decode()}")
                    # React to incoming data here if needed
                    # For example, parse the message and perform an action

if __name__ == "__main__":
    socket_listener()
