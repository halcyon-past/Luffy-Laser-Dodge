import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.contrib.media import MediaRelay
from app.services.webrtc import process_video_track
from app.core.config import logger

router = APIRouter()

class OfferRequest(BaseModel):
    sdp: str
    type: str

pcs = set()
relay = MediaRelay()

@router.get('/health')
async def health_check():
    return JSONResponse({'status': 'ok'})

@router.post('/offer')
async def offer(payload: OfferRequest):
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
        state['data_channel'] = channel

    async def send_tilt(direction, lean):
        channel = state['data_channel']
        if not channel or channel.readyState != 'open':
            return False

        channel.send(
            json.dumps({
                'type': 'head_tilt',
                'direction': direction,
                'lean': round(float(lean), 4),
            })
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

async def close_all_connections():
    coros = [pc.close() for pc in pcs]
    if coros:
        await asyncio.gather(*coros)
    pcs.clear()
