import logging
import chromadb
from google import genai
from app.config import get_settings
import os
import json

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
        
        from chromadb.config import Settings
        # Initialize ChromaDB persistent client
        self.chroma_client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.chroma_client.get_or_create_collection(name="website_content")
        self.embedding_model = "gemini-embedding-2"
        
        from app.processors.content_processor import ContentProcessor
        self.content_processor = ContentProcessor()

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
        
        # Clean up old chunks first to avoid ghost data if the new version is shorter
        await self.delete_document(doc_type, doc_id)
        
        # Prepare content for embedding: flatten JSON to natural language
        title = metadata.get("title", "")
        embedding_text = self.content_processor.prepare_for_embedding(title, text) if title else text
        
        chunks = self.chunk_text(embedding_text)
        
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
        
        # Fetch more candidates than needed so dedup still has enough results
        fetch_k = top_k * 3
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=fetch_k
        )
        
        # Relaxed distance threshold for better recall
        # Gemini embedding L2 distances: <0.8 = very close, 0.8-1.2 = related, >1.5 = unrelated
        THRESHOLD = 1.4
        
        formatted_results = []
        if results['ids'] and len(results['ids']) > 0:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i] if 'distances' in results else 0
                if distance > THRESHOLD:
                    continue
                    
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "score": distance,
                    "metadata": results['metadatas'][0][i],
                    "content": results['documents'][0][i]
                })
        
        # Deduplicate: max 2 chunks per document for diversity
        deduped = self.deduplicate_results(formatted_results, max_per_doc=2)
        
        # Return top_k after dedup
        return deduped[:top_k]

    async def find_similar(self, doc_type: str, doc_id: str, top_k: int = 3, api_key: str | None = None) -> list[dict]:
        """
        Find documents similar to the given document by querying ChromaDB
        with the existing embedding of that document.
        """
        # Step 1: Get the existing embedding(s) for this document
        # We look for the first chunk (chunk_index=0) of this document
        chunk_id = f"{doc_type}_{doc_id}_0"
        
        try:
            existing = self.collection.get(
                ids=[chunk_id],
                include=["embeddings", "documents"]
            )
        except Exception as e:
            logger.error(f"Error fetching document {chunk_id}: {e}")
            return []
        
        if not existing["ids"] or not existing["embeddings"] or existing["embeddings"][0] is None or len(existing["embeddings"][0]) == 0:
            logger.warning(f"Document {chunk_id} not found in ChromaDB")
            return []
        
        # Step 2: Query ChromaDB with this embedding to find similar documents
        embedding = existing["embeddings"][0]
        
        # Fetch extra candidates to allow for dedup and self-exclusion
        fetch_k = (top_k + 1) * 3
        
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=fetch_k,
            where={"doc_type": doc_type}  # Only match same type (blog→blog, project→project)
        )

        # No absolute threshold here: we already constrain by doc_type and exclude self,
        # so the top_k nearest neighbours within the same type are the best suggestions
        # we have — even on a small corpus where absolute distances are large.
        formatted_results = []
        seen_doc_ids = set()

        if results['ids'] and len(results['ids']) > 0:
            for i in range(len(results['ids'][0])):
                metadata = results['metadatas'][0][i]
                result_doc_id = metadata.get("doc_id", "")
                distance = results['distances'][0][i] if 'distances' in results else 0

                if result_doc_id == doc_id:
                    continue

                if result_doc_id in seen_doc_ids:
                    continue

                seen_doc_ids.add(result_doc_id)
                formatted_results.append({
                    "doc_id": result_doc_id,
                    "doc_type": metadata.get("doc_type", doc_type),
                    "score": distance,
                    "title": metadata.get("title", ""),
                    "slug": metadata.get("slug", ""),
                })

                if len(formatted_results) >= top_k:
                    break

        return formatted_results

    @staticmethod
    def deduplicate_results(results: list[dict], max_per_doc: int = 2) -> list[dict]:
        """Limit chunks per document to ensure result diversity.
        
        Args:
            results: List of search results, assumed sorted by score (ascending).
            max_per_doc: Maximum number of chunks to keep per unique doc_id.
            
        Returns:
            Filtered list maintaining original order.
        """
        if not results:
            return []
            
        doc_counts: dict[str, int] = {}
        deduped = []
        
        for result in results:
            doc_id = result.get("metadata", {}).get("doc_id", result["id"])
            current_count = doc_counts.get(doc_id, 0)
            
            if current_count < max_per_doc:
                deduped.append(result)
                doc_counts[doc_id] = current_count + 1
        
        return deduped

    async def delete_document(self, doc_type: str, doc_id: str):
        """
        Delete all chunks belonging to a specific document.
        """
        try:
            # Delete by metadata filter
            self.collection.delete(
                where={
                    "$and": [
                        {"doc_type": doc_type},
                        {"doc_id": str(doc_id)}
                    ]
                }
            )
            logger.info(f"Deleted {doc_type} {doc_id} from RAG collection")
            return True
        except Exception as e:
            logger.error(f"Error deleting document from RAG: {e}")
            return False

rag_service = RAGService()
