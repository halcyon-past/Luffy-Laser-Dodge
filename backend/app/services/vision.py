import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
import os
from app.core.config import logger

cv2.setUseOptimized(True)
cv2.setNumThreads(2)

# Setup MediaPipe Face Detector
model_path = os.path.join(os.path.dirname(__file__), '../../models/blaze_face_short_range.tflite')
base_options = mp_python.BaseOptions(model_asset_path=model_path)
options = mp_vision.FaceDetectorOptions(base_options=base_options, min_detection_confidence=0.5)
face_detector = mp_vision.FaceDetector.create_from_options(options)

def infer_tilt_from_frame(frame_bgr, prev_relative_offset, baseline_offset):
    frame_h, frame_w = frame_bgr.shape[:2]
    target_w = 480
    if frame_w > target_w:
        scale = target_w / frame_w
        frame_bgr = cv2.resize(frame_bgr, (target_w, int(frame_h * scale)), interpolation=cv2.INTER_LINEAR)
        frame_h, frame_w = frame_bgr.shape[:2]

    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    
    results = face_detector.detect(mp_image)

    if not results.detections:
        return 'center', prev_relative_offset * 0.8, baseline_offset, 0.0

    best_detection = max(results.detections, key=lambda d: d.bounding_box.width * d.bounding_box.height)
    bbox = best_detection.bounding_box

    face_center_x = bbox.origin_x + (bbox.width / 2.0)
    raw_offset = ((face_center_x / frame_w) - 0.5) * 2.0

    if baseline_offset is None:
        baseline_offset = raw_offset

    relative_offset = raw_offset - baseline_offset
    smoothed_relative_offset = (0.5 * prev_relative_offset) + (0.5 * relative_offset)

    threshold = 0.12
    hysteresis = 0.03

    if smoothed_relative_offset > (threshold + hysteresis):
        direction = 'right'
    elif smoothed_relative_offset < -(threshold + hysteresis):
        direction = 'left'
    else:
        direction = 'center'

    if abs(smoothed_relative_offset) < threshold:
        baseline_offset = (0.99 * baseline_offset) + (0.01 * raw_offset)

    return direction, smoothed_relative_offset, baseline_offset, raw_offset
