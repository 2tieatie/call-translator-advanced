let dataArray, analyser
let lastRecording = new Date().getTime()
let chunks = []
let lastRecordingTimeDelta
let msg = new SpeechSynthesisUtterance();
msg.rate = 1.25;
msg.pitch = 0.85;
let shadows = new Queue()
let ttsQueue = new Queue()
let t
let newMessage = true
let lastMessageID
let audio
let speaking = false
let DEBUG_TEST_MESSAGES = false
let mediaRecorderTimeSlice = 450
let firstOpen = true

let changeStateMR = () => {
    if (mediaRecorder === undefined) {
        console.log('ERROR OCCURRED WITH MediaRecorder (No such instance)')
        return
    }
    if (mediaRecorder.state !== 'recording') {
        mediaRecorder.start(mediaRecorderTimeSlice)
    } else {
        mediaRecorder.stop()
    }
}

let initMediaRecorder = stream => {

    if (!MediaRecorder.isTypeSupported('audio/webm'))
        return alert('Browser not supported')
    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
    })
    mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
            // console.log('new_data')
            socket.emit('new_recording', {audio: event.data})
        }
    }

    mediaRecorder.onstart = async () => {
        if (firstOpen) {
            firstOpen = false
            return
        }
        console.log('Started recorder')
        socket.emit('connect_recognizer', {
            room_id: myRoomID,
            firstCheckpoint: 1,
            last_recording: lastRecordingTimeDelta,
            type: 'end'
        })
    }

    mediaRecorder.onstop = async () => {
        console.log('Ended recorder')
        socket.emit('disconnect_recognizer')
    }



    // try {
    //     mediaRecorder.start(mediaRecorderTimeSlice)
    // } catch (e) {
    //     console.log(e)
    // }

    if (audioMuted) {
        // changeStateMR()
        mediaRecorder.stop()

    } else {
        // changeStateMR()
        // changeStateMR()
        mediaRecorder.start(mediaRecorderTimeSlice)
    }
}



let getLanguageCode = () => {
    fetch(`/get_language_code/${myID}/${myRoomID}`)
    .then( response => response.json() )
    .then(data => {
        // recognition.lang = data.languageCode
    })
}


let handleNewMessage = (local, original_text, name, id) => {
    addMessage(local, name, original_text, id)
}

let changeLocalMessage = (text) => {
    const textStrong = document.getElementById(lastMessageID)
    textStrong.innerText = text
}

let handleNewRecording = event => {
    let isFinal = event.results[event.results.length - 1].isFinal
    const text = Array.from(event.results)
    .map((result) => result[0])
    .map((result) => result.transcript)
    .join("");
    if (text) {
        let type = isFinal ? 'end' : 'part'
        if (newMessage) {
            lastRecordingTimeDelta = new Date().getTime() - lastRecording
            createLocalMessage(text)
            sendRecognized(text, type)
        } else {
            sendRecognized(text, type)
            changeLocalMessage(text)
        }
    }
    if (isFinal) {
        newMessage = true
        recognition.stop()
        lastRecording = new Date().getTime()
    } else if (newMessage) {
        newMessage = false
    }
}

let sendRecognized = (text, type) => {
    let firstCheckpoint = new Date().getTime()
    socket.emit('new_recording', {
        room_id: myRoomID,
        speech: text,
        firstCheckpoint: firstCheckpoint,
        last_recording: lastRecordingTimeDelta,
        type: type,
        id: lastMessageID
    });
}

let playAudio = audioBytes => {
    speaking = true
    const blob = new Blob([audioBytes], )
    const audioURL = URL.createObjectURL(blob);
    const audio = new Audio(audioURL);
    audio.addEventListener('ended', () => {
        speaking = false
        console.log(ttsQueue.size())
        if (ttsQueue.size()) {
            playAudio(ttsQueue.front())
        }
        ttsQueue.dequeue()
    })
    audio.play();
}

socket.on('new_message', async (data) => {
    console.log('NEW MESSAGE')
    console.log(data)
    if (!data.original){
        const audioBytes = data.audio
        if (speaking) {
            ttsQueue.enqueue(audioBytes)
        }
        else {
            playAudio(audioBytes)
        }
    }
    appendMessage(data.local, data.id, data.text, data.original, data.type, data.name)
})

let getParticipantsWithOtherLanguages = () => {
    socket.emit('get_users_with_other_languages', {room_id: myRoomID})
}

socket.on('users_with_other_languages', (data) => {
    if (data.user_id === myID) {
        muteOthers(data.with_other_languages)
    }
})
let muteOthers = (with_other_languages) => {
    console.log(with_other_languages)
    try {
        with_other_languages.forEach((id) => {
        const vid_element = document.getElementById(`vid_${id}`)
        vid_element.volume = 0.1
    })
    } catch (e) {
        console.log(e)
    }

}

let unmuteAll = (with_other_languages) => {
    with_other_languages.forEach((id) => {
        const vid_element = document.getElementById(`vid_${id}`)
        vid_element.muted = false
    })
}

function downloadChatHistory(room_id, user_id) {
    let url = `/get_chat_history?room_id=${room_id}&user_id=${user_id}`;
    let link = document.createElement('a');
    link.href = url;
    link.download = 'chat_history.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


let uuidv4 = () => {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}


socket.on('test', async (data) => {
    if (DEBUG_TEST_MESSAGES) {
        console.log('TEST MESSAGE RECEIVED')
        if (data.message) {
            console.log('TEXT', data.message)
        }
    }
})

