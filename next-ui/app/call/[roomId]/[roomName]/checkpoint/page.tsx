'use client';

import { Button } from '@nextui-org/button';
import { Input } from '@nextui-org/input';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import React, {useEffect, useRef, useState} from "react";
import { Select, SelectItem } from "@nextui-org/react";
import {useParams, useRouter} from 'next/navigation';
import { getLanguagesArray } from "@/utils/utils";


export default function RoomPage() {
  const router = useRouter();
  const { roomId, roomName } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  let muteAudio, muteVideo
  const [audioMuted, setAudioMuted] = useState<boolean>(muteAudio === '1');
  const [videoMuted, setVideoMuted] = useState<boolean>(muteVideo === '1');
  const [languages, setLanguages]  = useState<string[]>([])
  const [displayName, setDisplayName] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  // getLanguagesArray().then()
  useEffect(() => {
  const fetchLanguages = async () => {
    try {
      const languages = await getLanguagesArray();
      setLanguages(languages);
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };
    fetchLanguages();}, []
  )
  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  useEffect(() => {
    startStream();
  }, []);

  const toggleAudio = () => {
    setAudioMuted(!audioMuted);
  };

  const toggleVideo = () => {
    setVideoMuted(!videoMuted);
    if (!videoMuted && videoRef.current && videoRef.current.srcObject instanceof MediaStream) {
      const videoTracks = videoRef.current.srcObject.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = false
        setTimeout( () =>
            {
              track.stop()
            }, 500)
      });
    } else {
      startStream()
    }
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleLanguageChange = (value: any) => {
    setSelectedLanguage(value.target.value);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    console.log(roomId, roomName, displayName, audioMuted, videoMuted)
    router.push(`/call/${roomId}/${roomName}/room?&displayName=${displayName}&audioMuted=${audioMuted}&videoMuted=${videoMuted}&language=${selectedLanguage}`);
  };

  return (
    <div className="grid grid-cols-2 grid-rows-1 my-auto content-center h-screen items-center">
      <div className="col-span-1 justify-center flex-col">
        <h2 className="text-3xl text-muted-foreground justify-center flex">
          <div>
          <span className="roomName mx-auto">Room:</span><strong className='inline ml-1'>{roomName}</strong>
          </div>
        </h2>

        <form className="form mt-3 max-w-md mx-auto my-10" onSubmit={handleJoin}>
          <div className="flex gap-2">
            <Input
              id="display_name"
              placeholder="Displayed Name"
              required
              value={displayName}
              onChange={handleDisplayNameChange}
            />
            <Button type="submit" disabled={!displayName || !selectedLanguage}>
              Join
            </Button>
          </div>
          <input type="hidden" value="0" name="mute_audio" id="mute_audio_inp" />
          <input type="hidden" value="0" name="mute_video" id="mute_video_inp" />
          <input type="hidden" value="" name="language" id="language_inp" />
        </form>
        <div className="form mb-10 w-2/5 mx-auto">
        <Select
          label="Choose language"
          placeholder="Select Your Language"
          selectionMode="single"
          className="max-w-xs"
          value={selectedLanguage}
          onChange={handleLanguageChange}>
          {languages.map((language) => (
            <SelectItem key={language} value={language}>
              {language}
            </SelectItem>
          ))}
        </Select>
        </div>
      </div>

      <div className="col-span-1 justify-center flex">
        <div id="permission_alert" className="alert alert-danger hidden" role="alert" style={{ backgroundColor: "rgb(255, 130, 130)", color: "rgb(153, 32, 32)" }}>
          <strong>Please allow camera and mic permissions!</strong>
        </div>
        <div className="video-container flex flex-col items-center">
          <div className="vid-wrapper w-full">
            <video ref={videoRef} id="local_vid" autoPlay muted className="max-w-full h-100 rounded-lg shadow-md border border-gray-300 transition-shadow duration-500 ease-in-out" />
          </div>
          <div className="controls p-3 ">
            <Button id="btn_mute" className="rounded-full mx-3 self-center" onClick={toggleAudio}>
              {audioMuted ? <MicOffIcon /> : <MicIcon />}
            </Button>
            <Button id="btn_vid_mute" className="rounded-full mx-3" onClick={toggleVideo}>
              {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
