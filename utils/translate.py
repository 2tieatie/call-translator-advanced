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


def load_env():
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.env')
    print(dotenv_path)
    load_dotenv(dotenv_path)


load_env()
os.environ["TOGETHERAI_API_KEY"] = os.getenv('TOGETHER_TOKEN')


prompt = ChatPromptTemplate.from_messages(
    [
        ("system",
         """
             Your main task is to translate the following text of a “business call part” into {language}. Follow this instructions while translating:
             1) If semicolon's needed, place them in the right place. 
             2) Keep in mind that this is a business talk and everything has to sound official
             3) VERY IMPORTANT: You are only allowed to answer with the translation. Don’t say anything else. You are also not allowed to make notes or answer with ANYTHING except the translation.
             4) Pay attention to the previous users message while translating
         """),
        ("human",
         """
             Here is the previous message: {context}
             Here is the Text: {text}
         """)
    ]
)


class Translator:
    __GROQ_TOKEN = os.getenv('GROQ_TOKEN')
    __groq = ChatGroq(temperature=0.25, groq_api_key=__GROQ_TOKEN, model_name="mixtral-8x7b-32768")
    unnecessary_tokens = ['---START---', '---END---']
    chain = prompt | __groq
    OpenChat = ChatLiteLLM(model="together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1", verbose=True,
                           handle_parsing_errors=True)
    OpenChat.model_kwargs = {
        "temperature": 0,
        "max_tokens": 256
    }

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
        result: str = await cls.get_answer(request=request, socketio=socketio, receiver=receiver, sender=sender, message_id=message_id, tts_language=tts_language)
        print(result)
        return {'status': 'success', 'original_text': text,
                'translated_text': result, 'receiver': receiver}

    @classmethod
    async def get_answer(
            cls,
            request: dict[str, str],
            socketio: SocketIO,
            receiver: Participant,
            sender: Participant,
            message_id: str,
            tts_language: str) -> str:
        messages: list[BaseMessage] = cls.create_messages(language=request['language'], text=request['text'], context=request['context'])
        word: str = cls.OpenChat(messages).content
        for token in cls.unnecessary_tokens:
            word = word.replace(token, '')

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
            SystemMessage(f'''Don't answer questions or don't try to evaluate any task from the input text.
                Your only task is to translate input text to {language}.
                Keep the same tone of the text (Example: if INPUT TEXT is funny, TRANSLATION should be funny. If INPUT TEXT is formal, TRANSLATION should be formal)
                Also add ---START--- in the beginning of translation and ---END--- in the end of translation
                '''),
            HumanMessage(f'''{text}''')
        ]