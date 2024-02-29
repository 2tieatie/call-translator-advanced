class Participant:
    def __init__(self, username: str, user_id: str, language: str):
        self.username: str = username
        self.user_id: str = user_id
        self.language: str = language

    def __str__(self):
        return f'Participant <id: {self.user_id}, username: {self.username}, language: {self.language}>'


class Message:
    def __init__(self, sender: Participant, receiver: Participant, original_text: str, translated_text: str, time_gap: float):
        self.sender: Participant = sender
        self.sender_language: str = sender.language
        self.receiver: Participant = receiver
        self.original_text: str = original_text
        self.translated_text: str = translated_text
        self.time_gap: float = time_gap

    def __str__(self):
        return f'Message <sender: {self.sender}, receiver: {self.receiver}, original text: {self.original_text}, translated text: {self.translated_text}>'


class Room:
    max_participants = 100

    def __init__(self, room_id: str, name: str):
        self.room_id: str = room_id
        self.name: str = name
        self.participants: list[Participant] = []
        self.messages: list[Message] = []
        self.__participants_count: int = 0
        self.languages: dict[str, list[Participant]] = dict()

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

    def __add_language(self, participant: Participant):
        if participant.language in self.languages.keys():
            self.languages[participant.language].append(participant)
        else:
            self.languages[participant.language] = [participant, ]

    def __str__(self):
        return f'Room <id: {self.room_id}, name: {self.name}, participants: {self.participants}, languages: {self.languages}>'
