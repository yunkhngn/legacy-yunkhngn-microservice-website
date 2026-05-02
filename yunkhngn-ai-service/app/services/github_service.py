import httpx
import logging
import re
from typing import Optional, Tuple
from app.config import get_settings

logger = logging.getLogger(__name__)

def parse_github_url(url: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract owner and repo from a GitHub URL."""
    # Pattern to match github.com/owner/repo
    pattern = r"github\.com/([^/]+)/([^/]+)"
    match = re.search(pattern, url)
    if match:
        owner, repo = match.groups()
        # Remove trailing slash if present
        if repo.endswith("/"):
            repo = repo[:-1]
        # Remove .git suffix if present
        if repo.endswith(".git"):
            repo = repo[:-4]
        # Handle cases like github.com/owner/repo/blob/main/README.md
        if "/" in repo:
            repo = repo.split("/")[0]
        return owner, repo
    return None, None

async def get_github_data(url: str) -> Tuple[Optional[str], Optional[str]]:
    """Fetch README and repository structure."""
    owner, repo = parse_github_url(url)
    if not owner or not repo:
        return None, None

    settings = get_settings()
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "yunkhngn-ai-service"
    }
    if settings.github_token:
        headers["Authorization"] = f"token {settings.github_token}"

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Fetch README
        readme_content = ""
        try:
            # Use the README endpoint which handles common README names automatically
            readme_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers={**headers, "Accept": "application/vnd.github.raw"}
            )
            if readme_resp.status_code == 200:
                readme_content = readme_resp.text
            else:
                logger.warning(f"Failed to fetch README for {owner}/{repo}: {readme_resp.status_code}")
        except Exception as e:
            logger.error(f"Error fetching README: {e}")

        # 2. Fetch Structure (top level)
        structure_text = ""
        try:
            tree_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/contents",
                headers=headers
            )
            if tree_resp.status_code == 200:
                contents = tree_resp.json()
                if isinstance(contents, list):
                    structure_text = "\n".join([
                        f"- {item['name']}{'/' if item['type'] == 'dir' else ''}"
                        for item in contents
                    ])
            else:
                logger.warning(f"Failed to fetch structure for {owner}/{repo}: {tree_resp.status_code}")
        except Exception as e:
            logger.error(f"Error fetching structure: {e}")

        return readme_content, structure_text
