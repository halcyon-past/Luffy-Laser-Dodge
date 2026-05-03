import asyncio
import json
import logging
import math
import os
from fastapi.responses import JSONResponse


import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.contrib.media import MediaRelay
from aiortc.mediastreams import MediaStreamError
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('luffy-vision')

cv2.setUseOptimized(True)
cv2.setNumThreads(2)

app = FastAPI(title='Luffy Laser Dodge Vision Backend')

app.add_middleware(
	CORSMiddleware,
	allow_origins=['*'],
	allow_methods=['*'],
	allow_headers=['*'],
)

@app.get('/health')
async def health_check():
		return JSONResponse({'status': 'ok'})

pcs = set()
relay = MediaRelay()

# Setup MediaPipe Face Detector
model_path = os.path.join(os.path.dirname(__file__), 'blaze_face_short_range.tflite')
base_options = mp_python.BaseOptions(model_asset_path=model_path)
options = mp_vision.FaceDetectorOptions(base_options=base_options, min_detection_confidence=0.5)
face_detector = mp_vision.FaceDetector.create_from_options(options)


class OfferRequest(BaseModel):
	sdp: str
	type: str


def infer_tilt_from_frame(frame_bgr, prev_relative_offset, baseline_offset):
	# Resize if needed for performance, but MediaPipe is fast enough
	# Let's keep a standard resolution to ensure consistent speeds
	frame_h, frame_w = frame_bgr.shape[:2]
	target_w = 480
	if frame_w > target_w:
		scale = target_w / frame_w
		frame_bgr = cv2.resize(frame_bgr, (target_w, int(frame_h * scale)), interpolation=cv2.INTER_LINEAR)
		# Update dimensions after resize
		frame_h, frame_w = frame_bgr.shape[:2]

	frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
	mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
	
	results = face_detector.detect(mp_image)

	if not results.detections:
		return 'center', prev_relative_offset * 0.8, baseline_offset, 0.0

	# Get largest face if multiple
	best_detection = max(results.detections, key=lambda d: d.bounding_box.width * d.bounding_box.height)
	bbox = best_detection.bounding_box

	face_center_x = bbox.origin_x + (bbox.width / 2.0)
	
	# map 0..1 to -1..1 where 0 is center
	raw_offset = ((face_center_x / frame_w) - 0.5) * 2.0

	if baseline_offset is None:
		baseline_offset = raw_offset

	# Calibrate to user's neutral position
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
		# Tiny baseline correction to compensate long-term camera drift.
		baseline_offset = (0.99 * baseline_offset) + (0.01 * raw_offset)

	return direction, smoothed_relative_offset, baseline_offset, raw_offset


async def process_video_track(track, send_tilt):
	last_direction = 'center'
	relative_offset = 0.0
	last_sent_offset = 0.0
	baseline_offset = None
	frame_count = 0

	while True:
		try:
			frame = await track.recv()
		except MediaStreamError:
			break
		except Exception:
			break

		frame_bgr = frame.to_ndarray(format='bgr24')
		direction, relative_offset, baseline_offset, raw_offset = infer_tilt_from_frame(
			frame_bgr,
			relative_offset,
			baseline_offset,
		)
		frame_count += 1

		# Avoid spamming the frontend: only send when direction changes, or if the lean value changed significantly
		should_send = (direction != last_direction) or (abs(relative_offset - last_sent_offset) > 0.05)

		if should_send:
			sent = await send_tilt(direction, relative_offset)
			if sent:
				if direction in {'left', 'right'} and direction != last_direction:
					logger.info(
						'Head movement detected and sent: %s (raw=%.3f baseline=%.3f relative=%.3f)',
						direction,
						raw_offset,
						baseline_offset if baseline_offset is not None else 0.0,
						relative_offset,
					)
					print(
						f"[vision] DETECTED {direction.upper()} | raw={raw_offset:.3f} baseline={(baseline_offset if baseline_offset is not None else 0.0):.3f} relative={relative_offset:.3f}",
						flush=True,
					)
				last_direction = direction
				last_sent_offset = relative_offset

		# Lightweight heartbeat so it's obvious detection loop is alive.
		if frame_count % 120 == 0:
			print(
				f"[vision] heartbeat direction={direction} relative={relative_offset:.3f}",
				flush=True,
			)


@app.get('/health')
async def health_check():
	return {'status': 'ok'}



@app.post('/offer')
async def offer(payload: OfferRequest):
	# Use public Google STUN server for ICE
	ice_servers = [RTCIceServer(urls=['stun:stun.l.google.com:19302'])]
	config = RTCConfiguration(iceServers=ice_servers)
	pc = RTCPeerConnection(configuration=config)
	pcs.add(pc)

	state = {
		'data_channel': None,
		'tasks': [],
	}

	@pc.on('connectionstatechange')
	async def on_connectionstatechange():
		logger.info('Peer connection state: %s', pc.connectionState)
		if pc.connectionState in {'failed', 'closed', 'disconnected'}:
			for task in state['tasks']:
				task.cancel()
			await pc.close()
			pcs.discard(pc)

	@pc.on('datachannel')
	def on_datachannel(channel):
		logger.info('Data channel opened: %s', channel.label)
		print(f"[vision] data channel opened: {channel.label}", flush=True)
		state['data_channel'] = channel

	async def send_tilt(direction, lean):
		channel = state['data_channel']
		if not channel or channel.readyState != 'open':
			if direction in {'left', 'right'}:
				print('[vision] movement detected but data channel not open yet', flush=True)
			return False

		channel.send(
			json.dumps(
				{
					'type': 'head_tilt',
					'direction': direction,
					'lean': round(float(lean), 4),
				}
			)
		)

		return True

	@pc.on('track')
	def on_track(track):
		if track.kind != 'video':
			return

		subscribed = relay.subscribe(track, buffered=False)
		task = asyncio.create_task(process_video_track(subscribed, send_tilt))
		state['tasks'].append(task)

		@track.on('ended')
		async def on_ended():
			task.cancel()

	await pc.setRemoteDescription(RTCSessionDescription(sdp=payload.sdp, type=payload.type))
	answer = await pc.createAnswer()
	await pc.setLocalDescription(answer)

	return {'sdp': pc.localDescription.sdp, 'type': pc.localDescription.type}


@app.on_event('shutdown')
async def on_shutdown():
	coros = [pc.close() for pc in pcs]
	if coros:
		await asyncio.gather(*coros)
	pcs.clear()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
