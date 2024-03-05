import asyncio
import io
import sys
import time
import uuid

import deepl
import os
import numpy as np
from dotenv import load_dotenv
from deepgram import DeepgramClient, PrerecordedOptions
from pydub import AudioSegment
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from models.models import Participant


def load_env():
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.env')
    print(dotenv_path)
    load_dotenv(dotenv_path)


load_env()

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
    chain = prompt | __groq

    @classmethod
    async def translate(cls, status: str, text: str, receiver: Participant, sender: Participant, context: str, socketio) -> dict[
        str, str | Participant]:
        if status != 'succeeded':
            return {'status': 'error'}

        if not text:
            return {'status': 'empty text'}

        language = receiver.language
        request = {
            "language": language,
            "context": context,
            "text": text
        }
        result = await cls.get_answer(request, socketio, receiver, sender, original_text=text)
        print(result)
        return {'status': 'success', 'original_text': text,
                'translated_text': result, 'receiver': receiver}

    @classmethod
    async def get_answer(cls, request, socketio, receiver, sender, original_text) -> str:
        word = ''
        result = ''
        message_id = str(uuid.uuid4())
        socketio.emit('new_message', {
            "id": message_id,
            "text": original_text,
            "type": "start",
            "local": False,
            "name": sender.username
        }, to=receiver.user_id)
        async for chunk in cls.chain.astream(request):
            content = chunk.content
            if content.startswith(' '):
                socketio.emit('new_message', {
                    "id": message_id,
                    "text": word,
                    "type": "part",
                    "local": False,
                    "name": sender.username
                }, to=receiver.user_id)
                word = ''
            word += content
            result += content
        socketio.emit('new_message', {
            "id": message_id,
            "text": word,
            "type": "part",
            "local": False,
            "name": sender.username
        }, to=receiver.user_id)
        return result
