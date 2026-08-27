from fastapi import FastAPI, File, UploadFile
from ultralytics import YOLO
from pathlib import Path
import shutil
import uuid

app = FastAPI()


# ============================================
# PATHS
# ============================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "best.pt"

TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


# ============================================
# SINHALA LABEL MAP
# ============================================

LABEL_MAP = {
    "sinhala_ak": "අ",
    "sinhala_ba": "බ",
    "sinhala_dha": "ද",
    "sinhala_ga": "ග",
    "sinhala_ha": "හ",
    "sinhala_i": "ඉ",
    "sinhala_ka": "ක",
    "sinhala_la": "ල",
    "sinhala_ma": "ම",
    "sinhala_na": "න",
    "sinhala_pa": "ප",
    "sinhala_ra": "ර",
    "sinhala_sa": "ස",
    "sinhala_ta": "ට",
    "sinhala_tha": "ත",
    "sinhala_u": "උ",
    "sinhala_ya": "ය",
}


# ============================================
# LOAD YOLO MODEL
# ============================================

print("Starting Sinhala handwriting model...")
print(f"Model path: {MODEL_PATH}")

model = YOLO(str(MODEL_PATH))

print("Sinhala handwriting model loaded successfully.")
print("Model classes:", model.names)


# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
async def health():

    return {
        "success": True,
        "message": "Sinhala handwriting model is running"
    }


# ============================================
# PREDICTION
# ============================================

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    file_path = TEMP_DIR / f"{uuid.uuid4()}.jpg"

    try:

        # Save uploaded image
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # YOLO prediction
        results = model(str(file_path))

        candidates = []

        for result in results:

            if result.boxes is None:
                continue

            for box in result.boxes:

                class_id = int(box.cls[0])
                confidence = float(box.conf[0])

                class_name = model.names[class_id]

                sinhala_letter = LABEL_MAP.get(
                    class_name,
                    class_name
                )

                candidates.append({
                    "label": class_name,
                    "sinhala": sinhala_letter,
                    "confidence": confidence
                })

        # Highest confidence first
        candidates.sort(
            key=lambda x: x["confidence"],
            reverse=True
        )

        # Nothing detected
        if not candidates:

            return {
                "success": False,
                "label": "",
                "sinhala": "",
                "confidence": 0,
                "candidates": []
            }

        best = candidates[0]

        print(
            f"Prediction: {best['label']} "
            f"-> {best['sinhala']} "
            f"({best['confidence']:.4f})"
        )

        return {
            "success": True,

            # Original YOLO class
            "label": best["label"],

            # Sinhala character
            "sinhala": best["sinhala"],

            # Confidence
            "confidence": best["confidence"],

            # All candidates
            "candidates": candidates
        }

    finally:

        # Remove temporary image
        if file_path.exists():
            file_path.unlink()