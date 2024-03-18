import asyncio
import os
import threading
import time
import uuid
from typing import Any, Callable

from deepgram import LiveOptions, DeepgramClient, LiveTranscriptionEvents
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, send_file
from flask_socketio import SocketIO, emit, join_room, leave_room
from languages.get_languages import names
from utils.utils import *
from uuid import uuid4
from utils.utils import Handler
# Next two lines are for the issue: https://github.com/miguelgrinberg/python-engineio/issues/142
from engineio.payload import Payload
Payload.max_decode_packets = 200
app = Flask(__name__)
app.config['SECRET_KEY'] = "thisismys3cr3tk3y"
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
socketio = SocketIO(app, async_mode='eventlet', max_http_buffer_size=500 * 1024 * 1024)
STEP = int(os.getenv('STEP'))
DEEPGRAM_TOKEN = os.getenv('DEEPGRAM_TOKEN')
_users_in_room = {}
_room_of_sid = {}
_name_of_sid = {}
dg_connections = {}
rooms = []
h = Handler()


def deepgram_conn(handler: Callable):
    dg_socket = DeepgramClient(api_key=DEEPGRAM_TOKEN).listen.live.v("1")
    dg_socket.on(LiveTranscriptionEvents.Transcript, handler)
    return dg_socket


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


@socketio.on("connect_recognizer")
def new_recording(data):

    data_arg = data
    room_id = data['room_id']
    sid = request.sid

    user = get_participant_by_id(room_id=room_id, user_id=sid, rooms=rooms)
    language_code = get_language(user.language, 'deepgram')

    options = LiveOptions(model="nova-2", language=language_code)

    def on_message(result):
        data_arg['speech'] = result.channel.alternatives[0].transcript

        if len(data_arg['speech']) == 0:
            return

        data['id'] = str(uuid.uuid4())
        data['user_id'] = sid

        print(data['speech'])

        # handle_message_part(data=data)

        room: Room = get_room_by_id(room_id=data_arg['room_id'], rooms=rooms)

        if room.in_queue(data=data_arg['speech'], message_id=data_arg['id']):
            return

        room.add_to_queue(message_id=data_arg['id'], task=async_new_recording, data=data_arg)

        if room.is_free(data_arg['id']):
            t_data = room.get_from_queue(message_id=data_arg['id'])

            if not t_data:
                return

            task, task_data = t_data
            task(task_data)

    def on_message_handler(self, result, **kwargs):
        thread: threading.Thread = threading.Thread(target=on_message, args=(result, ))
        thread.daemon = True
        thread.start()

    dg_connections[sid] = deepgram_conn(handler=on_message_handler)
    dg_connections[sid].start(options)


@socketio.on("new_recording")
def new_recording(data):

    sid = request.sid
    socketio.emit('test', {'message': 'test'}, to=sid)
    if dg_connections.get(sid):
        dg_connections[sid].send(data['audio'])


@socketio.on("disconnect_recognizer")
def disconnect_recognizer():
    sid = request.sid

    if dg_connections.get(sid):
        dg_connections[sid].finish()
        del dg_connections[sid]


def async_new_recording(data) -> None:
    print('Entered Func')
    room_id = data['room_id']
    message_id = data['id']
    room: Room = get_room_by_id(room_id=room_id, rooms=rooms)
    cont = room.is_free(message_id=message_id)
    # handle_message_part(data=data)
    while not cont:
        cont = room.is_free(message_id=message_id)

    room.set_state_not_free(message_id=message_id)

    user_id = data['user_id']
    speech = data['speech']

    sender = get_participant_by_id(room_id=room_id, user_id=user_id, rooms=rooms)
    receivers = get_other_participants(room_id=room_id, user_id=user_id, rooms=rooms)


    for receiver in receivers:
        h.call(data={
            "id": message_id,
            "text": speech,
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": True
        }, to=receiver.user_id)
        print(f'Sent to Receiver: {receiver.username}, {receiver.user_id}')
    h.call(data={
        "id": message_id,
        "text": speech,
        "type": "part",
        "local": True,
        "name": sender.username,
        "original": True
    }, to=user_id)

    if not sender or not receivers:
        return

    receivers_languages: dict[Participant, dict[str, str]] = {}
    get_participants_languages(receivers=receivers, receivers_languages=receivers_languages)

    results = prepare_translated_data(
        text=speech,
        sender=sender,
        receivers_languages=receivers_languages,
        room_id=room_id,
        rooms=rooms,
        message_id=message_id
    )

    message: Message = room.get_message(message_id=message_id)

    for result in results:
        result['data']['id'] = message.id
        # h.call(data=result['data'], to=result['receiver'].user_id)
        socketio.emit('new_message', result['data'], to=result['receiver'].user_id)
        message.add_translation(language=result['receiver'].language, text=result['translated_text'])

    room.set_state_free(message_id=message_id)

    t_data = room.get_from_queue(message_id=message_id)

    if not t_data:
        return

    task, data = t_data
    task(data)


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
        language_code = get_language(user.language, 'js')
        return jsonify({'languageCode': language_code})
    return jsonify({})


def handle_message_part(data: dict[str, str]):
    print('Entered Handler')
    message_id = data['id']
    room_id = data['room_id']
    speech = data['speech']
    user_id = data['user_id']
    receivers = get_other_participants(room_id=room_id, user_id=user_id, rooms=rooms)
    sender = get_participant_by_id(room_id=room_id, rooms=rooms, user_id=user_id)
    for receiver in receivers:
        h.call(data={
            "id": message_id,
            "text": speech,
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": True
        }, to=receiver.user_id)
        # socketio.emit('new_message', {
        #     "id": message_id,
        #     "text": speech,
        #     "type": "part",
        #     "local": False,
        #     "name": sender.username,
        #     "original": True
        # }, to=receiver.user_id)
        print(f'Sent to Receiver: {receiver.username}, {receiver.user_id}')
    h.call(data={
        "id": message_id,
        "text": speech,
        "type": "part",
        "local": True,
        "name": sender.username,
        "original": True
    }, to=user_id)
    # socketio.emit('new_message', {
    #     "id": message_id,
    #     "text": speech,
    #     "type": "part",
    #     "local": True,
    #     "name": sender.username,
    #     "original": True
    # }, to=user_id)

    print(f'Sent to Sender: {sender.username}, {sender.user_id}')


@h.handle()
def send_message(data, to):
    socketio.emit('new_message', data, to=to)


if __name__ == "__main__":
    socketio.run(app, debug=True)

