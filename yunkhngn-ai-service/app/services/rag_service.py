import logging
import chromadb
from google import genai
from app.config import get_settings
import os

logger = logging.getLogger(__name__)

def _get_client(api_key: str | None = None):
    settings = get_settings()
    final_key = api_key or settings.gemini_api_key
    if not final_key:
        raise ValueError("GEMINI_API_KEY is missing")
    return genai.Client(api_key=final_key)

class RAGService:
    def __init__(self):
        self.settings = get_settings()
        # ChromaDB storage path
        self.persist_directory = os.path.join(os.getcwd(), "data", "chroma")
        os.makedirs(self.persist_directory, exist_ok=True)
        
        # Initialize ChromaDB persistent client
        self.chroma_client = chromadb.PersistentClient(path=self.persist_directory)
        self.collection = self.chroma_client.get_or_create_collection(name="website_content")
        self.embedding_model = "text-embedding-004"

    def chunk_text(self, text: str, max_chars: int = 2000, overlap: int = 200) -> list[str]:
        """
        Rough character-based chunking. 
        max_chars=2000 is approx 500 tokens (1 token ~ 4 chars).
        """
        chunks = []
        if not text:
            return chunks
            
        start = 0
        while start < len(text):
            end = start + max_chars
            chunks.append(text[start:end])
            start += max_chars - overlap
            if start >= len(text):
                break
        return chunks

    async def get_embedding(self, text: str, api_key: str | None = None) -> list[float]:
        client = _get_client(api_key)
        response = client.models.embed_content(
            model=self.embedding_model,
            contents=text
        )
        return response.embeddings[0].values

    async def index_document(self, doc_type: str, doc_id: str, text: str, metadata: dict = None, api_key: str | None = None):
        if metadata is None:
            metadata = {}
        
        chunks = self.chunk_text(text)
        
        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_type}_{doc_id}_{i}"
            embedding = await self.get_embedding(chunk, api_key)
            
            chunk_metadata = metadata.copy()
            chunk_metadata.update({
                "doc_type": doc_type,
                "doc_id": str(doc_id),
                "chunk_index": i,
                "original_id": str(doc_id)
            })
            
            # ChromaDB metadatas must be str, int, float, or bool
            # Ensure all metadata values are valid types
            cleaned_metadata = {}
            for k, v in chunk_metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    cleaned_metadata[k] = v
                else:
                    cleaned_metadata[k] = str(v)

            self.collection.upsert(
                ids=[chunk_id],
                embeddings=[embedding],
                metadatas=[cleaned_metadata],
                documents=[chunk]
            )
        logger.info(f"Indexed {len(chunks)} chunks for {doc_type} {doc_id}")

    async def search(self, query: str, top_k: int = 5, api_key: str | None = None) -> list[dict]:
        query_embedding = await self.get_embedding(query, api_key)
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        
        formatted_results = []
        if results['ids'] and len(results['ids']) > 0:
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "score": results['distances'][0][i] if 'distances' in results else None,
                    "metadata": results['metadatas'][0][i],
                    "content": results['documents'][0][i]
                })
        
        return formatted_results

rag_service = RAGService()
