let myVideo;
const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
let audioM = true
let f_time = true
document.addEventListener("DOMContentLoaded", (event)=>{
    myVideo = document.getElementById("local_vid");
    myVideo.onloadeddata = ()=>{console.log("W,H: ", myVideo.videoWidth, ", ", myVideo.videoHeight);};
    let muteBtn = document.getElementById("btn_mute");
    let muteVidBtn = document.getElementById("btn_vid_mute");
    let callEndBtn = document.getElementById("call_end");

    muteBtn.addEventListener("click", (event)=>{
        audioMuted = !audioMuted;
        setAudioMuteState(audioMuted);
        if (!audioMuted) {
            recognition.start()
        } else {
            recognition.stop()
        }
    });    
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
        recognition.start()
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