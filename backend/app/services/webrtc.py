import asyncio
import json
from aiortc.mediastreams import MediaStreamError
from app.core.config import logger
from app.services.vision import infer_tilt_from_frame

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

        if frame_count % 120 == 0:
            print(
                f"[vision] heartbeat direction={direction} relative={relative_offset:.3f}",
                flush=True,
            )
