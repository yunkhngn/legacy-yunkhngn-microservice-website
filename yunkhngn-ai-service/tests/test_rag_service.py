import pytest
import numpy as np
import sys
import types

chromadb_module = sys.modules.setdefault("chromadb", types.ModuleType("chromadb"))
chromadb_config_module = sys.modules.setdefault(
    "chromadb.config", types.ModuleType("chromadb.config")
)
setattr(chromadb_config_module, "Settings", lambda **kwargs: kwargs)
setattr(
    chromadb_module,
    "PersistentClient",
    lambda *args, **kwargs: types.SimpleNamespace(
        get_or_create_collection=lambda name: types.SimpleNamespace()
    ),
)
google_module = sys.modules.setdefault("google", types.ModuleType("google"))
genai_module = sys.modules.setdefault("google.genai", types.ModuleType("google.genai"))
setattr(google_module, "genai", genai_module)

from app.services.rag_service import RAGService


class TestDeduplicateResults:
    """Test the static dedup logic without needing ChromaDB or embeddings."""

    def test_dedup_limits_per_document(self):
        """Max 2 chunks per unique doc_id."""
        raw_results = [
            {"id": "know_1_0", "score": 0.5, "metadata": {"doc_id": "1", "doc_type": "knowledge"}, "content": "chunk A"},
            {"id": "know_1_1", "score": 0.6, "metadata": {"doc_id": "1", "doc_type": "knowledge"}, "content": "chunk B"},
            {"id": "know_1_2", "score": 0.7, "metadata": {"doc_id": "1", "doc_type": "knowledge"}, "content": "chunk C"},
            {"id": "know_2_0", "score": 0.8, "metadata": {"doc_id": "2", "doc_type": "knowledge"}, "content": "chunk D"},
        ]
        deduped = RAGService.deduplicate_results(raw_results, max_per_doc=2)
        # doc_id "1" should have at most 2 chunks
        doc1_chunks = [r for r in deduped if r["metadata"]["doc_id"] == "1"]
        assert len(doc1_chunks) == 2
        # doc_id "2" should still be present
        doc2_chunks = [r for r in deduped if r["metadata"]["doc_id"] == "2"]
        assert len(doc2_chunks) == 1
        # Total should be 3
        assert len(deduped) == 3

    def test_dedup_preserves_order(self):
        """Results should stay sorted by score (ascending = closest)."""
        raw_results = [
            {"id": "a_1_0", "score": 0.3, "metadata": {"doc_id": "1"}, "content": "best"},
            {"id": "a_2_0", "score": 0.5, "metadata": {"doc_id": "2"}, "content": "good"},
            {"id": "a_1_1", "score": 0.6, "metadata": {"doc_id": "1"}, "content": "ok"},
        ]
        deduped = RAGService.deduplicate_results(raw_results, max_per_doc=2)
        scores = [r["score"] for r in deduped]
        assert scores == sorted(scores)

    def test_dedup_empty_list(self):
        assert RAGService.deduplicate_results([], max_per_doc=2) == []

    def test_dedup_all_different_docs(self):
        raw_results = [
            {"id": "a_1_0", "score": 0.3, "metadata": {"doc_id": "1"}, "content": "a"},
            {"id": "a_2_0", "score": 0.5, "metadata": {"doc_id": "2"}, "content": "b"},
            {"id": "a_3_0", "score": 0.7, "metadata": {"doc_id": "3"}, "content": "c"},
        ]
        deduped = RAGService.deduplicate_results(raw_results, max_per_doc=2)
        assert len(deduped) == 3


class FakeCollection:
    def get(self, ids, include):
        return {
            "ids": ids,
            "embeddings": np.array([[0.1, 0.2, 0.3]]),
            "documents": ["source"],
        }

    def query(self, query_embeddings, n_results, where):
        return {
            "ids": [["blog_current_0", "blog_other_0"]],
            "metadatas": [[
                {"doc_id": "current", "doc_type": "blog", "title": "Current"},
                {"doc_id": "other", "doc_type": "blog", "title": "Other", "slug": "other"},
            ]],
            "distances": [[0.0, 0.42]],
        }


@pytest.mark.asyncio
async def test_find_similar_accepts_numpy_embeddings_from_chroma():
    service = object.__new__(RAGService)
    service.collection = FakeCollection()

    results = await service.find_similar("blog", "current", top_k=1)

    assert results == [
        {
            "doc_id": "other",
            "doc_type": "blog",
            "score": 0.42,
            "title": "Other",
            "slug": "other",
        }
    ]
