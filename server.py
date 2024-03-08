import asyncio
from typing import Any
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, send_file
from flask_socketio import SocketIO, emit, join_room, leave_room
from languages.get_languages import names
from utils.utils import *
from uuid import uuid4
# Next two lines are for the issue: https://github.com/miguelgrinberg/python-engineio/issues/142
from engineio.payload import Payload
Payload.max_decode_packets = 200

app = Flask(__name__)
app.config['SECRET_KEY'] = "thisismys3cr3tk3y"
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
socketio = SocketIO(app, async_mode='eventlet', max_http_buffer_size=500 * 1024 * 1024)


_users_in_room = {}
_room_of_sid = {}
_name_of_sid = {}

rooms = []


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        room_name = request.form['room_id']
        room_id = str(uuid4())
        room = Room(room_id=room_id, name=room_name)
        add_room(room=room, rooms=rooms)

        return redirect(url_for("entry_checkpoint", room_id=room_id, room_name=room.name))

    return render_template("home.html")


@app.route("/room/<string:room_id>/")
def enter_room(room_id):
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    if room_id not in session:
        return redirect(url_for("entry_checkpoint", room_id=room_id))
    return render_template("chatroom.html", room_id=room_id, room_name=room.name, display_name=session[room_id]["name"], mute_audio=session[room_id]["mute_audio"], mute_video=session[room_id]["mute_video"], language=session[room_id]['language'])


@app.route("/room/<string:room_id>/checkpoint/", methods=["GET", "POST"])
def entry_checkpoint(room_id):
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    if request.method == "POST":
        display_name = request.form['display_name']
        mute_audio = request.form['mute_audio']
        mute_video = request.form['mute_video']
        language = request.form['language']
        session[room_id] = {"name": display_name, "mute_audio":mute_audio, "mute_video":mute_video, 'language': language}
        return redirect(url_for("enter_room", room_id=room_id))
    return render_template("chatroom_checkpoint.html", room_id=room_id, room_name=room.name)
    

@socketio.on("connect")
def on_connect():
    sid = request.sid
    print("New socket connected ", sid)
    

@socketio.on("join-room")
def on_join_room(data):
    sid = request.sid
    room_id = data["room_id"]
    room_name = data['room_name']
    display_name = session[room_id]["name"]
    language = session[room_id]['language']
    join_room(room_id)
    _room_of_sid[sid] = room_id
    _name_of_sid[sid] = display_name
    room = get_room_by_id(rooms=rooms, room_id=room_id)
    participant = Participant(username=display_name, user_id=sid, language=language)
    room.add_participant(participant)
    [print(i) for i in rooms]

    print("[{}] New member joined: {}<{}>".format(room_id, display_name, sid))
    emit("user-connect", {"sid": sid, "name": display_name}, broadcast=True, include_self=False, room=room_id)
    

    if room_id not in _users_in_room:
        _users_in_room[room_id] = [sid]
        emit("user-list", {"my_id": sid})
    else:
        usrlist = {u_id:_name_of_sid[u_id] for u_id in _users_in_room[room_id]}
        emit("user-list", {"list": usrlist, "my_id": sid})
        _users_in_room[room_id].append(sid)

    print("\nusers: ", _users_in_room, "\n")


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    room_id = _room_of_sid[sid]
    display_name = _name_of_sid[sid]

    print("[{}] Member left: {}<{}>".format(room_id, display_name, sid))
    emit("user-disconnect", {"sid": sid}, broadcast=True, include_self=False, room=room_id)

    _users_in_room[room_id].remove(sid)
    if len(_users_in_room[room_id]) == 0:
        _users_in_room.pop(room_id)

    _room_of_sid.pop(sid)
    _name_of_sid.pop(sid)
    participant = get_participant_by_id(room_id=room_id, rooms=rooms, user_id=sid)
    if participant:
        room = get_room_by_id(room_id=room_id, rooms=rooms)
        if room:
            room.remove_participant(participant=participant)
    print("\nusers: ", _users_in_room, "\n")


@socketio.on("data")
def on_data(data):
    sender_sid = data['sender_id']
    target_sid = data['target_id']
    if sender_sid != request.sid:
        print("[Not supposed to happen!] request.sid and sender_id don't match!!!")

    if data["type"] != "new-ice-candidate":
        print('{} message from {} to {}'.format(data["type"], sender_sid, target_sid))
    socketio.emit('data', data, room=target_sid)


@socketio.on("get_users_with_other_languages")
def get_users_with_other_languages(data):
    user_id = request.sid
    room_id = data['room_id']
    language = get_participant_by_id(room_id=room_id, user_id=user_id, rooms=rooms)
    other_participants = get_other_participants(user_id=user_id, room_id=room_id, rooms=rooms)
    with_other_languages = []
    for participant in other_participants:
        if participant.language != language:
            with_other_languages.append(participant.user_id)
    print(with_other_languages)
    socketio.emit('users_with_other_languages', {'with_other_languages': with_other_languages, 'user_id': user_id}, room=room_id)


@app.route('/languages', methods=['GET'])
def get_languages():
    return jsonify({'names': names})


@socketio.on("new_recording")
def new_recording(data):
    message_type = data['type']
    print(message_type, data)
    if message_type == 'part':
        handle_message_part(data=data)
    else:
        async_new_recording(data=data)


def async_new_recording(data):
    user_id = request.sid
    room_id = data['room_id']
    speech = data['speech']
    message_id = data['id']
    last_recording = data['last_recording']
    new_data = {'status': 'succeeded', 'text': speech}
    time_from_last_recording = last_recording / 1000
    context = get_last_messages_by_user_id(room_id=room_id, user_id=user_id, rooms=rooms)
    sender = get_participant_by_id(room_id=room_id, user_id=user_id, rooms=rooms)
    receivers = get_other_participants(room_id=room_id, user_id=user_id, rooms=rooms)
    if not sender and not receivers:
        return
    receivers_languages: dict[Participant, dict[str, str]] = {}
    get_participants_languages(receivers=receivers, receivers_languages=receivers_languages)
    prepare_translated_data(data=new_data, context=context, sender=sender, receivers_languages=receivers_languages, room_id=room_id, rooms=rooms, time_gap=time_from_last_recording, socketio=socketio, message_id=message_id)


@app.route('/get_chat_history', methods=['GET'])
def get_chat_history_serv():
    room_id = request.args.get('room_id')
    user_id = request.args.get('user_id')
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    chat_history_str = get_chat_history(room=room, user_id=user_id)
    with open('chat_history.txt', 'w') as file:
        file.write(chat_history_str)
    return send_file('chat_history.txt', as_attachment=True)


@app.route('/get_language_code/<string:user_id>/<string:room_id>', methods=['GET'])
def get_language_code(user_id: str, room_id: str):
    user = get_participant_by_id(room_id=room_id, user_id=user_id, rooms=rooms)
    if user:
        print(user)
        language_code = get_language(user.language, 'js')
        return jsonify({'languageCode': language_code})
    return jsonify({})


def handle_message_part(data: dict[str, str]):
    message_id = data['id']
    room_id = data['room_id']
    speech = data['speech']
    user_id = request.sid
    receivers = get_other_participants(room_id=room_id, user_id=user_id, rooms=rooms)
    sender = get_participant_by_id(room_id=room_id, rooms=rooms, user_id=user_id)
    for receiver in receivers:
        socketio.emit('new_message', {
            "id": message_id,
            "text": speech,
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": True
        }, to=receiver.user_id)


if __name__ == "__main__":
    socketio.run(app, debug=True)

