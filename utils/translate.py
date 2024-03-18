import asyncio
import base64
import json
import os
import queue
import re

import requests
import websockets
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from models.models import Participant
from langchain_community.chat_models import ChatLiteLLM
from langchain_core.messages.base import BaseMessage
from languages.get_languages import get_language


def load_env() -> None:
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.env')
    load_dotenv(dotenv_path)


load_env()
ELEVEN_API_TOKEN = os.getenv('ELEVEN_TOKEN')
os.environ["TOGETHERAI_API_KEY"] = os.getenv('TOGETHER_TOKEN')



class Translator:
    OpenChat: ChatLiteLLM = ChatLiteLLM(model="together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1",
                                        verbose=True,
                                        handle_parsing_errors=False,
                                        temperature=0)

    OpenChat.model_kwargs = {
        "max_tokens": 1024
    }
    # url = "https://api.elevenlabs.io/v1/text-to-speech/IKne3meq5aSn9XLyUdCD"
    ELEVEN_MODEL_ID = "eleven_multilingual_v2"
    headers = {
        "xi-api-key": ELEVEN_API_TOKEN,
        "Content-Type": "application/json"
    }
    VOICE_ID = 'IKne3meq5aSn9XLyUdCD'
    first_request = json.dumps({
        "text": " ",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "use_speaker_boost": False},
        "generation_config": {
            "chunk_length_schedule": [120, 160, 250, 290]
        },
        "xi_api_key": ELEVEN_API_TOKEN,
    })

    @classmethod
    def translate(
            cls,
            receiver: Participant,
            sender: Participant,
            text: str,
            results: list[dict[str, str | Participant]],
            first_message: bool,
            prev_trans: str,
            prev_orig: str
    ) -> None:
        print('*' * 99)

        language_from = sender.language
        language_to = receiver.language

        messages: list[BaseMessage] = cls.__make_messages(
            language_from=language_from,
            language_to=language_to,
            prev_mess=prev_orig,
            prev_trans=prev_trans,
            text=text,
            first_message=first_message
        )

        data: dict[str, str | bool] = cls.get_answer(messages=messages, sender=sender, receiver=receiver)
        print('Text:', text)

        translated_text = f'{prev_trans if prev_trans else ""}{data['text']}'

        results.append(
            {
                'status': 'success',
                'original_text': text,
                'translated_text': translated_text,
                'receiver': receiver,
                'data': data
            }
        )

    @classmethod
    def get_answer(
            cls,
            messages: list[BaseMessage],
            sender: Participant,
            receiver: Participant
    ) -> dict[str, str | bool]:
        # result: str = ''

        # for response in cls.stream_response(messages=messages):
        #     result += response

        tts_lang = get_language(receiver.language, 'gtts')
        result: dict[str, bytes | str] = asyncio.run(cls.get_audio(messages=messages))

        data: dict[str, str | bool] = {
            "text": result['text'],
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": False,
            "receiver": receiver.user_id,
            "tts_language": tts_lang,
            "audio": result['audio']
        }

        return data

    @classmethod
    def stream_response(cls, messages: list[BaseMessage]):
        result = prev = ''
        passed_trans = False
        for chunk in cls.OpenChat.stream(messages):
            part = chunk.content
            if any(sign in part for sign in ['[', '(', '\n', '\\', '/']):
                break
            if passed_trans:
                part = re.sub(r'[^\w\s]', '', part)
            result += part
            if 'Trans: ' in result:
                result = result.replace('Trans:', '')
                passed_trans = True
            if passed_trans:
                res = result.replace(prev, '')
                if res:
                    yield res
            prev = result

    @classmethod
    async def get_audio(cls, messages: list[BaseMessage]) -> dict[str, bytes | str]:
        uri: str = f"wss://api.elevenlabs.io/v1/text-to-speech/{cls.VOICE_ID}/stream-input?model_id=eleven_turbo_v2"

        answer: str = ''

        async with websockets.connect(uri) as websocket:
            await websocket.send(cls.first_request)

            async def listen() -> bytes:
                audio_chunks: list[bytes] = []
                received_final_chunk: bool = False
                while not received_final_chunk:
                    try:
                        message = await websocket.recv()
                        data = json.loads(message)
                        if data.get("audio"):
                            audio_chunks.append(base64.b64decode(data["audio"]))
                        if data.get('isFinal'):
                            received_final_chunk = True
                            break
                    except websockets.exceptions.ConnectionClosed:
                        break

                return b''.join(audio_chunks)

            for text in cls.stream_response(messages=messages):
                answer += text
                await websocket.send(json.dumps({"text": text}))

            audio: bytes = await listen()

            result: dict[str, bytes | str] = {
                'audio': audio,
                'text': answer
            }

            return result

    @staticmethod
    def __make_messages(
            language_from: str,
            language_to: str,
            prev_mess: str,
            prev_trans: str,
            text: str,
            first_message: bool
    ) -> list[BaseMessage]:

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
            Follow every task which user gives you STRICTLY. Only high quality Translations. SEND ONLY TRANSLATED PART!
            '''),
            HumanMessage(f'''
            Your task is to translate a small part of a Speech Transcription from {language_from} to {language_to}. 
            Start your Translation always with “Trans:”. 
            Don’t say anything else except the translation. Translate into {language_to}. 
            Translate as if you are a native speaker.

            {part}

            Here is the part of a Speech Transcription: {text}
            ''')
        ]

        return messages


