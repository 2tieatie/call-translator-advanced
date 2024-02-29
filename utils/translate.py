import asyncio
import io
import sys
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

from models.models import Participant


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
    deepl_translator = deepl.Translator(DEEPL_TOKEN)

    @classmethod
    def recognize_speech(cls, audio_bytes, language: str, first_checkpoint: int) -> dict[str, str]:
        audio_data = decode_audio_to_webm(audio_bytes)
        print(f"{'Decoded audio': <35}:", time.time() - first_checkpoint)
        # with open(f'utils/recordings/{time.time()}.webm', 'wb') as file:
        #     file.write(audio_data)
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
    async def translate(cls, status: str, text: str, deepl_language: str, receiver: Participant, context: str) -> dict[str, str | Participant]:
        if status != 'succeeded':
            return {'status': 'error'}

        if not text:
            return {'status': 'empty text'}
        translator = deepl.Translator(cls.DEEPL_TOKEN)
        result = await asyncio.to_thread(translator.translate_text, text=text, target_lang=deepl_language, context=context)
        return {'status': 'success', 'original_text': text,
                'translated_text': result.text, 'receiver': receiver}

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
    print(f"{'Audio bytes size': <35}:", sys.getsizeof(webm_data), "bytes")
    return webm_data.getvalue()
