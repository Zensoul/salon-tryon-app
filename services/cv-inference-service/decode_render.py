import json
import base64

with open("../../render-response.json", "r") as f:
    data = json.load(f)

image_bytes = base64.b64decode(data["renderedImageBase64"])
with open("../../rendered-preview.jpg", "wb") as f:
    f.write(image_bytes)

print("Saved rendered-preview.jpg")