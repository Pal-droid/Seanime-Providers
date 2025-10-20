from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import StreamingResponse
import httpx
from typing import AsyncGenerator

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

client = httpx.AsyncClient(
    headers={"Referer": "https://mangabuddy.com"},
    timeout=httpx.Timeout(10.0, connect=5.0),
    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
    follow_redirects=True,
)

async def iter_stream(url: str) -> AsyncGenerator[bytes, None]:
    """Yields image bytes in chunks, keeping the connection open."""
    async with client.stream("GET", url) as resp:
        resp.raise_for_status()
        async for chunk in resp.aiter_bytes():
            yield chunk

@app.get("/proxy")
async def proxy_image(url: str = Query(..., description="Image URL to proxy")):
    try:
        # Peek at headers only (no body download)
        async with client.stream("HEAD", url) as head:
            content_type = head.headers.get("content-type", "image/jpeg")

        return StreamingResponse(
            iter_stream(url),
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",  # 1-year browser cache
                "X-Proxy": "fastapi-light-proxy",
            },
        )

    except httpx.RequestError:
        raise HTTPException(status_code=400, detail="Failed to fetch remote URL")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Remote error")

@app.on_event("shutdown")
async def shutdown_event():
    await client.aclose()