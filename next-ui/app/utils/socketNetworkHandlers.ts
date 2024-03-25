import {addVideoElement, getVideoObj, removeVideoElement} from "@/utils/utils";

let myID: any;
let _peer_list: any = {}

export const onConnect = (socket: any, roomId: any, roomName: any, displayName: any, language: any) => {
    console.log("socket connected....");
    socket.emit("join-room", {room_id: roomId, room_name: roomName, display_name: displayName, language: language});
}

export const onUserConnect = (data: any) => {
    console.log("user-connect ", data);
    let peer_id = data["sid"];
    let display_name = data["name"];
    _peer_list[peer_id] = undefined;
    addVideoElement(peer_id, display_name);
}
export const onUserDisconnected = (data: any) => {
    console.log("user-disconnect ", data);
    let peer_id = data["sid"];
    closeConnection(peer_id);
    removeVideoElement(peer_id);
}

export const onUserList = (data: any, socket: any, myVideo: any) => {
    console.log("user list recvd ", data);
    myID = data["my_id"];

    if( "list" in data) // not the first to connect to room, existing user list recieved
    {
        let recvd_list = data["list"];
        try {
            for (const peer_id in _peer_list) {
                if (!recvd_list.hasOwnProperty(peer_id)) {
                    closeConnection(peer_id);
                    removeVideoElement(peer_id);
                }
            }
        } catch (ex) {
            console.log(ex)
        }

        // add existing users to user list
        for(let peer_id in recvd_list)
        {
            let display_name = recvd_list[peer_id];
            _peer_list[peer_id] = undefined;
            addVideoElement(peer_id, display_name);
        }
        start_webrtc(myVideo, socket);
    }
}

const closeConnection = (peer_id: string) => {
    if(peer_id in _peer_list)
    {
        _peer_list[peer_id].onicecandidate = null;
        _peer_list[peer_id].ontrack = null;
        _peer_list[peer_id].onnegotiationneeded = null;

        delete _peer_list[peer_id]; // remove user from user list
    }
}

const log_user_list = () => {
    for(let key in _peer_list)
    {
        console.log(`${key}: ${_peer_list[key]}`);
    }
}

//---------------[ webrtc ]--------------------

let PC_CONFIG = {
    iceServers: [
        {
            urls: ['stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    // 'stun:stun2.l.google.com:19302',
                    // 'stun:stun3.l.google.com:19302',
                    // 'stun:stun4.l.google.com:19302'
                ]
        },
    ]
};

const log_error = (e: any) => {
    console.log("[ERROR] ", e);
}

export const sendViaServer = (data: any, socket: any) => {
    socket.emit("data", data);
}

export const onData = (msg: any, socket: any, myVideo: any) => {
    switch(msg["type"])
    {
        case "offer":
            handleOfferMsg(msg, socket, myVideo);
            break;
        case "answer":
            handleAnswerMsg(msg);
            break;
        case "new-ice-candidate":
            handleNewICECandidateMsg(msg);
            break;
    }
}

export const start_webrtc = (myVideo: any, socket: any) => {
    // send offer to all other members
    for(let peer_id in _peer_list)
    {
        invite(peer_id, myVideo, socket);
    }
}

export const invite = (peer_id: string, myVideo: any, socket: any) => {
    if (_peer_list[peer_id]) {
        console.log("[Not supposed to happen!] Attempting to start a connection that already exists!")
        return
    }
    else if (peer_id === myID) {
        console.log("[Not supposed to happen!] Trying to connect to self!");
        return
    }
    else
    {
        console.log(`Creating peer connection for <${peer_id}> ...`);
        createPeerConnection(peer_id, socket);

      let local_stream = myVideo?.srcObject;
      //   let local_stream: MediaProvider | HTMLVideoElement | null = document.getElementById('local_stream') as HTMLVideoElement
      //   if (local_stream) {
      //       local_stream = local_stream.srcObject
      //   }
      if (local_stream && local_stream instanceof MediaStream) {
        local_stream.getTracks().forEach((track: any)=>{_peer_list[peer_id].addTrack(track, local_stream);});
      } else {
        console.error('Local stream is null or not a MediaStream');
        console.log(myVideo)
      }
    }
}

