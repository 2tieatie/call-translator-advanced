import io
import time
import wave
from io import BytesIO
import deepl
import os

import ffmpeg
import numpy as np
from dotenv import load_dotenv
from gtts import gTTS
from deepgram import DeepgramClient, DeepgramClientOptions, PrerecordedOptions
from pydub import AudioSegment


def load_env():
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.env')
    print(dotenv_path)
    load_dotenv(dotenv_path)


load_env()


class Translator:
    LLM_TOKEN = os.getenv('LLM_TOKEN')
    DEEPL_TOKEN = os.getenv('DEEPL_TOKEN')
    DEEPGRAM_TOKEN = os.getenv('DEEPGRAM_TOKEN')
    deepgram = DeepgramClient(api_key=DEEPGRAM_TOKEN)
    MIMETYPE = 'webm'
    options = PrerecordedOptions(
        model="nova-2",
        smart_format=True,
        language='ru',
        filler_words=False,
    )

    @classmethod
    def recognize_speech(cls, audio_bytes, language: str) -> dict[str, str]:
        audio_data = decode_audio_to_webm(audio_bytes)
        with open(f'utils/recordings/{time.time()}.webm', 'wb') as file:
            file.write(audio_data)
        # audio_segment = AudioSegment.from_file(audio_data.getvalue(), format=cls.MIMETYPE)
        # if audio_segment.channels > 1:
        #     audio_bytes = audio_segment.set_channels(1)
        source = {"buffer": audio_data, "mimetype": 'audio/' + cls.MIMETYPE}
        try:
            cls.options.language = language
            res = cls.deepgram.listen.prerecorded.v("1").transcribe_file(source, cls.options)
            data = res.results.channels[0].alternatives[0]
            text = data.transcript
            if text:
                return {
                    'status': 'succeeded',
                    'text': text,
                }
            return {
                'status': 'no speech',
                'text': ''
            }
        except Exception as ex:
            return {
                'status': f'error {ex}',
                'text': '',
            }

    @classmethod
    def translate(cls, data: dict[str, str], deepl_language: str) -> object:
        status = data['status']
        if status != 'succeeded':
            return {'status': 'error'}

        if not data['text']:
            return {'status': 'empty text'}

        text = data['text']
        if not text:
            return {'status': 'empty text'}

        result = deepl.Translator(cls.DEEPL_TOKEN) \
            .translate_text(
            text=text, target_lang=deepl_language
        )
        return {'status': 'success', 'original_text': text.split('-')[-1].strip(),
                'translated_text': result.text.split('-')[-1].strip()}

    @classmethod
    def make_audio(cls, text: str, language='en'):
        tts = gTTS(text=text, lang=language)
        audio_stream = BytesIO()
        tts.write_to_fp(audio_stream)
        audio_stream.seek(0)
        return audio_stream.getvalue()


def decode_audio_to_webm(audio_data, sample_rate=48000, channels=1):
    audio_data = np.frombuffer(audio_data, dtype=np.float32)
    audio_data = (audio_data * (2 ** 15 - 1)).astype(np.int16)
    audio_segment = AudioSegment(
        audio_data.tobytes(),
        frame_rate=sample_rate,
        sample_width=2,
        channels=channels
    )
    webm_data = io.BytesIO()
    audio_segment.export(webm_data, format='webm')

    return webm_data.getvalue()
# import datetime
# import time
# from io import BytesIO
#
# import deepl
# import requests
# import os
# from dotenv import load_dotenv
# from gtts import gTTS
# from pydub import AudioSegment
# from deepgram import DeepgramClient, DeepgramClientOptions, PrerecordedOptions
#
#
#
# def load_env():
#     dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.env')
#     load_dotenv(dotenv_path)
#
#
# load_env()
#
#
# class Translator:
#     LLM_TOKEN = os.getenv('LLM_TOKEN')
#     DEEPL_TOKEN = os.getenv('DEEPL_TOKEN')
#     DEEPGRAM_TOKEN = os.getenv('DEEPGRAM_TOKEN')
#     deepgram = DeepgramClient(api_key=DEEPGRAM_TOKEN)
#     MIMETYPE = 'webm'
#     options = PrerecordedOptions(
#         model="nova-2",
#         smart_format=True,
#         language='ru'
#     )
#
#     @classmethod
#     def recognize_speech(cls, audio_bytes, language='ru', task='transcribe'):
#         audio_data = BytesIO(audio_bytes)
#         with open(f'utils/recordings/{time.time()}.webm', 'wb') as file:
#             file.write(audio_data.getvalue())
#         # source = {"buffer": audio_bytes, "mimetype": 'audio/' + cls.MIMETYPE}
#         # try:
#         #     cls.options.language = language
#         #     res = cls.deepgram.listen.prerecorded.v("1").transcribe_file(source, cls.options)
#         #     data = res.results.channels[0].alternatives[0]
#         #     text = data.transcript
#         #     confidence = data.confidence
#         #     print({
#         #         'status': 'succeeded',
#         #         'text': text,
#         #     })
#         #     return {
#         #         'status': 'succeeded',
#         #         'text': text,
#         #     }
#         # except Exception as ex:
#         #     return {
#         #         'status': f'error {ex}',
#         #         'text': [],
#         #     }
#
#         # url = 'https://api.deepinfra.com/v1/inference/openai/whisper-large'
#         # headers = {
#         #     "Authorization": f"bearer {cls.LLM_TOKEN}"
#         # }
#         # files = {
#         #     'audio': ('my_voice.mp3', audio_bytes)
#         # }
#         # data = {
#         #     'language': language,
#         #     'task': task,
#         #     'temperature': 0.1,
#         #     'no_speech_threshold': 0.6,
#         # }
#         # response = requests.post(url, headers=headers, files=files, data=data)
#         # result = response.json()
#         # if result.get('detail'):
#         #     if result.get('detail').get('error'):
#         #         return {
#         #             'status': 'error',
#         #         }
#         #
#         # print(result)
#         return {
#             'status': 'succeeded',
#             'text': 'ффффф',
#         }
#
#         # return {
#         #     'status': result['inference_status']['status'],
#         #     'text': result['text'],
#         #     'language': result['language'],
#         #     'segments': result['segments'],
#         # }
#
#     @classmethod
#     def translate(cls, data, deepl_language: str) -> object:
#         # data = cls.recognize_speech(audio_bytes=audio_bytes, language=deepgram_language)
#         # status = data['status']
#         # if status != 'succeeded':
#         #     return {'status': 'error'}
#         #
#         # if not data['text']:
#         #     return {'status': 'empty text'}
#         #
#         # text = data['text']
#         # if not text:
#         #     return {'status': 'empty text'}
#         #
#         # result = deepl.Translator(cls.DEEPL_TOKEN) \
#         #     .translate_text(
#         #     text=text, target_lang=deepl_language
#         # )
#         return {'status': 'success', 'original_text': 'Hi!', 'translated_text': 'Привет!'}
#
#     @classmethod
#     def make_audio(cls, text: str, language='en'):
#         tts = gTTS(text=text, lang=language)
#         audio_stream = BytesIO()
#         tts.write_to_fp(audio_stream)
#         audio_stream.seek(0)
#         return audio_stream.getvalue()
#
