'use client'
import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, CardBody} from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import {changeStateMR, initMediaRecorder} from '@/utils/translation'
import {
  decode,
  dragAndDrop,
  setAudioMuteState,
  generateAndSavePermanentId,
  handleVideoMute, startLocalVideo, copyToClipboard
} from '@/utils/utils'
import {
  onConnect,
  onData,
  onUserConnect,
  onUserDisconnected,
  onUserList,
} from "@/utils/socketNetworkHandlers";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";

const socket = io('http://127.0.0.1:5000', {autoConnect: false});
const VideoChat = () => {
  const router = useParams();
  const searchParams = useSearchParams();
  const displayName = decode(searchParams.get('displayName'));
  const muteAudio = searchParams.get('audioMuted') === 'true';
  const muteVideo = searchParams.get('videoMuted') === 'true';
  const language = searchParams.get('language')
  const videoRef = useRef<HTMLVideoElement>(null);
  let { roomId, roomName } = useParams();
  if (Array.isArray(roomId)) {
    roomId = roomId[0]
  }
  roomName = decode(roomName)
  const [audioMuted, setAudioMuted] = useState<boolean>(muteAudio);
  const [videoMuted, setVideoMuted] = useState<boolean>(muteVideo);
  const [showChat, setShowChat] = useState<boolean>(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<any>(null);
  const DEBUG_TEST_MESSAGES = false
  const toggleAudio = () => {
    setAudioMuted(!audioMuted);
    changeStateMR()
    if (videoRef.current) {
      const stream = videoRef.current.srcObject
      setAudioMuteState(stream, !audioMuted)
    }
  };
  useEffect(() => {
    console.log(videoMuted);
    startLocalVideo(videoRef).then(() => {
      socket.connect();
      const local_stream_element = videoRef.current as HTMLVideoElement
      if (!local_stream_element) {
        return
      }
      const local_stream = local_stream_element.srcObject as MediaStream
      if (!local_stream) {
        return;
      }
      const permanentId = generateAndSavePermanentId();
      initMediaRecorder(local_stream, socket, roomId, permanentId)
    });
  }, []);
  const toggleVideo = () => {
    setVideoMuted(!videoMuted);
    handleVideoMute(videoMuted, videoRef)
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const downloadChatHistory = () => {
    // Download chat history
  };

  useEffect(() => {
    dragAndDrop(localVideoRef)
    dragAndDrop(messagesRef)
  }, []);

  socket.on('connect', () => {
    console.log(language)
    onConnect(socket, roomId, roomName, displayName, language)
  })

  socket.on("user-connect", (data)=>{
    onUserConnect(data)
  })

  socket.on('user-disconnect', (data) => {
    onUserDisconnected(data)
  })

  socket.on("user-list", (data)=> {
    onUserList(data, socket, videoRef.current)
  })

  socket.on("data", (msg)=>{
    onData(msg, socket, videoRef.current)
  })

  socket.on('test', async (data) => {
    if (DEBUG_TEST_MESSAGES) {
        console.log('TEST MESSAGE RECEIVED')
        if (data.message) {
            console.log('TEXT', data.message)
        }
    }
  })

  socket.on('new_message', (data) => {
    console.log('NEW MESSAGE')
    console.log(data)
    // if (!data.original){
    //     const audioBytes = data.audio
    //     if (speaking) {
    //         ttsQueue.enqueue(audioBytes)
    //     }
    //     else {
    //         playAudio(audioBytes)
    //     }
    // }
    // appendMessage(data.local, data.id, data.text, data.original, data.type, data.name)
  })

const copyLink = () => {
  if (Array.isArray(roomId)) {
    roomId = roomId[0]
  }
  if (Array.isArray(roomName)) {
    roomName = roomName[0]
  }
  const roomIdEncoded = encodeURIComponent(roomId);
  const roomNameEncoded = encodeURIComponent(roomName);
  const url = `${window.location.origin}/call/${roomIdEncoded}/${roomNameEncoded}/checkpoint`;
  copyToClipboard(url);
};

  return (
    <div className="h-screen flex flex-col">
      <div className="grid">
        <div className="h-[60vh]">
          <div id="video_grid_container" className="w-full mt-2">
            <div
              id="video_grid"
              className="video-grid h-full w-full grid gap-2 justify-items-center items-center"
            >
              <div
                ref={localVideoRef}
                id="local_vid_container"
                className="local-video-container"
              >
                <video
                  ref={videoRef}
                  id="local_vid"
                  autoPlay
                  muted
                  className="local-video rounded-lg shadow-md border border-gray-300 transition-shadow duration-500 ease-in-out"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="relative">
          <Card
            ref={messagesRef}
            className={`absolute top-0 right-[5%] w-[20vw] h-[50vh] z-10 ${showChat ? 'block' : 'hidden'}`}
          >
            <CardBody className="p-0">
              <div className="chat h-full rounded-lg">
                <div   className="messages break-words overflow-auto h-[70vh] mb-[-10%]">
                  {/* Chat messages */}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
      <div className="pt-[5%] bg-[rgba(255,255,255,0)] realtive w-full">
        <div className="flex justify-around items-center">
          <div>
            <h2>
              Displayed name: <strong className="ml-2">{displayName}</strong>
            </h2>
            <h2>
              Room name: <strong className="ml-2">{roomName}</strong>
            </h2>
            <Button
              onClick={copyLink}
              className="bg-[rgba(255,255,255,0)] rounded-lg border-none shadow-[0_0_1px_1px_rgba(67,83,123,0.6)]"
            >
              Copy Link
            </Button>
            <Button
              onClick={toggleChat}
              className="bg-[rgba(255,255,255,0)] rounded-lg border-none shadow-[0_0_1px_1px_rgba(67,83,123,0.6)]"
            >
              {showChat ? 'Close Chat' : 'Show Chat'}
            </Button>
            <Button
              onClick={downloadChatHistory}
              className="bg-[rgba(255,255,255,0)] rounded-lg border-none shadow-[0_0_1px_1px_rgba(67,83,123,0.6)]"
            >
              Download Chat History
            </Button>
          </div>
          <Button
            onClick={toggleAudio}
            className="bg-[rgba(255,255,255,0.2)] rounded-full border-none shadow-[0_0_1px_1px_rgba(67,83,123,0.6)]">
              {audioMuted ? <MicOffIcon /> : <MicIcon />}
          </Button>
          <Button
            onClick={toggleVideo}
            className="bg-[rgba(255,255,255,0.2)] rounded-full border-none shadow-[0_0_1px_1px_rgba(67,83,123,0.6)]">
              {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
          </Button>
          <Button className="bg-[rgba(255,0,0,0.5)] rounded-full border-none">
            <i className="material-icons pt-2">call_end</i>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;