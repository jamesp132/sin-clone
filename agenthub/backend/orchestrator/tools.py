"""Tool executor for agent capabilities — web search, code execution, file I/O."""

import os
import re
import subprocess
import logging
from typing import Dict, Any, Optional

import httpx

from config import WORKSPACE_PATH

logger = logging.getLogger(__name__)

# Path traversal prevention
ALLOWED_ROOT = os.path.abspath(WORKSPACE_PATH)


def _sanitize_path(path: str) -> str:
    """Resolve and validate a file path to prevent directory traversal.

    Args:
        path: The requested file path.

    Returns:
        Absolute, sanitized path within the workspace.

    Raises:
        ValueError: If the path escapes the workspace root.
    """
    if not path:
        raise ValueError("Path cannot be empty")

    # Resolve relative to workspace
    if not os.path.isabs(path):
        resolved = os.path.abspath(os.path.join(ALLOWED_ROOT, path))
    else:
        resolved = os.path.abspath(path)

    if not resolved.startswith(ALLOWED_ROOT):
        raise ValueError(
            f"Path '{path}' resolves outside the workspace. "
            f"All file operations must stay within {ALLOWED_ROOT}"
        )
    return resolved


class ToolExecutor:
    """Executes tools on behalf of agents."""

    def __init__(self) -> None:
        os.makedirs(ALLOWED_ROOT, exist_ok=True)

    async def web_search(self, query: str) -> Dict[str, Any]:
        """Search the web using a search API.

        Args:
            query: Search query string.

        Returns:
            Dict with results list or error.
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Use DuckDuckGo HTML search as a free fallback
                response = await client.get(
                    "https://html.duckduckgo.com/html/",
                    params={"q": query},
                    headers={"User-Agent": "AgentHub/1.0"},
                )
                response.raise_for_status()

                # Extract basic results from HTML
                results = []
                # Simple regex extraction from DDG HTML results
                links = re.findall(
                    r'<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.+?)</a>',
                    response.text,
                )
                snippets = re.findall(
                    r'<a class="result__snippet"[^>]*>(.+?)</a>',
                    response.text,
                )

                for i, (url, title) in enumerate(links[:10]):
                    snippet = snippets[i] if i < len(snippets) else ""
                    # Clean HTML tags from snippets
                    snippet = re.sub(r"<[^>]+>", "", snippet).strip()
                    title = re.sub(r"<[^>]+>", "", title).strip()
                    results.append({
                        "title": title,
                        "url": url,
                        "snippet": snippet,
                    })

                return {"query": query, "results": results, "count": len(results)}

        except httpx.HTTPError as e:
            logger.error("Web search error: %s", e)
            return {"query": query, "results": [], "error": str(e)}

    async def web_scrape(self, url: str) -> Dict[str, Any]:
        """Fetch and extract text content from a URL.

        Args:
            url: The URL to scrape.

        Returns:
            Dict with url, title, and text content.
        """
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                response = await client.get(
                    url,
                    headers={"User-Agent": "AgentHub/1.0"},
                )
                response.raise_for_status()

                html = response.text

                # Extract title
                title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.DOTALL)
                title = title_match.group(1).strip() if title_match else url

                # Remove script and style tags
                text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
                text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
                # Remove HTML tags
                text = re.sub(r"<[^>]+>", " ", text)
                # Clean whitespace
                text = re.sub(r"\s+", " ", text).strip()
                # Limit length
                text = text[:5000]

                return {"url": url, "title": title, "content": text}

        except httpx.HTTPError as e:
            logger.error("Web scrape error for %s: %s", url, e)
            return {"url": url, "error": str(e)}

    async def execute_code(self, code: str, language: str = "python") -> Dict[str, Any]:
        """Execute code in a sandboxed subprocess.

        Args:
            code: The code to execute.
            language: Programming language (currently only Python supported).

        Returns:
            Dict with stdout, stderr, and return_code.
        """
        if language != "python":
            return {
                "error": f"Only Python execution is supported. Got: {language}",
                "stdout": "",
                "stderr": "",
                "return_code": -1,
            }

        try:
            result = subprocess.run(
                ["python3", "-c", code],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=ALLOWED_ROOT,
                env={
                    "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                    "HOME": ALLOWED_ROOT,
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
            )

            return {
                "stdout": result.stdout[:10000],
                "stderr": result.stderr[:5000],
                "return_code": result.returncode,
            }

        except subprocess.TimeoutExpired:
            return {
                "error": "Code execution timed out (30s limit)",
                "stdout": "",
                "stderr": "",
                "return_code": -1,
            }
        except Exception as e:
            logger.exception("Code execution error")
            return {
                "error": str(e),
                "stdout": "",
                "stderr": "",
                "return_code": -1,
            }

    async def read_file(self, path: str) -> Dict[str, Any]:
        """Read a file from the workspace.

        Args:
            path: Path to the file (relative to workspace or absolute).

        Returns:
            Dict with path and content or error.
        """
        try:
            safe_path = _sanitize_path(path)
            if not os.path.isfile(safe_path):
                return {"path": path, "error": "File not found"}

            with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(100_000)  # Limit to ~100KB

            return {"path": path, "content": content, "size": os.path.getsize(safe_path)}

        except ValueError as e:
            return {"path": path, "error": str(e)}
        except Exception as e:
            logger.error("Read file error for %s: %s", path, e)
            return {"path": path, "error": str(e)}

    async def write_file(self, path: str, content: str) -> Dict[str, Any]:
        """Write content to a file in the workspace.

        Args:
            path: Path to the file (relative to workspace or absolute).
            content: Content to write.

        Returns:
            Dict with path and success status.
        """
        try:
            safe_path = _sanitize_path(path)
            os.makedirs(os.path.dirname(safe_path), exist_ok=True)

            with open(safe_path, "w", encoding="utf-8") as f:
                f.write(content)

            return {"path": path, "success": True, "size": len(content)}

        except ValueError as e:
            return {"path": path, "error": str(e), "success": False}
        except Exception as e:
            logger.error("Write file error for %s: %s", path, e)
            return {"path": path, "error": str(e), "success": False}

    async def search_codebase(
        self,
        pattern: str,
        path: Optional[str] = None,
        file_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search files using ripgrep.

        Args:
            pattern: Regex pattern to search for.
            path: Subdirectory to search within (relative to workspace).
            file_type: File extension filter (e.g., 'py', 'js').

        Returns:
            Dict with matches list.
        """
        try:
            search_path = ALLOWED_ROOT
            if path:
                search_path = _sanitize_path(path)

            cmd = ["rg", "--json", "--max-count", "50", "--max-filesize", "1M"]
            if file_type:
                cmd.extend(["--type", file_type])
            cmd.extend([pattern, search_path])

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
            )

            matches = []
            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                try:
                    import json
                    data = json.loads(line)
                    if data.get("type") == "match":
                        match_data = data["data"]
                        matches.append({
                            "file": match_data["path"]["text"],
                            "line": match_data["line_number"],
                            "text": match_data["lines"]["text"].strip(),
                        })
                except (json.JSONDecodeError, KeyError):
                    continue

            return {"pattern": pattern, "matches": matches, "count": len(matches)}

        except FileNotFoundError:
            # ripgrep not installed — fallback to grep
            logger.warning("ripgrep not found, falling back to grep")
            try:
                search_path = ALLOWED_ROOT
                if path:
                    search_path = _sanitize_path(path)

                cmd = ["grep", "-rn", "--max-count=50"]
                if file_type:
                    cmd.extend(["--include", f"*.{file_type}"])
                cmd.extend([pattern, search_path])

                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=15
                )

                matches = []
                for line in result.stdout.strip().split("\n")[:50]:
                    if ":" in line:
                        parts = line.split(":", 2)
                        if len(parts) >= 3:
                            matches.append({
                                "file": parts[0],
                                "line": int(parts[1]) if parts[1].isdigit() else 0,
                                "text": parts[2].strip(),
                            })

                return {"pattern": pattern, "matches": matches, "count": len(matches)}
            except Exception as e:
                return {"pattern": pattern, "matches": [], "error": str(e)}

        except subprocess.TimeoutExpired:
            return {"pattern": pattern, "matches": [], "error": "Search timed out"}
        except ValueError as e:
            return {"pattern": pattern, "matches": [], "error": str(e)}

    async def create_chart(
        self,
        chart_type: str,
        data: Dict[str, Any],
        title: str = "",
    ) -> Dict[str, Any]:
        """Generate chart data for frontend rendering.

        Args:
            chart_type: Type of chart (bar, line, scatter, pie).
            data: Chart data with labels and values.
            title: Chart title.

        Returns:
            Dict with chart specification for frontend rendering.
        """
        supported_types = ["bar", "line", "scatter", "pie", "area"]
        if chart_type not in supported_types:
            return {"error": f"Unsupported chart type. Use one of: {supported_types}"}

        return {
            "type": chart_type,
            "title": title,
            "data": data,
            "generated": True,
        }
