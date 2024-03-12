'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const VideoChat = () => {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Handle form submission logic here
  };

  const handleRedirect = () => {
    router.push('/checkpoint');
  };

  return (
    <div className="container flex h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="text"
          placeholder="Enter Room Name"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          required
        />
        <Button type="submit" disabled={isSubmitting || !roomId}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
        <Button onClick={handleRedirect}>Go to Checkpoint</Button>
      </form>
    </div>
  );
};

export default VideoChat;