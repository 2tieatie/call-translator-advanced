let myVideo;
// const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
let audioM = true
let f_time = true
let mediaRecorder
document.addEventListener("DOMContentLoaded", (event)=>{
    myVideo = document.getElementById("local_vid");
    myVideo.onloadeddata = ()=>{console.log("W,H: ", myVideo.videoWidth, ", ", myVideo.videoHeight);};
    let muteBtn = document.getElementById("btn_mute");
    let muteVidBtn = document.getElementById("btn_vid_mute");
    let callEndBtn = document.getElementById("call_end");

    muteBtn.addEventListener("click", (event)=>{
        audioMuted = !audioMuted;
        setAudioMuteState(audioMuted);
        changeStateMR()
    })
    muteVidBtn.addEventListener("click", (event)=>{
        videoMuted = !videoMuted;
        setVideoMuteState(videoMuted);        
    });    
    callEndBtn.addEventListener("click", (event)=>{
        window.location.replace("/");
    });
});


function makeVideoElement(element_id, display_name)
{
    let wrapper_div = document.createElement("div");
    let vid_wrapper = document.createElement("div");
    let vid = document.createElement("video");
    let name_text = document.createElement("h1");

    wrapper_div.id = "div_"+element_id;
    vid.id = "vid_"+element_id;
    vid.className = 'remoteVideo'
    wrapper_div.className = "remoteVideo video-item";
    vid_wrapper.className = "vid-wrapper";
    vid_wrapper.id = "vidwr_"+element_id;
    name_text.className = "display-name";
    wrapper_div.style.backgroundColor = "rgba(102, 177, 244, 0)"
    vid_wrapper.style.backgroundColor = "rgba(255, 255, 255, 0)"
    vid.autoplay = true;        
    name_text.innerText = display_name;

    vid_wrapper.appendChild(vid);
    wrapper_div.appendChild(vid_wrapper);
    wrapper_div.appendChild(name_text);

    return wrapper_div;
}

function addVideoElement(element_id, display_name)
{
    removeVideoElement(element_id)
    document.getElementById("video_grid").appendChild(makeVideoElement(element_id, display_name));
    getParticipantsWithOtherLanguages()
}
function removeVideoElement(element_id)
{
    if (!document.getElementById("div_"+element_id)) {
        return
    }
    let v = getVideoObj(element_id);
    if(v.srcObject){
        v.srcObject.getTracks().forEach(track => track.stop());
    }
    v.removeAttribute("srcObject");
    v.removeAttribute("src");
    document.getElementById("div_"+element_id).remove();
}

function getVideoObj(element_id)
{
    return document.getElementById("vid_"+element_id);
}

function setAudioMuteState(flag)
{
    let local_stream = myVideo.srcObject;
    local_stream.getAudioTracks().forEach((track)=>{track.enabled = !flag;});
    audioM = flag
    document.getElementById("mute_icon").innerText = (flag)? "mic_off": "mic";
    if (!flag) {
        // socket.emit('connect_recognizer', {
        //     room_id: myRoomID,
        //     firstCheckpoint: 1,
        //     last_recording: lastRecordingTimeDelta,
        //     type: 'end'
        // })
        // mediaRecorder.start(mediaRecorderTimeSlice)
    } else {
        // socket.emit('disconnect_recognizer')
        // mediaRecorder.stop()
    }
}
function stopVideoOnly(stream) {
    stream.getVideoTracks().forEach((track) => {
        track.stop();
        // track.enabled = false
    });
}
function setVideoMuteState(flag)
{
    let local_stream = myVideo.srcObject;
    document.getElementById("vid_mute_icon").innerText = (flag)? "videocam_off": "videocam";
    local_stream.getVideoTracks().forEach((track)=>{track.enabled = !flag;});
    //
    // if (flag) {
    //     console.log('aa')
    //     stopVideoOnly(myVideo.srcObject)
    // } else {
    //     if (!f_time) {
    //         console.log('1111')
    //         navigator.mediaDevices.getUserMedia({ video: true })
    //         .then(stream => {
    //         myVideo.srcObject = stream;
    //         myVideo.srcObject.getVideoTracks().forEach( track => {
    //             track.enabled = true
    //         });
    //     })
    //     start_webrtc()
    //     }
    // }
    // f_time = false
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
    messagesDiv.scrollTop = messagesDiv.scrollHeight
}


let addMessage = (local, username, original_text, id) => {
    let messageDiv = document.createElement('div');
    messageDiv.classList.add(local ? 'localMessageBox' : 'remoteMessageBox');
    let senderDiv = document.createElement('div');
    senderDiv.classList.add(local ? 'localMessageSender' : 'remoteMessageSender');
    senderDiv.innerText = username;

    let textDiv = document.createElement('div');
    textDiv.classList.add(local ? 'localMessage' : 'remoteMessage');
    textDiv.id = 'mess_' + id
    let originalLabel = document.createElement('strong');
    originalLabel.innerText = 'Original: ';
    let originalText = document.createElement('span')
    originalText.id = 'orig_' + id
    originalText.innerText = original_text
    let translatedLabel = document.createElement('strong');
    translatedLabel.innerText = 'Translated: ';
    textDiv.appendChild(originalLabel);
    textDiv.appendChild(document.createElement('br'));
    textDiv.appendChild(originalText);
    textDiv.appendChild(document.createElement('br'));
    textDiv.appendChild(translatedLabel);
    textDiv.appendChild(document.createElement('br'));
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(textDiv);

    const messagesDiv = document.getElementById('messages');
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

let appendMessage = (local, id, text, original, type, username) => {
    // console.log(id)
    if (original) {
        const textElement = document.getElementById('orig_' + id)
        if (textElement) {
            textElement.innerText = text
        } else {
            addMessage(local, username, text, id)
        }
    } else {
        let textElement = document.getElementById('trans_' + id)
        if (textElement !== null) {
            // textElement.innerText = textElement.innerText + text
            textElement.innerText += ' ' + text

        } else {
            console.log(textElement)
            const message = document.getElementById('mess_' + id)
            let translatedText = document.createElement('span')
            translatedText.id = 'trans_' + id
            translatedText.innerText = text
            message.appendChild(translatedText)
        }
    }
    const messagesDiv = document.getElementById('messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
