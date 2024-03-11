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
    OpenChat: ChatLiteLLM = ChatLiteLLM(model="together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1",
                                        verbose=True,
                                        handle_parsing_errors=True)
    OpenChat.model_kwargs = {
        "temperature": 0,
        "max_tokens": 256
    }
    __START_TOKEN = '---START---'
    __END_TOKEN = '---END---'

    @classmethod
    def translate(cls,
                  receiver: Participant,
                  sender: Participant,
                  text: str,
                  results: list[dict[str, str | Participant]],
                  first_message: bool,
                  prev_trans: str,
                  prev_orig: str) -> None:

        language_from = sender.language
        language_to = receiver.language

        request: dict[str, str] = {
            "language_to": language_to,
            "language_from": language_from,
            "text": text,
            "prev_trans": prev_trans,
            "prev_orig": prev_orig,
            "first_message": first_message
        }
        data: dict[str, str | bool] = cls.get_answer(
            request=request,
            sender=sender,
            receiver=receiver
        )

        results.append(
            {
                'status': 'success',
                'original_text': text,
                'translated_text': data['text'],
                'receiver': receiver,
                'data': data
            }
        )

    @classmethod
    def __get_slice(cls, text: str) -> slice:
        return slice(text.find(cls.__START_TOKEN) + len(cls.__START_TOKEN) + 1, text.find(cls.__END_TOKEN))

    @classmethod
    def get_answer(
            cls,
            request: dict[str, str],
            sender: Participant,
            receiver: Participant
    ) -> dict[str, str | bool]:

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
        data: dict[str, str | bool] = {
            "text": word,
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": False,
            "receiver": receiver.user_id
        }
        return data

    @classmethod
    def make_messages(prev_mess: str, prev_trans: str, text: str, first_message: bool):
        part = ''
        if not first_message:
            part = f'''
            Here is the previous part of the message:
            {prev_mess}

            Here is your previous translation:
            {prev_trans}
            '''

        messages = [
            SystemMessage(f'''
            Follow every task which user gives you STRICTLY. Only high quality Translations
            '''),
            HumanMessage(f'''
            Your task is to translate a small part of a Speech Transcripton from {language_from} to {language_to}. 
            Start your Translation always with “Translation :”. 
            Don’t say anything else except the translation. Translate into {language_to}. 
            Translate as if you are a native speaker.

            {part}

            Here is the part of a Speech Transcription: {text}
            ''')
        ]
        return messages
