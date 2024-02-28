let audioMuted = false;
let videoMuted = false;
let dropdownValues = []

document.addEventListener("DOMContentLoaded", (event)=>{

    let muteAudioField = document.getElementById("mute_audio_inp");
    let muteVideoField = document.getElementById("mute_video_inp");
    let muteBtn = document.getElementById("btn_mute");
    let muteVidBtn = document.getElementById("btn_vid_mute");
    let myVideo = document.getElementById("local_vid");
    muteBtn.addEventListener("click", (event)=>{
        audioMuted = !audioMuted;
        let local_stream = myVideo.srcObject;
        local_stream.getAudioTracks().forEach((track)=>{track.enabled = !audioMuted;});
        muteAudioField.value = (audioMuted)? "1":"0";
        document.getElementById("mute_icon").innerText = (audioMuted)? "mic_off": "mic";
    });    
    muteVidBtn.addEventListener("click", (event)=>{
        videoMuted = !videoMuted;
        let local_stream = myVideo.srcObject;
        local_stream.getVideoTracks().forEach((track)=>{track.enabled = !videoMuted;});
        muteVideoField.value = (videoMuted)? "1":"0";
        document.getElementById("vid_mute_icon").innerText = (videoMuted)? "videocam_off": "videocam";
    });  
    
    startCamera();
    const inp = document.getElementById('display_name')
    inp.value = localStorage.getItem('username')
    inp.addEventListener('input', (text) => {
        localStorage.setItem('username', inp.value.trim())
    })
    const select = document.getElementById('selectLanguage')
    const button = document.getElementById('button')
    const language_inp = document.getElementById('language_inp')
    if (!inp.value) {
        button.disabled = true
    }
    inp.addEventListener('input', () => {
        button.disabled = !(inp.value.trim() && language_inp.value)
    })
    select.addEventListener('change', function() {
        const selectedValue = select.value
        language_inp.value = selectedValue
        localStorage.setItem('language', selectedValue)
        button.disabled = !(inp.value.trim() && language_inp.value)
    })
    language_inp.value = localStorage.getItem('language')
    console.log(language_inp.value)
    dropDown()
});


let camera_allowed=false;
let mediaConstraints = {
    audio: true,
    video: true
    //     {
        // height: 360
    // }
};

function validate()
{
    if(!camera_allowed)
    {alert("Please allow camera and mic permissions!");}
    return camera_allowed;
}

function startCamera()
{
    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then((stream)=>{
        document.getElementById("local_vid").srcObject = stream;
        camera_allowed=true;
    })
    .catch((e)=>{
        camera_allowed=true;
        // console.log("Error! Unable to start video! ", e);
        // document.getElementById("permission_alert").style.display = "block";
    });
}


let dropDown = () => {
    const select = document.getElementById('selectLanguage');
    fetch('/languages')
        .then(response => response.json())
        .then(data => {
            data.names.forEach(obj => {
                for (let key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        const option = document.createElement('option');
                        option.textContent = key;
                        option.value = key;
                        select.appendChild(option);
                        break;
                    }
                }
            });
        }).then(() => {
            if (language_inp.value) {
                select.value = language_inp.value;
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}

