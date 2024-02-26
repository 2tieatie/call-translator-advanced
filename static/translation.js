let dataArray, analyser
let mediaRecorder
let lastRecording = new Date().getTime()
let chunks = []
let lastRecordingTimeDelta
const gap = 750 // ДЛИНА ТИШИНЫ (В мс), ПРИ КОТОРОЙ ОСТАНАВЛИВАТЬ ЗАПИСЬ
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
    mediaRecorder = new MediaRecorder(audioOnlyStream, { mimeType: 'audio/webm;codec=opus' });
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data)
        }
    };
    startVAD(analyser)
    mediaRecorder.onstop = async () => {
        let audioBlob = new Blob(chunks, { type: 'audio/webm;codec=opus' });
        console.log('Original: ', audioBlob)
        let reader = new FileReader();

        reader.onload = function(event) {
            let audioData = event.target.result;
            let audioContext = new AudioContext();

            audioContext.decodeAudioData(audioData, function(decodedData) {
                let sampleRate = decodedData.sampleRate;
                let startTime = lastRecordingTimeDelta / 1000 - 2;
                let startFrame = 0
                if (startTime > 0) {
                    startFrame = Math.floor(startTime * sampleRate);
                }
                let trimmedAudioData = decodedData.getChannelData(0).slice(startFrame);
                let newBuffer = audioContext.createBuffer(1, trimmedAudioData.length, sampleRate);
                newBuffer.copyToChannel(trimmedAudioData, 0);
                let audioBlobTrimmed = bufferToWave(newBuffer);
                socket.emit('new_recording', { audio: audioBlobTrimmed, room_id: myRoomID, last_recording: lastRecordingTimeDelta });
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
function bufferToWave(abuffer) {
    let numberOfChannels = abuffer.numberOfChannels,
        length = abuffer.length,
        sampleRate = abuffer.sampleRate,
        interleaved = abuffer.getChannelData(0),
        buffer = new ArrayBuffer(44 + interleaved.length * 2),
        view = new DataView(buffer),
        channels = [], i, sample, offset = 0, dataLength = interleaved.length * 2;

    setUint32(0x46464952);
    setUint32(36 + dataLength);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numberOfChannels);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numberOfChannels);
    setUint16(numberOfChannels * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(dataLength);

    for(i = 0; i < interleaved.length; i++){
        sample = Math.max(-1, Math.min(1, interleaved[i]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
        view.setInt16(offset, sample, true);
        offset += 2;
    }

    return new Blob([buffer], {type: "audio/webm;codec=opus"});

    function setUint16(data) {
        view.setUint16(offset, data, true);
        offset += 2;
    }

    function setUint32(data) {
        view.setUint32(offset, data, true);
        offset += 4;
    }
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
    function detectVoiceActivity() {
        analyser.getByteTimeDomainData(dataArray);
        const avgAmplitude = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        const threshold = 128;
        const isVoiceActive = avgAmplitude > threshold;
        if (isVoiceActive) {
            if (!recording) {
                recording = true
                console.log('Voice is active');
                startedSpeaking = new Date().getTime()
            }
        } else {
            if (new Date().getTime() - startedSpeaking > gap) {
                if (recording) {
                    console.log('Voice is inactive')
                    lastRecordingTimeDelta = new Date().getTime() - lastRecording
                    if (started) {
                        mediaRecorder.stop()
                    }
                    recording = false
                    mediaRecorder.start();
                    lastRecording = new Date().getTime()
                    if (!started) {
                        started = true
                    }
                }
            }
        }
        requestAnimationFrame(detectVoiceActivity);
    }
    detectVoiceActivity()
}