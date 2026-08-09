import json
import base64

with open("../../hair-mask-response.json", "r") as f:
    data = json.load(f)

mask_bytes = base64.b64decode(data["maskBase64"])
with open("../../hair-mask-preview.png", "wb") as f:
    f.write(mask_bytes)

print(f"Saved mask: {data['width']}x{data['height']}")