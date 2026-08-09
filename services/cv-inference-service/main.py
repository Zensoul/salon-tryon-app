import io
import base64
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python import vision as mp_vision
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title="CV Inference Service")

# Load the face landmarker model once at startup, reused across requests.
base_options = mp_python.BaseOptions(model_asset_path="models/face_landmarker.task")
options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    output_face_blendshapes=False,
    output_facial_transformation_matrixes=False,
    num_faces=1,
)
landmarker = vision.FaceLandmarker.create_from_options(options)

# Multiclass segmenter: identifies hair, face-skin, body-skin, clothes,
# and background as separate categories in one pass.
segmenter_options = mp_vision.ImageSegmenterOptions(
    base_options=mp_python.BaseOptions(model_asset_path="models/selfie_multiclass.tflite"),
    output_category_mask=True,
)
segmenter = mp_vision.ImageSegmenter.create_from_options(segmenter_options)

# Category index 1 = hair, per this model's label map.
HAIR_CATEGORY_INDEX = 1


def classify_face_shape(landmarks, image_width: int, image_height: int) -> str:
    """
    Simple heuristic face-shape classifier based on key landmark ratios.
    Real production version: replace with a trained classifier once we
    have labeled data, but this gives genuinely reasonable results using
    actual measured geometry (not random, unlike the mock).
    """
    top = landmarks[10]      # forehead top
    bottom = landmarks[152]  # chin bottom
    left = landmarks[234]    # left cheek
    right = landmarks[454]   # right cheek
    jaw_left = landmarks[172]
    jaw_right = landmarks[397]

    face_height = abs(bottom.y - top.y) * image_height
    face_width = abs(right.x - left.x) * image_width
    jaw_width = abs(jaw_right.x - jaw_left.x) * image_width

    ratio = face_height / face_width if face_width > 0 else 1.0
    jaw_ratio = jaw_width / face_width if face_width > 0 else 1.0

    if ratio > 1.5:
        return "oblong"
    elif ratio < 1.15 and jaw_ratio > 0.9:
        return "round"
    elif jaw_ratio > 0.95:
        return "square"
    elif jaw_ratio < 0.75:
        return "heart"
    elif ratio > 1.3:
        return "oval"
    else:
        return "diamond"


def analyze_skin_tone(image_np, landmarks, image_width: int, image_height: int) -> dict:
    """
    Samples actual pixel colors from forehead and cheek regions (using
    real landmark positions) and estimates undertone from the color data.
    """
    sample_indices = [10, 234, 454]
    samples = []

    for idx in sample_indices:
        lm = landmarks[idx]
        px = int(lm.x * image_width)
        py = int(lm.y * image_height)
        x0, x1 = max(0, px - 2), min(image_width, px + 3)
        y0, y1 = max(0, py - 2), min(image_height, py + 3)
        region = image_np[y0:y1, x0:x1]
        if region.size > 0:
            avg_color = region.reshape(-1, 3).mean(axis=0)
            samples.append(avg_color)

    if not samples:
        return {"hex": "#C68863", "undertone": "neutral"}

    avg = np.mean(samples, axis=0)
    r, g, b = avg[0], avg[1], avg[2]

    hex_color = "#{:02x}{:02x}{:02x}".format(int(r), int(g), int(b))

    warmth_score = (r + g) - (2 * b)
    if warmth_score > 30:
        undertone = "warm"
    elif warmth_score < 10:
        undertone = "cool"
    else:
        undertone = "neutral"

    return {"hex": hex_color, "undertone": undertone}


