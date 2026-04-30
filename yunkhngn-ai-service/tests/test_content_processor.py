import pytest
from app.processors.content_processor import ContentProcessor


class TestFlattenJson:
    def test_flat_dict(self):
        processor = ContentProcessor()
        data = {"name": "Khoa", "age": 20}
        result = processor.flatten_json(data)
        assert "name: Khoa" in result
        assert "age: 20" in result

    def test_nested_dict(self):
        processor = ContentProcessor()
        data = {
            "food_profile": {
                "dislikes": {
                    "health_risk": ["shrimp", "crab", "shellfish"]
                }
            }
        }
        result = processor.flatten_json(data)
        assert "health risk" in result
        assert "shrimp" in result
        assert "crab" in result
        assert "shellfish" in result

    def test_list_values(self):
        processor = ContentProcessor()
        data = {"hobbies": ["guitar", "coding", "design"]}
        result = processor.flatten_json(data)
        assert "guitar" in result
        assert "coding" in result
        assert "design" in result

    def test_deeply_nested(self):
        processor = ContentProcessor()
        data = {
            "drinks": {
                "milk_tea": {
                    "preferences": ["matcha", "jasmine"],
                    "customization": {"ice": "50", "sugar": "100"}
                }
            }
        }
        result = processor.flatten_json(data)
        assert "matcha" in result
        assert "jasmine" in result
        assert "ice: 50" in result
        assert "sugar: 100" in result

    def test_list_of_dicts(self):
        processor = ContentProcessor()
        data = {
            "top_artists": [
                {"name": "Ngot", "weight": 48},
                {"name": "Ly Bric", "weight": 27}
            ]
        }
        result = processor.flatten_json(data)
        assert "Ngot" in result
        assert "Ly Bric" in result


class TestPrepareForEmbedding:
    def test_plain_text_passthrough(self):
        processor = ContentProcessor()
        result = processor.prepare_for_embedding("My Title", "This is plain text content.")
        assert result == "My Title\n\nThis is plain text content."

    def test_json_gets_flattened(self):
        processor = ContentProcessor()
        content = '{"health_risk": ["shrimp", "crab"]}'
        result = processor.prepare_for_embedding("Food Dislikes", content)
        assert "Food Dislikes" in result
        assert "health risk" in result
        assert "shrimp" in result
        assert "crab" in result
        # Should NOT contain raw JSON syntax
        assert '{"health_risk"' not in result

    def test_invalid_json_treated_as_text(self):
        processor = ContentProcessor()
        content = '{"broken": json'
        result = processor.prepare_for_embedding("Title", content)
        assert result == "Title\n\n{\"broken\": json"

    def test_json_array_root(self):
        processor = ContentProcessor()
        content = '["apple", "banana", "cherry"]'
        result = processor.prepare_for_embedding("Fruits", content)
        assert "apple" in result
        assert "banana" in result

    def test_empty_content(self):
        processor = ContentProcessor()
        result = processor.prepare_for_embedding("Title", "")
        assert result == "Title\n\n"
