import os
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from models.models import Participant
from langchain_community.chat_models import ChatLiteLLM
from langchain_core.messages.base import BaseMessage


def load_env() -> None:
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.env')
    load_dotenv(dotenv_path)


load_env()

os.environ["TOGETHERAI_API_KEY"] = os.getenv('TOGETHER_TOKEN')


class Translator:
    OpenChat: ChatLiteLLM = ChatLiteLLM(model="together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1",
                                        verbose=True,
                                        handle_parsing_errors=False,
                                        temperature=0)

    OpenChat.model_kwargs = {
        "max_tokens": 1024
    }

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

        data: dict[str, str | bool] = cls.get_answer(
            messages=messages,
            sender=sender,
            receiver=receiver
        )
        print('Prev Trans:', prev_trans)

        data['text'] = f'{prev_trans if prev_trans else ""}{data['text']}'

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
    def get_answer(
            cls,
            messages: list[BaseMessage],
            sender: Participant,
            receiver: Participant
    ) -> dict[str, str | bool]:

        response: str = cls.OpenChat(messages).content
        print('*' * 99)
        print('RAW:', response)
        print('*' * 99)
        response = response[response.find('Translation') + 13::]
        response = response.strip()

        for sign in ['[', '(', '\n', '\\']:
            if sign in response:
                response = response[:response.find(sign):]

        for sign in ['"', "'", '.', '*']:
            response = response.replace(sign, '')

        response = response.strip() + ' '
        print('Translated:', response)
        data: dict[str, str | bool] = {
            "text": response,
            "type": "part",
            "local": False,
            "name": sender.username,
            "original": False,
            "receiver": receiver.user_id
        }

        return data

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
            Follow every task which user gives you STRICTLY. Only high quality Translations
            '''),
            HumanMessage(f'''
            Your task is to translate a small part of a Speech Transcription from {language_from} to {language_to}. 
            Start your Translation always with “Translation :”. 
            Don’t say anything else except the translation. Translate into {language_to}. 
            Translate as if you are a native speaker.

            {part}

            Here is the part of a Speech Transcription: {text}
            ''')
        ]

        return messages
