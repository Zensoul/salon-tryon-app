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
    # Key landmark indices (MediaPipe 468-point face mesh)
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

    # Build a binary mask: 255 where hair is detected, 0 elsewhere.
    hair_mask = np.where(category_mask == HAIR_CATEGORY_INDEX, 255, 0).astype(np.uint8)

    # Encode as PNG and return as base64 so tryon-engine can save/use it
    # without a shared filesystem between services.
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