from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import Response
import httpx

app = FastAPI()

@app.get("/proxy")
async def proxy_image(url: str = Query(..., description="Image URL to proxy")):
    headers = {"Referer": "https://mangabuddy.com"}
    async with httpx.AsyncClient() as client:
        try:
            # Fetch the image with the custom Referer
            r = await client.get(url, headers=headers, timeout=10.0)
            r.raise_for_status()
        except httpx.RequestError as e:
            raise HTTPException(status_code=400, detail=f"Request error: {e}")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
    
    # Return the image bytes with its original content type
    content_type = r.headers.get("content-type", "image/jpeg")
    return Response(content=r.content, media_type=content_type)

# Run the server: uvicorn main:app --reload --port 8000