import json
import logging

logger = logging.getLogger(__name__)


class ContentProcessor:
    """Processes content for optimal embedding quality.
    
    Detects JSON content and converts it to natural language
    so that embedding models (trained on prose) can understand it better.
    """

    def prepare_for_embedding(self, title: str, content: str) -> str:
        """Prepare content for embedding by flattening JSON if detected.
        
        Args:
            title: The document title (always kept as-is).
            content: The document content, may be JSON or plain text.
            
        Returns:
            A string optimized for embedding: title + flattened content.
        """
        if not content or not content.strip():
            return f"{title}\n\n{content}"

        try:
            data = json.loads(content)
            # It's valid JSON — flatten it to natural language
            flat_text = self.flatten_json(data)
            return f"{title}\n\n{flat_text}"
        except (json.JSONDecodeError, ValueError):
            # Not JSON — return as-is
            return f"{title}\n\n{content}"

    def flatten_json(self, obj, prefix: str = "") -> str:
        """Recursively flatten a JSON object into readable natural-language lines.
        
        Examples:
            {"health_risk": ["shrimp", "crab"]} -> "health risk: shrimp, crab"
            {"name": "Khoa", "age": 20}         -> "name: Khoa\nage: 20"
        """
        lines = []

        if isinstance(obj, dict):
            for key, value in obj.items():
                label = key.replace("_", " ")
                full_label = f"{prefix}{label}" if prefix else label

                if isinstance(value, (str, int, float, bool)):
                    lines.append(f"{full_label}: {value}")
                elif isinstance(value, list):
                    lines.append(self._flatten_list(full_label, value))
                elif isinstance(value, dict):
                    lines.append(f"{full_label}:")
                    lines.append(self.flatten_json(value, prefix="  "))
                elif value is None:
                    lines.append(f"{full_label}: none")
        elif isinstance(obj, list):
            lines.append(self._flatten_list(prefix.strip() if prefix else "", obj))

        return "\n".join(line for line in lines if line)

    def _flatten_list(self, label: str, items: list) -> str:
        """Flatten a list into a comma-separated line.
        
        Handles lists of primitives and lists of dicts.
        """
        flat_items = []
        nested_lines = []

        for item in items:
            if isinstance(item, dict):
                nested_lines.append(self.flatten_json(item, prefix="  "))
            elif isinstance(item, list):
                flat_items.append(", ".join(str(i) for i in item))
            else:
                flat_items.append(str(item))

        result_parts = []
        if flat_items:
            items_str = ", ".join(flat_items)
            if label:
                result_parts.append(f"{label}: {items_str}")
            else:
                result_parts.append(items_str)
        if nested_lines:
            if label and not flat_items:
                result_parts.append(f"{label}:")
            result_parts.extend(nested_lines)

        return "\n".join(result_parts)
