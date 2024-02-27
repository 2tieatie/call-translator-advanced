let dataArray, analyser
let mediaRecorder
let lastRecording = new Date().getTime()
let chunks = []
let lastRecordingTimeDelta
const gap = 1000 // ДЛИНА ТИШИНЫ (В мс), ПРИ КОТОРОЙ ОСТАНАВЛИВАТЬ ЗАПИСЬ
let msg = new SpeechSynthesisUtterance();
msg.rate = 1;
msg.pitch = 1;
let startedSpeaking
let recording = false
let started = false

let handleNewMessage = (local, translated_text, name, original_text) => {
    addMessage(translated_text, local, name, original_text)
}



socket.on('new_message', (data) => {
    if (!data.hasOwnProperty(myID)) {
        let d = data[Object.keys(data)[0]]
        console.log(d)
        handleNewMessage(true, d.translated_text, myName, d.original_text)
        return
    }
    let d = data[myID]
    handleNewMessage(false, d.translated_text, d.name, d.original_text)
    if ('speechSynthesis' in window) {
        msg.text = d.translated_text
        msg.lang = d.gtts_language
        window.speechSynthesis.speak(msg);
        console.log(d)
    } else {
        console.log('Web Speech API не поддерживается в этом браузере.');
    }
})

let initAnalyser = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const audioElement = new Audio();
    audioElement.srcObject = stream;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    const audioTrack = stream.getAudioTracks()[0];
    const audioOnlyStream = new MediaStream([audioTrack])
    mediaRecorder = new MediaRecorder(audioOnlyStream, { mimeType: 'audio/webm;' });
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data)
        }
    };
    startVAD(analyser)
    mediaRecorder.onstop = async () => {
        let audioBlob = new Blob(chunks, { type: 'audio/webm;' });
        console.log('Original: ', audioBlob)
        let reader = new FileReader();

        reader.onload = function(event) {
            let audioData = event.target.result;
            let audioContext = new AudioContext();

            audioContext.decodeAudioData(audioData, function(decodedData) {
                let sampleRate = 44100;
                let startTime = lastRecordingTimeDelta / 1000 - 1;
                let startFrame = 0
                if (startTime > 0) {
                    startFrame = Math.floor(startTime * sampleRate);
                }
                let trimmedAudioData = decodedData.getChannelData(0).slice(startFrame);
                socket.emit('new_recording', { audio: trimmedAudioData, room_id: myRoomID, last_recording: lastRecordingTimeDelta });
            });
        };
        reader.readAsArrayBuffer(audioBlob);
        chunks = [];
    };
}

let getParticipantsWithOtherLanguages = () => {
    socket.emit('get_users_with_other_languages', {room_id: myRoomID})
}

socket.on('users_with_other_languages', (data) => {
    console.log('data', data)
    if (data.user_id === myID) {
        muteOthers(data.with_other_languages)
    }
})
let muteOthers = (with_other_languages) => {
    console.log(with_other_languages)
    with_other_languages.forEach((id) => {
        const vid_element = document.getElementById(`vid_${id}`)
        vid_element.muted = true
    })
}

let unmuteAll = (with_other_languages) => {
    with_other_languages.forEach((id) => {
        const vid_element = document.getElementById(`vid_${id}`)
        vid_element.muted = true
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


function startVAD(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastSpeaking
        mediaRecorder.start();

    function detectVoiceActivity() {
        analyser.getByteTimeDomainData(dataArray);
        const avgAmplitude = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        const threshold = 128;
        const isVoiceActive = avgAmplitude > threshold;
        // console.log(new Date().getTime() - lastSpeaking)
        if (isVoiceActive) {
            if (!recording) {
                startedSpeaking = new Date().getTime()
            }
            recording = true
            console.log('Voice is active');
            lastSpeaking = new Date().getTime()
            // console.log(startedSpeaking - lastRecording)

        } else {
            if (new Date().getTime() - lastSpeaking > gap && recording) {
                // console.log(new Date().getTime() - lastSpeaking)
                console.log('Voice is inactive')
                lastRecordingTimeDelta = startedSpeaking - lastRecording
                mediaRecorder.stop()
                recording = false
                mediaRecorder.start();
                lastRecording = new Date().getTime()
            }
        }
        requestAnimationFrame(detectVoiceActivity);
    }
    detectVoiceActivity()
}

let saveFile =  (file, filename) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
}