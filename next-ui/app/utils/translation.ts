import { DefaultEventsMap } from "@socket.io/component-emitter";
import { Socket } from "socket.io-client";

let mediaRecorder: MediaRecorder | undefined;
let mediaRecorderTimeSlice = 450;
let audioMuted = false;
let firstOpen = true;
let lastRecordingTimeDelta = 1;
let recording = false
let myPermanentId = ''
let connected = false
export let changeStateMR = () => {
    console.log('changing state')
    if (mediaRecorder === undefined) {
        console.log('ERROR OCCURRED WITH MediaRecorder (No such instance)');
        return;
    }
    if (mediaRecorder.state !== 'recording') {
        mediaRecorder.start(mediaRecorderTimeSlice);
    } else {
        mediaRecorder.stop();
    }
};

export let initMediaRecorder = (stream: MediaStream, socket: Socket<DefaultEventsMap, DefaultEventsMap>, myRoomID: string | string[], permanentId: string) => {
  const mimeType = 'audio/webm'; // Поддерживаемый тип MIME
    // myPermanentId = permanentId
  const options = {
    mimeType: mimeType
  };

  mediaRecorder = new MediaRecorder(stream,
      // options
  );
  mediaRecorder.ondataavailable = async (event) => {
  if (event.data.size > 0) {
      if (!recording) {
        console.log('Started recorder');
        socket.emit('connect_recognizer', {
          room_id: myRoomID,
          firstCheckpoint: 1,
          last_recording: lastRecordingTimeDelta,
          type: 'end',
          permanent_id: permanentId
        });
        recording = true
      }
      console.log('new_data');
      socket.emit('new_recording', {audio: event.data, permanent_id: permanentId});
  }
};
  mediaRecorder.onstart = async () => {
    if (firstOpen) {
      firstOpen = false;
      return;
    }
    // if (recording) {
    //     return
    // }
    console.log('Started recorder');
    socket.emit('connect_recognizer', {
      room_id: myRoomID,
      firstCheckpoint: 1,
      last_recording: lastRecordingTimeDelta,
      type: 'end',
      permanent_id: permanentId
    });
    recording = true

  };
  mediaRecorder.onstop = async () => {
    console.log('Ended recorder');
    socket.emit('disconnect_recognizer', {
      permanent_id: permanentId
    });
    recording = false
  };
  try {
    setTimeout(()=> {
      if (!mediaRecorder) {
        return;
      }
      if (mediaRecorder.state !== 'recording') {
        try {
          mediaRecorder.start(mediaRecorderTimeSlice);
        } catch (e) {
          console.log(e);
        }
      }
    }, 750);
  } catch (e) {
    console.error(e);
  }
  // if (audioMuted) {
  //   // changeStateMR();
  // } else {
  //   changeStateMR();
  //   // changeStateMR();
  // }
};