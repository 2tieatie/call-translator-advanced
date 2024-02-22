from models.models import Room, Participant, Message
from dotenv import load_dotenv
import os


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
            message_data_str = f'From: {message.sender.username}\n'\
                               f'To: {message.receiver.username}\n'\
                               f'Original text ({message.sender.language}): {message.original_text}\n'\
                               f'Translated text ({message.receiver.language}): {message.translated_text}'
            result += f'{'-' * 100}\n{message_data_str}'
    return result


def get_last_message_by_user_id(room_id: str, user_id: str, rooms: list[Room]) -> Message | None:
    room = get_room_by_id(room_id=room_id, rooms=rooms)
    sender = get_participant_by_id(room_id=room_id, user_id=user_id, rooms=rooms)
    for message in room.messages[::-1]:
        if message.sender == sender:
            return message
    return None

