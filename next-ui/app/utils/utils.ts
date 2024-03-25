import {updateRemotePeerConnections} from "@/utils/socketNetworkHandlers";
import React from "react";

const serverURL = 'http://127.0.0.1:5000/'

export const createRoom = async (roomName: string): Promise<{ roomId: string; roomName: string } | null> => {
  try {
    const response = await fetch(`${serverURL}create_room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'room_name': roomName,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to create room');
    }

    const data = await response.json();
    const roomId = data.room_id;
    const createdRoomName = data.room_name;
    return { roomId, roomName: createdRoomName };
  } catch (error) {
    console.error('Error creating room:', error);
    return null;
  }
};


export const getLanguagesArray = async () => {
    const response = await fetch(`${serverURL}/languages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }})
    if (!response.ok) {
      throw new Error('Failed to load languages list');
    }

    const data = await response.json();
    return data.names.map((obj: {}) => Object.keys(obj)[0])
}

export const decode = (value: string | null | string[]) => {
  if (Array.isArray(value)) {
    return '';
  }
  return value ? decodeURIComponent(value) : '';
};

export function makeVideoElement(elementId: string, displayName: string): HTMLDivElement {
  const wrapperDiv = document.createElement("div");
  const vidWrapper = document.createElement("div");
  const vid = document.createElement("video");
  const nameText = document.createElement("h1");
  vid.volume = 0.05
  wrapperDiv.id = `div_${elementId}`;
  vid.id = `vid_${elementId}`;
  vid.className = "remoteVideo rounded-lg shadow-md border border-gray-300 transition-shadow duration-500 ease-in-out";
  wrapperDiv.className = "remoteVideo video-item";
  vidWrapper.className = "vid-wrapper";
  vidWrapper.id = `vidwr_${elementId}`;
  nameText.className = "display-name";
  wrapperDiv.style.backgroundColor = "rgba(102, 177, 244, 0)";
  vidWrapper.style.backgroundColor = "rgba(255, 255, 255, 0)";
  vid.autoplay = true;
  nameText.innerText = displayName;

  vidWrapper.appendChild(vid);
  wrapperDiv.appendChild(vidWrapper);
  wrapperDiv.appendChild(nameText);

  return wrapperDiv;
}

export function addVideoElement(elementId: string, displayName: string): void {
  removeVideoElement(elementId);
  const videoGrid = document.getElementById("video_grid");
  if (videoGrid) {
    videoGrid.appendChild(makeVideoElement(elementId, displayName));
    // getParticipantsWithOtherLanguages();
  } else {
    console.log('No Video Grid')
  }
}

export function removeVideoElement(elementId: string): void {
  const div = document.getElementById(`div_${elementId}`);
  if (!div) {
    console.log("Video element not found");
    return;
  }

  const vid = getVideoObj(elementId);
  if (vid) {
    if (vid.srcObject) {
      const tracks = (vid.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
    vid.removeAttribute("srcObject");
    vid.removeAttribute("src");
  }

  div.remove();
}

export function getVideoObj(elementId: string): HTMLVideoElement | null {
  const videoObj = document.getElementById(`vid_${elementId}`) as HTMLVideoElement | null;
  if (videoObj) {
    return videoObj
  }
  console.log('No videoObj vid_' + elementId)
  return null
}

export const dragAndDrop = (element: any) => {
    const elementContainer = element.current;
    if (elementContainer) {
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragStartLeft = 0;
      let dragStartTop = 0;

      const handleDragStart = (event: MouseEvent) => {
        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        dragStartLeft = elementContainer.offsetLeft;
        dragStartTop = elementContainer.offsetTop;
      };

      const handleDragMove = (event: MouseEvent) => {
        if (!isDragging) return;
        const deltaX = event.clientX - dragStartX;
        const deltaY = event.clientY - dragStartY;
        elementContainer.style.left = `${dragStartLeft + deltaX}px`;
        elementContainer.style.top = `${dragStartTop + deltaY}px`;
      };

      const handleDragEnd = () => {
        isDragging = false;
      };

      elementContainer.addEventListener('mousedown', handleDragStart);
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);

      return () => {
        elementContainer.removeEventListener('mousedown', handleDragStart);
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
}


export const setAudioMuteState = (stream: MediaProvider | null, muted: boolean): MediaProvider | null => {
  console.log(stream)
  if (stream) {
    if ("getAudioTracks" in stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
        console.log(track.enabled)
      });
    }
  }
  return stream;
};

function stopVideoOnly(stream: { getVideoTracks: () => any[]; }) {
    stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
        setTimeout(() => {
            track.stop();
            console.log(track)
        }, 1);
    });
}

export function setVideoMuteState(videoRef: any, muted: any) {
    let localStream = videoRef.srcObject
    if (!muted) {
        console.log(123123)
        stopVideoOnly(localStream);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                videoRef.srcObject = stream;
                updateRemotePeerConnections(stream)
            })
            .catch(error => {
                console.error("Error accessing camera", error);
            });
    }
}

let uuidv4 = () => {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

export const generateAndSavePermanentId = () => {
  const permanentId = localStorage.getItem('permanent_id');

  if (permanentId) {
    console.log('Permanent ID already exists:', permanentId);
    return permanentId
  } else {
    const newPermanentId = uuidv4();
    localStorage.setItem('permanent_id', newPermanentId);
    console.log('New Permanent ID generated:', newPermanentId);
    return newPermanentId
  }
};

export const startLocalVideo = async (videoRef: React.RefObject<HTMLVideoElement>): Promise<void> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await new Promise<void>((resolve) => {
        videoRef.current!.onloadedmetadata = () => {
          resolve();
        };
      });
    }
  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
};
export const handleVideoMute = (videoMuted: boolean, videoRef: any) => {
  if (!videoMuted && videoRef.current && videoRef.current.srcObject instanceof MediaStream) {
      const videoTracks = videoRef.current.srcObject.getVideoTracks();
      videoTracks.forEach((track: { enabled: boolean; stop: () => void; }) => {
        track.enabled = false
        setTimeout( () => {
          track.stop()
        }, 500)
      });
    }
    else {
      startLocalVideo(videoRef).then( () => {
        setTimeout(() => {
            if (videoRef.current && videoRef.current.srcObject instanceof MediaStream) {
              updateRemotePeerConnections(videoRef.current.srcObject)
            }
          }, 500)
        }
      )
    }
}

export async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch (err) {
    console.error('Error occurred:', err);
  }
}