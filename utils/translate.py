import os
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from models.models import Participant
from groq import AsyncGroq
from typing import Iterable

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
    client = AsyncGroq(api_key=__GROQ_TOKEN)
    chain = prompt | __groq

    @classmethod
    async def translate(cls, status: str, text: str, receiver: Participant, sender: Participant, context: str, socketio, message_id: str, tts_language: str) -> dict[
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
        result = await cls.get_answer(request, socketio, receiver, sender, message_id=message_id, tts_language=tts_language)
        print(result)
        return {'status': 'success', 'original_text': text,
                'translated_text': result, 'receiver': receiver}

    @classmethod
    async def get_answer(cls, request, socketio, receiver, sender, message_id: str, tts_language: str) -> str:
        word = ''
        result = ''
        messages = cls.create_messages(language=request['language'], text=request['text'], context=request['context'])
        stream = await cls.client.chat.completions.create(
            messages=messages,
            model="mixtral-8x7b-32768", temperature=0, max_tokens=1024, top_p=1, stop=None, stream=True
        )
        added_part = False
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            print(content)
            if not content:
                continue
            if '(' in content:
                break
            if content.endswith('.') or content.endswith('?') or content.endswith('!'):
                added_part = True
                word += content
                socketio.emit('new_message', {
                    "id": message_id,
                    "text": word,
                    "type": "part",
                    "local": False,
                    "name": sender.username,
                    "original": False,
                    "tts_language": tts_language
                }, to=receiver.user_id)
                word = ''
            if not added_part:
                word += content
            added_part = False
            result += content
        socketio.emit('new_message', {
            "id": message_id,
            "text": word,
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": False,
            "tts_language": tts_language
        }, to=receiver.user_id)
        return result

    @classmethod
    def create_messages(cls, language: str, context: str, text: str) -> Iterable:
        return [
            {
                "role": "system",
                "content": "You are a professional translator. STRICTLY follow every provided instruction."
            },
            {
                "role": "user",
                "content": 'Some Examples for your task: 1 Example (English): User Input: Я космонавт. Your Answer: I am astronaut.'}
            ,
            {
                "role": "user",
                "content": '2 Example (English): User Input: Hallo! Ich heisse Misha. Your Answer: Hello! My name is Misha.'
            },
            {
                "role": "user",
                "content": '3 Example (Russian): User Input: Establishing a robust online presence is imperative for modern businesses to thrive in a competitive market landscape. Your Answer: Создание надежного онлайн-присутствия необходимо для современных бизнесов, чтобы процветать в конкурентной рыночной среде.',
            },
            {
                'role': 'user',
                'content': f'''Your main task is to translate the following text of a “business call part” into {language}. Follow this instructions while translating:
                     1) If semicolon's needed, place them in the right place.
                     2) Keep in mind that this is a business talk and everything has to sound official
                     3) VERY IMPORTANT: You are only allowed to answer with the translation. Don’t say anything else. You are also not allowed to make notes or answer with ANYTHING except the translation.
                     4) Pay attention to the previous users message while translating
                     5) Do not greet me and do not explain translation
                     6) Do not respond as in mail format
                     7) You are forbidden to say 'Here is the translation of the provided text:'
                     8) You are not allowed to make any notes
                     Here is the previous message: {context}
                     Here is the Text: {text}'''
            }
        ]
