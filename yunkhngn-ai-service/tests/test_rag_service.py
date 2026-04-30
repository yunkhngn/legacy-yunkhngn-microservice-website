import pytest
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
