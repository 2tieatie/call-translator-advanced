let dataArray, analyser
let mediaRecorder
let lastRecording = new Date().getTime()
let chunks = []
let lastRecordingTimeDelta
// const gap = 400 // ДЛИНА ТИШИНЫ (В мс), ПРИ КОТОРОЙ ОСТАНАВЛИВАТЬ ЗАПИСЬ
let msg = new SpeechSynthesisUtterance();
msg.rate = 1.4;
msg.pitch = 0.75;
let shadows = new Queue()
let ttsQueue = new Queue()
let t
recognition.interimResults = true;
recognition.continuous = true;
let newMessage = true
let lastMessageID
let getLanguageCode = () => {
    fetch(`/get_language_code/${myID}/${myRoomID}`)
    .then( response => response.json() )
    .then(data => {
        recognition.lang = data.languageCode
    })
}


let handleNewMessage = (local, original_text, name, id) => {
    addMessage(local, name, original_text, id)
}


let createLocalMessage = (text) => {
    lastMessageID = uuidv4()
    let messageDiv = document.createElement('div');
    messageDiv.classList.add('localMessageBox')

    let senderDiv = document.createElement('div');
    senderDiv.classList.add('localMessageSender');
    senderDiv.innerText = myName;

    let textDiv = document.createElement('div');
    textDiv.classList.add('localMessage');

    let originalLabel = document.createElement('strong');
    originalLabel.innerText = 'Original: ';
    const originalText = document.createElement('span')
    originalText.innerText = text
    originalText.id = lastMessageID
    textDiv.appendChild(originalLabel);
    textDiv.appendChild(document.createElement('br'));
    textDiv.appendChild(originalText);
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(textDiv);

    const messagesDiv = document.getElementById('messages');
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

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

recognition.onresult = event => {
    handleNewRecording(event)
}

recognition.onend = () =>  {
    if (!audioMuted) {
        recognition.start()
    }
}


socket.on('new_message', (data) => {
    appendMessage(data.id, data.text, data.original, data.type, data.name)

    if (!data.original){
        msg.text = data.text
        msg.lang = data.tts_language
        if ('speechSynthesis' in window) {
            if (window.speechSynthesis.speaking) {
                const element = document.getElementById('vid_' + data.sender)
                shadows.enqueue(element)
                ttsQueue.enqueue(
                    {
                        text: data.text,
                        lang: data.tts_language
                    }
                )
            } else {
                console.log(msg)
                window.speechSynthesis.speak(msg);
            }

        } else {
            console.log('Web Speech API does not support in this browser.');
        }
    }

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
    with_other_languages.forEach((id) => {
        const vid_element = document.getElementById(`vid_${id}`)
        vid_element.volume = 0.1
    })
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

msg.onstart = function (event) {
    console.log(shadows)
    // shadows.front().style.boxShadow = "0 0 20px 5px #faaf3f";
};

msg.onend = function (event) {
    shadows.dequeue()
    console.log(ttsQueue.size())
    if (ttsQueue.size()) {
        msg.text = ttsQueue.front().text
        msg.lang = ttsQueue.front().lang
        window.speechSynthesis.speak(msg)
    }
    ttsQueue.dequeue()
    // shadows.front().style.boxShadow = "none"
};



let uuidv4 = () => {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

