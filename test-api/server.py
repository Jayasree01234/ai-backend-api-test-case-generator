from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import re


USERS = [
    {"id": 1, "name": "John"},
    {"id": 2, "name": "Jane"},
]


class Handler(BaseHTTPRequestHandler):

    def send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()

        self.wfile.write(body)

    def read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))

            if content_length == 0:
                return None

            body = self.rfile.read(content_length)
            return json.loads(body.decode("utf-8"))

        except (ValueError, json.JSONDecodeError):
            return None

    def do_GET(self):

        # GET /users
        if self.path == "/users":
            self.send_json(
                200,
                {
                    "users": USERS
                }
            )
            return

        # GET /users/{id}
        match = re.fullmatch(r"/users/([^/]+)", self.path)

        if match:
            user_id = match.group(1)

            # Invalid ID format
            if not user_id.isdigit():
                self.send_json(
                    404,
                    {
                        "error": "User not found"
                    }
                )
                return

            user_id = int(user_id)

            for user in USERS:
                if user["id"] == user_id:
                    self.send_json(200, user)
                    return

            # ID does not exist
            self.send_json(
                404,
                {
                    "error": "User not found"
                }
            )
            return

        # Unknown endpoint
        self.send_json(
            404,
            {
                "error": "Not found"
            }
        )

    def do_POST(self):

        # POST /users
        if self.path == "/users":

            data = self.read_json_body()

            # Invalid JSON/body
            if not isinstance(data, dict):
                self.send_json(
                    400,
                    {
                        "error": "Invalid request body"
                    }
                )
                return

            # Required fields
            required_fields = ["name", "email", "age"]

            for field in required_fields:
                if field not in data:
                    self.send_json(
                        400,
                        {
                            "error": f"Missing required field: {field}"
                        }
                    )
                    return

            # Validate name
            if not isinstance(data["name"], str):
                self.send_json(
                    400,
                    {
                        "error": "Name must be a string"
                    }
                )
                return

            # Validate email
            if (
                not isinstance(data["email"], str)
                or "@" not in data["email"]
                or "." not in data["email"]
            ):
                self.send_json(
                    400,
                    {
                        "error": "Invalid email"
                    }
                )
                return

            # Validate age
            if not isinstance(data["age"], int) or isinstance(data["age"], bool):
                self.send_json(
                    400,
                    {
                        "error": "Age must be an integer"
                    }
                )
                return

            # Create user
            new_user = {
                "id": len(USERS) + 1,
                "name": data["name"],
                "email": data["email"],
                "age": data["age"],
            }

            USERS.append(new_user)

            self.send_json(
                201,
                new_user
            )
            return

        # Unknown endpoint
        self.send_json(
            404,
            {
                "error": "Not found"
            }
        )

    def log_message(self, format, *args):
        print(f"{self.command} {self.path} -> {args[1]}")


server = HTTPServer(("localhost", 8080), Handler)

print("Test API running at http://localhost:8080")

server.serve_forever()