import asyncio
import threading
import time
from pprint import pprint
from typing import Any

from flask_socketio import SocketIO

from models.models import Room, Participant, Message
import os
from languages.get_languages import get_language
from utils.translate import Translator

__MAX_ROOMS = int(os.getenv('MAX_ROOMS'))
__MAX_MESSAGES_GAP = int(os.getenv('MAX_MESSAGES_GAP'))
__MAX_MESSAGES_CONTEXT = int(os.getenv('MAX_MESSAGES_CONTEXT'))


def get_room_by_id(room_id: str, rooms: list[Room]) -> Room | None:
    for room in rooms:
        if room.room_id == room_id:
            return room
    return None


def get_participant_by_id(room_id: str, rooms: list[Room], user_id: str) -> Participant | None:
    room: Room = get_room_by_id(room_id=room_id, rooms=rooms)
    if not room:
        return
    for participant in room.participants:
        if participant.user_id == user_id:
            return participant
    return None


def get_other_participants(room_id: str, rooms: list[Room], user_id: str) -> list[Participant] | None:
    room: Room = get_room_by_id(room_id=room_id, rooms=rooms)
    if not room:
        return
    other_participants = []
    for participant in room.participants:
        if participant.user_id != user_id:
            other_participants.append(participant)
    return other_participants


def add_room(room: Room, rooms: list[Room]):
    rooms.append(room)
    if len(rooms) > __MAX_ROOMS:
        rooms.pop(0)


def get_chat_history(room: Room, user_id: str) -> str:
    result = ''
    for message in room.messages:
        if user_id == message.sender.user_id or user_id == message.receiver.user_id:
            message_data_str = f'From: {message.sender.username}\n' \
                               f'To: {message.receiver.username}\n' \
                               f'Original text ({message.sender.language}): {message.original_text}\n' \
                               f'Translated text ({message.receiver.language}): {message.translated_text}\n'
            result += f'{'-' * 100}\n{message_data_str}'
    return result


def get_last_messages_by_user_id(room_id: str, user_id: str, rooms: list[Room]) -> str:
    last_messages: list[str] = []
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    sender = get_participant_by_id(room_id=room_id, user_id=user_id, rooms=rooms)
    for message in room.messages[::-1]:
        if len(last_messages) >= __MAX_MESSAGES_CONTEXT:
            break
        if message.sender == sender:
            if message.time_gap < __MAX_MESSAGES_GAP:
                if message.original_text not in last_messages:
                    last_messages.append(message.original_text)
            else:
                break
    if last_messages:
        return ' '.join(last_messages[::-1])
    return ''


def get_participants_languages(receivers: list[Participant], receivers_languages: dict[Participant, dict[str, str]]):
    for receiver in receivers:
        receivers_languages[receiver] = {}
        receivers_languages[receiver]['deepl'] = get_language(receiver.language, 'deepl')
        receivers_languages[receiver]['gtts'] = get_language(receiver.language, 'gtts')


def prepare_translated_data(
        text: str,
        receivers_languages: dict[Participant],
        sender: Participant,
        room_id: str,
        rooms: list[Room],
        message_id: str
) -> dict[str, Any]:
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    message = room.get_message(message_id=message_id)
    first_message = False
    if not message:
        message = Message(sender=sender,
                          original_text=text,
                          message_id=message_id)
        room.add_message(message)
        first_message = True

    translation_results = {}
    results: list[dict[str, str]] = []
    threads = []
    for receiver in receivers_languages.keys():
        if receiver.language != sender.language:
            prev_trans = message.translated.get(receiver.language)
            prev_orig = message.original_text
            thread = threading.Thread(
                target=Translator.translate,
                args=(
                    receiver,
                    sender,
                    text,
                    results,
                    first_message,
                    prev_trans,
                    prev_orig,
                )
            )
            threads.append(thread)
            thread.start()

    for thread in threads:
        thread.join()

    for result in results:
        pprint(result)
    # if data['status'] == 'succeeded':
    #     results: list[dict[str, str | Participant]] = []
    #     threads = []
    #     for receiver in receivers_languages.keys():
    #         if receiver.language != sender.language:
    #             thread = threading.Thread(
    #                 target=Translator.translate,
    #                 args=(
    #                     data['status'],
    #                     data['text'],
    #                     receiver,
    #                     sender,
    #                     context,
    #                     message_id,
    #                     receivers_languages[receiver]['gtts'],
    #                     results
    #                 )
    #             )
    #             threads.append(thread)
    #             thread.start()
    #     for thread in threads:
    #         thread.join()
    #
    #     for result in results:
    #         if result['status'] == 'success':
    #             print(result)
        #         socketio.emit('new_message', result['data'], to=result['receiver'].user_id)
        #         receiver = result['receiver']
        #         result['name'] = sender.username
        #         result['gtts_language'] = receivers_languages[receiver]['gtts']
        #         del result['receiver']
        #         print(result)
        #         translation_results[receiver.user_id] = result
        #         message = Message(sender=sender,
        #                           receiver=receiver,
        #                           original_text=result['original_text'],
        #                           time_gap=time_gap,
        #                           message_id=message_id)
        #         message.add_translation(language=receiver.language, text=result['translated_text'])
        #         room.add_message(message)
    # return translation_results


def time_log(text: str, time_checkpoint: float, spaces: int = 35):
    print(f'{text: <{spaces}}:', time.time() - time_checkpoint)
