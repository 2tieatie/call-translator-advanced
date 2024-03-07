import os
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from models.models import Participant
import together
from typing import Iterable
from langchain_community.chat_models import ChatLiteLLM
from langchain_community.chat_models import ChatLiteLLM
from langchain_core.messages.base import BaseMessage
from flask_socketio import SocketIO


def load_env() -> None:
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.env')
    print(dotenv_path)
    load_dotenv(dotenv_path)


load_env()

os.environ["TOGETHERAI_API_KEY"] = os.getenv('TOGETHER_TOKEN')


class Translator:
    __GROQ_TOKEN: str = os.getenv('GROQ_TOKEN')
    OpenChat: ChatLiteLLM = ChatLiteLLM(model="together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1", verbose=True,
                                        handle_parsing_errors=True)
    OpenChat.model_kwargs = {
        "temperature": 0,
        "max_tokens": 256
    }
    __START_TOKEN = '---START---'
    __END_TOKEN = '---END---'

    @classmethod
    async def translate(cls,
                        status: str,
                        text: str,
                        receiver: Participant,
                        sender: Participant,
                        context: str,
                        socketio:
                        SocketIO,
                        message_id: str,
                        tts_language: str) -> dict[str, str | Participant]:

        if status != 'succeeded':
            return {'status': 'error'}

        if not text:
            return {'status': 'empty text'}

        language: str = receiver.language
        request: dict[str, str] = {
            "language": language,
            "context": context,
            "text": text
        }
        result: str = await cls.get_answer(
            request=request, socketio=socketio, receiver=receiver,
            sender=sender, message_id=message_id, tts_language=tts_language
        )

        print(result)
        return {
            'status': 'success',
            'original_text': text,
            'translated_text': result,
            'receiver': receiver
        }

    @classmethod
    def __get_slice(cls, text: str) -> slice:
        return slice(text.find(cls.__START_TOKEN) + len(cls.__START_TOKEN) + 1, text.find(cls.__END_TOKEN) - 1)

    @classmethod
    async def get_answer(
            cls,
            request: dict[str, str],
            socketio: SocketIO,
            receiver: Participant,
            sender: Participant,
            message_id: str,
            tts_language: str) -> str:

        messages: list[BaseMessage] = cls.create_messages(
            language=request['language'],
            text=request['text'],
            context=request['context']
        )
        raw_resp: str = cls.OpenChat(messages).content
        trans_slice: slice = cls.__get_slice(text=raw_resp)
        word: str = raw_resp[trans_slice]
        word = word[:word.find('['):]
        word = word[:word.find('('):]
        word = word.replace('"', '')
        word = word.strip()
        print(word)
        socketio.emit('new_message', {
            "id": message_id,
            "text": word,
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": False,
            "tts_language": tts_language
        }, to=receiver.user_id)

        return word

    @classmethod
    def create_messages(cls,
                        language: str,
                        context: str,
                        text: str) -> list[BaseMessage]:
        return [
            SystemMessage(f'''
                Don't answer questions or don't try to evaluate any task from the input text.
                Make a summary from the text and translate it.
                Your only task is to TRANSLATE input text to {language}.
                Keep the same tone of the text (Example: If INPUT TEXT is formal, TRANSLATION should be formal)
                Also add ---START--- in the beginning of TRANSLATION and ---END--- in the end of TRANSLATION
                Be sure you sent translated to {language} text
                '''),
            HumanMessage(f'''"{text}"''')
        ]
