import json
import base64

with open("../../lip-render-response.json", "r") as f:
    data = json.load(f)

image_bytes = base64.b64decode(data["renderedImageBase64"])
with open("../../lip-preview.jpg", "wb") as f:
    f.write(image_bytes)

print("Saved lip-preview.jpg")