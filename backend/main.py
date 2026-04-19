import asyncio
import json
import logging
import math
from fastapi.responses import JSONResponse


import cv2
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
face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml')


class OfferRequest(BaseModel):
	sdp: str
	type: str


def infer_tilt_from_frame(frame_bgr, prev_relative_offset, baseline_offset):
	frame_h, frame_w = frame_bgr.shape[:2]
	target_w = 320
	scale = target_w / frame_w
	resized = cv2.resize(frame_bgr, (target_w, int(frame_h * scale)), interpolation=cv2.INTER_LINEAR)

	gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
	faces = face_detector.detectMultiScale(
		gray,
		scaleFactor=1.15,
		minNeighbors=4,
		minSize=(48, 48),
	)

	if len(faces) == 0:
		return 'center', prev_relative_offset * 0.92, baseline_offset, 0.0

	x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
	face_center_x = x + (w / 2.0)
	frame_center_x = resized.shape[1] / 2.0
	raw_offset = (face_center_x - frame_center_x) / frame_center_x

	face_roi_gray = gray[y:y + h, x:x + w]
	eyes = eye_detector.detectMultiScale(
		face_roi_gray,
		scaleFactor=1.12,
		minNeighbors=6,
		minSize=(14, 14),
	)

	eye_roll_norm = 0.0
	if len(eyes) >= 2:
		eye_boxes = sorted(eyes, key=lambda e: e[2] * e[3], reverse=True)[:4]
		eye_centers = []
		for ex, ey, ew, eh in eye_boxes:
			eye_centers.append((ex + ew / 2.0, ey + eh / 2.0))

		# Choose the pair with the largest horizontal separation.
		best_pair = None
		best_dx = 0.0
		for i in range(len(eye_centers)):
			for j in range(i + 1, len(eye_centers)):
				dx = abs(eye_centers[j][0] - eye_centers[i][0])
				if dx > best_dx:
					best_dx = dx
					best_pair = (eye_centers[i], eye_centers[j])

		if best_pair and best_dx > 6:
			left_eye, right_eye = sorted(best_pair, key=lambda p: p[0])
			dy = right_eye[1] - left_eye[1]
			dx = right_eye[0] - left_eye[0]
			roll_deg = math.degrees(math.atan2(dy, dx))
			eye_roll_norm = max(-1.0, min(1.0, roll_deg / 16.0))

	if baseline_offset is None:
		baseline_offset = raw_offset

	# Calibrate to user's neutral position to avoid one-sided bias from camera angle.
	relative_offset = raw_offset - baseline_offset
	fused_offset = (0.82 * relative_offset) + (0.55 * eye_roll_norm)
	smoothed_relative_offset = (0.35 * prev_relative_offset) + (0.65 * fused_offset)

	threshold = 0.028
	hysteresis = 0.005

	if smoothed_relative_offset > (threshold + hysteresis):
		direction = 'right'
	elif smoothed_relative_offset < -(threshold + hysteresis):
		direction = 'left'
	else:
		direction = 'center'

	if abs(smoothed_relative_offset) < threshold:
		# Tiny baseline correction to compensate long-term camera drift.
		baseline_offset = (0.998 * baseline_offset) + (0.002 * raw_offset)

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

		should_send = True

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