export const createPeerConnection = (peer_id: string, socket: any) => {
    _peer_list[peer_id] = new RTCPeerConnection(PC_CONFIG);

    _peer_list[peer_id].onicecandidate = (event: any) => {handleICECandidateEvent(event, peer_id, socket)};
    _peer_list[peer_id].ontrack = (event: any) => {handleTrackEvent(event, peer_id)};
    _peer_list[peer_id].onnegotiationneeded = () => {handleNegotiationNeededEvent(peer_id, socket)};
}


export const handleNegotiationNeededEvent = (peer_id: string, socket: any) => {
    _peer_list[peer_id].createOffer()
    .then((offer: any)=>{return _peer_list[peer_id].setLocalDescription(offer);})
    .then(()=>{
        console.log(`sending offer to <${peer_id}> ...`);
        sendViaServer({
            "sender_id": myID,
            "target_id": peer_id,
            "type": "offer",
            "sdp": _peer_list[peer_id].localDescription
        }, socket);
    })
    .catch(log_error);
}


const handleOfferMsg = (msg: any, socket: any, myVideo: any) => {
    let peer_id = msg['sender_id'];

    console.log(`offer recieved from <${peer_id}>`);

    createPeerConnection(peer_id, socket);
    let desc = new RTCSessionDescription(msg['sdp']);
    _peer_list[peer_id].setRemoteDescription(desc)
    .then(()=>{
        let local_stream = myVideo.srcObject;
        local_stream.getTracks().forEach((track: any)=>{
            try {
                _peer_list[peer_id].addTrack(track, local_stream);

            } catch (error) {
                console.log(error)
            }
        });
    })
    .then(()=>{return _peer_list[peer_id].createAnswer();})
    .then((answer: any)=>{return _peer_list[peer_id].setLocalDescription(answer);})
    .then(()=>{
        console.log(`sending answer to <${peer_id}> ...`);
        sendViaServer({
            "sender_id": myID,
            "target_id": peer_id,
            "type": "answer",
            "sdp": _peer_list[peer_id].localDescription
        }, socket);
    })
    .catch(log_error);
}

const handleAnswerMsg = (msg: any) => {
    let peer_id = msg['sender_id'];
    console.log(`answer recieved from <${peer_id}>`);
    let desc = new RTCSessionDescription(msg['sdp']);
    _peer_list[peer_id].setRemoteDescription(desc)
}


const handleICECandidateEvent = (event: { candidate: any; }, peer_id: string, socket: any) => {
    if(event.candidate){
        sendViaServer({
            "sender_id": myID,
            "target_id": peer_id,
            "type": "new-ice-candidate",
            "candidate": event.candidate
        }, socket);
    }
}

const handleNewICECandidateMsg = (msg: any) => {
    let peer_id;
    console.log(`ICE candidate recieved from <${peer_id}>`);
    let candidate = new RTCIceCandidate(msg.candidate);
    _peer_list[msg["sender_id"]].addIceCandidate(candidate)
    .catch(log_error);
}


const handleTrackEvent = (event: any, peer_id: string) =>
{
    console.log(`track event recieved from <${peer_id}>`);

    if (event.streams && peer_id) {
        const videoObj = getVideoObj(peer_id)
        if (!videoObj) {
            return
        }
        videoObj.srcObject = event.streams[0];
    }
}

export function updateRemotePeerConnections(newStream: { getVideoTracks: () => any[]; }) {
    for (const peerId in _peer_list) {
        if (_peer_list.hasOwnProperty(peerId)) {
            const peerConnection = _peer_list[peerId];
            const senders = peerConnection.getSenders();
            senders.forEach((sender: { track: { kind: string; }; replaceTrack: (arg0: any) => void; }) => {
                if (sender.track.kind === 'video') {
                    sender.replaceTrack(newStream.getVideoTracks()[0]);
                }
            });
        }
    }
}