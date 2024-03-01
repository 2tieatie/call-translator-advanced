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
// recognition.interimResults = true;
recognition.continuous = true;
recognition.lang = 'uk-UA'

let handleNewMessage = (local, translated_text, name, original_text) => {
    addMessage(translated_text, local, name, original_text)
}

recognition.onresult = event => {
    const result = event.results[event.results.length - 1][0].transcript;
    console.log(result)
};

socket.on('new_message', (data) => {
    if (!data.hasOwnProperty(myID)) {
        let d = data[Object.keys(data)[0]]
        console.log(d)
        handleNewMessage(true, d.translated_text, myName, d.original_text)
        return
    }
    let d = data[myID]
    console.log(d)
    handleNewMessage(false, d.translated_text, d.name, d.original_text)
    if ('speechSynthesis' in window) {
        msg.text = d.translated_text
        msg.lang = d.gtts_language
        window.speechSynthesis.speak(msg);
        const element = document.getElementById('vid_' + data.sender)
        shadows.enqueue(element)
    } else {
        console.log('Web Speech API does not support in this browser.');
    }
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




