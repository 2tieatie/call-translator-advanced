'use client';

import React, {useEffect, useState} from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@nextui-org/button'
import { Input } from '@nextui-org/input'
import { createRoom } from 'utils/utils';



const VideoChat = () => {
  const router = useRouter();
  const [roomName, setRoomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [room, setRoom] = useState<{ roomId: string; roomName: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Handle form submission logic here
  };


  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      return
    }
    createRoom(roomName).then(
      room => {
        setRoom(room)
      }
    )
  }

  const handleRedirect = () => {
    if (!room) {
      return
    }
    router.push(`/call/${room.roomId}/${room.roomName}/checkpoint`);
  };

  return (
      <div className="container flex h-screen items-center justify-center">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
              type="text"
              placeholder="Enter Room Name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              required
          />
          <Button type="submit" disabled={isSubmitting || !roomName} onClick={handleCreateRoom}>
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
          <Button onClick={handleRedirect}>Go to Checkpoint</Button>
        </form>
      </div>
  );
};

export default VideoChat;