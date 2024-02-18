
from langchain_openai import ChatOpenAI
from langchain_core import LangChain

class LLM:
    def __init__(self, langchain: LangChain, llm_model=ChatOpenAI(model="gpt-4")):
        self.langchain = langchain
        self.llm_model = llm_model
        self.langchain = LangChain()
        