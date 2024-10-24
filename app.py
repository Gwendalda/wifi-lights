from src.core.send import send_post_request, send_get_request
from src.server.server import app


if __name__ == '__main__':
    app.run(host='10.0.0.43', port=5000)