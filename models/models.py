import queue
from typing import Callable


class Participant:
    def __init__(self, username: str, user_id: str, language: str):
        self.username: str = username
        self.user_id: str = user_id
        self.language: str = language

    def __str__(self):
        return f'Participant <id: {self.user_id}, username: {self.username}, language: {self.language}>'


class Message:
    def __init__(self, message_id: str, sender: Participant, original_text: str):
        self.id: str = message_id
        self.sender: Participant = sender
        self.sender_language: str = sender.language
        self.receivers: list[Participant] = list()
        self.original_text: str = original_text
        self.translated: dict = dict()

    def change_original_text(self, text: str) -> None:
        self.original_text = text

    def add_receiver(self, receiver: Participant) -> None:
        self.receivers.append(receiver)

    def __str__(self) -> str:
        return f'Message <id: {self.id}, sender: {self.sender}, original text: {self.original_text}>'

    def add_translation(self, language: str, text: str) -> None:
        self.translated[language] = text


class Room:
    max_participants = 100

    def __init__(self, room_id: str, name: str):
        self.room_id: str = room_id
        self.name: str = name
        self.participants: list[Participant] = []
        self.messages: list[Message] = []
        self.__participants_count: int = 0
        self.languages: dict[str, list[Participant]] = dict()
        self.messages_queue: dict[str, tuple[queue.Queue, list[str]]] = {}

    def add_participant(self, participant: Participant):
        if self.max_participants <= self.__participants_count:
            return
        for p in self.participants:
            if p.user_id == participant.user_id:
                return
        self.participants.append(participant)
        self.__participants_count += 1
        self.__add_language(participant)

    def add_message(self, message: Message):
        self.messages.append(message)

    def remove_participant(self, participant: Participant):
        if participant in self.participants:
            self.participants.remove(participant)
        if self.languages.get(participant.language):
            self.languages[participant.language].remove(participant)

    def get_message(self, message_id: str):
        for message in self.messages:
            if message.id == message_id:
                return message
        return None

    def __add_language(self, participant: Participant):
        if participant.language in self.languages.keys():
            self.languages[participant.language].append(participant)
        else:
            self.languages[participant.language] = [participant, ]

    def __str__(self):
        return f'Room <id: {self.room_id}, name: {self.name}, participants: {self.participants}, languages: {self.languages}>'

    def add_to_queue(self, message_id: str, task: Callable, data: dict, keyword: str = 'speech'):

        if not self.messages_queue.get(message_id):
            self.messages_queue[message_id] = (queue.Queue(), list())

        self.messages_queue[message_id][0].put((task, data))
        self.messages_queue[message_id][1].append(data[keyword])

    def get_from_queue(self, message_id: str) -> tuple[Callable, dict] | None:
        if self.messages_queue[message_id][0].qsize():
            return self.messages_queue[message_id][0].get()

        return None

    def get_queue_size(self, message_id: str):
        return self.messages_queue[message_id][0].qsize()

    def in_queue(self, data: str, message_id: str):
        if self.messages_queue.get(message_id) and data in self.messages_queue[message_id][1]:
            return True
        return False