def recolor_hair(image_np, hair_mask, target_hex: str):
    """
    High-quality hair recoloring:
    - Feathers mask edges (Gaussian blur) for soft, natural transitions
    - Blends in LAB color space (perceptually accurate, separates
      lightness from color better than HSV)
    - Alpha-weighted blend preserves original luminance/texture entirely
      while shifting color proportionally at the edges
    """
    target_hex = target_hex.lstrip("#")
    target_rgb = np.array([
        int(target_hex[0:2], 16),
        int(target_hex[2:4], 16),
        int(target_hex[4:6], 16),
    ], dtype=np.uint8)

    # Convert target color to LAB
    target_bgr = np.array([[target_rgb[::-1]]], dtype=np.uint8)
    target_lab = cv2.cvtColor(target_bgr, cv2.COLOR_BGR2LAB)[0][0].astype(np.float32)
    target_a, target_b = target_lab[1], target_lab[2]

    # Feather the mask: blur creates a soft 0-255 gradient at edges
    # instead of a hard binary cutoff.
    feathered = cv2.GaussianBlur(hair_mask, (15, 15), 0)
    alpha = (feathered.astype(np.float32) / 255.0)[:, :, np.newaxis]  # shape (H, W, 1)

    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    image_lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    # Blend only the a/b (color) channels toward the target; L (lightness)
    # channel is left completely untouched, preserving all texture/shading.
    l_channel = image_lab[:, :, 0:1]
    a_channel = image_lab[:, :, 1:2]
    b_channel = image_lab[:, :, 2:3]

    blended_a = a_channel * (1 - alpha) + target_a * alpha
    blended_b = b_channel * (1 - alpha) + target_b * alpha

    result_lab = np.concatenate([l_channel, blended_a, blended_b], axis=2)
    result_lab = np.clip(result_lab, 0, 255).astype(np.uint8)

    result_bgr = cv2.cvtColor(result_lab, cv2.COLOR_LAB2BGR)
    result_rgb = cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB)

    return result_rgb


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cv-inference-service"}


@app.post("/detect-landmarks")
async def detect_landmarks(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_np = np.array(image)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_np)

    result = landmarker.detect(mp_image)

    if not result.face_landmarks:
        raise HTTPException(status_code=422, detail="No face detected in image")

    landmarks = result.face_landmarks[0]
    height, width = image_np.shape[0], image_np.shape[1]

    face_shape = classify_face_shape(landmarks, width, height)

    xs = [lm.x for lm in landmarks]
    ys = [lm.y for lm in landmarks]
    bounding_box = {
        "x": min(xs),
        "y": min(ys),
        "width": max(xs) - min(xs),
        "height": max(ys) - min(ys),
    }

    return JSONResponse({
        "points": [{"x": lm.x, "y": lm.y} for lm in landmarks],
        "boundingBox": bounding_box,
        "faceShape": face_shape,
    })


@app.post("/segment-hair")
async def segment_hair(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_np = np.array(image)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_np)

    result = segmenter.segment(mp_image)
    category_mask = result.category_mask.numpy_view()

    hair_mask = np.where(category_mask == HAIR_CATEGORY_INDEX, 255, 0).astype(np.uint8)

    success, encoded = cv2.imencode(".png", hair_mask)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode hair mask")

    mask_b64 = base64.b64encode(encoded.tobytes()).decode("utf-8")

    height, width = hair_mask.shape
    return JSONResponse({
        "maskBase64": mask_b64,
        "width": width,
        "height": height,
    })


@app.post("/analyze-skin-tone")
async def analyze_skin_tone_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_np = np.array(image)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_np)

    result = landmarker.detect(mp_image)
    if not result.face_landmarks:
        raise HTTPException(status_code=422, detail="No face detected in image")

    landmarks = result.face_landmarks[0]
    height, width = image_np.shape[0], image_np.shape[1]

    skin_tone = analyze_skin_tone(image_np, landmarks, width, height)
    return JSONResponse(skin_tone)


@app.post("/render-hair-color")
async def render_hair_color(file: UploadFile = File(...), target_color: str = "#B87333"):
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_np = np.array(image)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_np)

    result = segmenter.segment(mp_image)
    category_mask = result.category_mask.numpy_view()
    hair_mask = np.where(category_mask == HAIR_CATEGORY_INDEX, 255, 0).astype(np.uint8)

    rendered = recolor_hair(image_np, hair_mask, target_color)

    success, encoded = cv2.imencode(".jpg", cv2.cvtColor(rendered, cv2.COLOR_RGB2BGR))
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode rendered image")

    rendered_b64 = base64.b64encode(encoded.tobytes()).decode("utf-8")

    return JSONResponse({
        "renderedImageBase64": rendered_b64,
        "format": "jpg",
    })