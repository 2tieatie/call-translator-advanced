let dataArray, analyser
let mediaRecorder
let lastRecording = new Date().getTime()
let chunks = []
let lastRecordingTimeDelta
const gap = 400 // ДЛИНА ТИШИНЫ (В мс), ПРИ КОТОРОЙ ОСТАНАВЛИВАТЬ ЗАПИСЬ
let msg = new SpeechSynthesisUtterance();
msg.rate = 1;
msg.pitch = 1;
let startedSpeaking
let recording = false
let started = false
let shadows = new Queue()
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
    senderDiv.innerText = display_name;

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
    const text = Array.from(event.results)
    .map((result) => result[0])
    .map((result) => result.transcript)
    .join("");
    let isFinal = event.results[0].isFinal
    if (text) {
        let type = isFinal ? 'end' : 'part'
        console.log(type, isFinal)
        sendRecognized(text, type)
        if (newMessage) {
            createLocalMessage(text)
        } else {
            changeLocalMessage(text)
        }
    }
    if (isFinal) {
        newMessage = true
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
        last_recording: new Date().getTime() - lastRecording,
        type: type,
        id: lastMessageID
    });
    lastRecording = new Date().getTime()
}

recognition.onresult = event => {
    handleNewRecording(event)
}

recognition.onend = () =>  {

}


socket.on('new_message', (data) => {
    if (data.local) {
        console.log('Local Message: ', data)
    } else {
        if (data.type === "start") {
            console.log(data.text)
            handleNewMessage(false, data.text, data.name, data.id)
        } else if (data.type === 'part') {
            appendMessage(data.id, data.text)
        }
    }

    // console.log(data)
    // if (!data.hasOwnProperty(myID)) {
    //     let d = data[Object.keys(data)[0]]
    //     console.log(d)
    //     handleNewMessage(true, d.translated_text, myName, d.original_text)
    //     return
    // }
    // let d = data[myID]
    // console.log(d)
    // handleNewMessage(false, d.translated_text, d.name, d.original_text)


    // if ('speechSynthesis' in window) {
    //     msg.text = d.translated_text
    //     msg.lang = d.gtts_language
    //     window.speechSynthesis.speak(msg);
    //     const element = document.getElementById('vid_' + data.sender)
    //     shadows.enqueue(element)
    // } else {
    //     console.log('Web Speech API does not support in this browser.');
    // }
})

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
    shadows.front().style.boxShadow = "0 0 20px 5px #faaf3f";
};

msg.onend = function (event) {
    shadows.front().style.boxShadow = "none"
    shadows.dequeue()
};



let uuidv4 = () => {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

console.log(uuidv4());
