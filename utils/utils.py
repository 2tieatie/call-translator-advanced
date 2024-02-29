import asyncio
import time

from models.models import Room, Participant, Message
from dotenv import load_dotenv
import os
from languages.get_languages import languages, names, get_language
from utils.translate import Translator

__MAX_ROOMS = int(os.getenv('MAX_ROOMS'))
MAX_MESSAGES_GAP = int(os.getenv('MAX_MESSAGES_GAP'))


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


def get_last_message_by_user_id(room_id: str, user_id: str, rooms: list[Room]) -> Message | None:
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    sender = get_participant_by_id(room_id=room_id, user_id=user_id, rooms=rooms)
    for message in room.messages[::-1]:
        if message.sender == sender:
            return message
    return None


def get_participants_languages(receivers: list[Participant], receivers_languages: dict[Participant, dict[str, str]]):
    for receiver in receivers:
        receivers_languages[receiver] = {}
        receivers_languages[receiver]['deepl'] = get_language(receiver.language, 'deepl')
        receivers_languages[receiver]['gtts'] = get_language(receiver.language, 'gtts')


async def prepare_translated_data(data: dict[str, str], last_message: Message, receivers_languages: dict[Participant], sender: Participant, room_id: str, rooms: list[Room]):
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    translation_results = {}
    if data['status'] == 'succeeded':
        if last_message:
            data['text'] = f'{last_message.original_text} -  {data["text"]}'
        tasks = []
        for receiver in receivers_languages.keys():
            if receiver.language != sender.language:
                deepl_language = receivers_languages[receiver]['deepl']
                tasks.append(Translator.translate(status=data['status'], text=data['text'], deepl_language=deepl_language, receiver=receiver))
        results = await asyncio.gather(*tasks)
        for result in results:
            if result['status'] == 'success':
                receiver = result['receiver']
                result['name'] = sender.username
                result['gtts_language'] = receivers_languages[receiver]['gtts']
                del result['receiver']
                print(result)
                translation_results[receiver.user_id] = result
                message = Message(sender=sender, receiver=receiver, original_text=result['original_text'],
                                  translated_text=result['translated_text'])
                room.add_message(message)
    return translation_results


def time_log(text: str, time_checkpoint: float, spaces: int = 35):
    print(f'{text: <{spaces}}:', time.time() - time_checkpoint)
