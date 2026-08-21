# ClinicSynapse backend — FastAPI app in app/, served by uvicorn.
# Build context: repo root (needs requirements.txt + app/).
FROM python:3.12-slim

WORKDIR /code

# rapidocr-onnxruntime pulls in opencv, which wants libgl/glib even in
# "headless" mode on some wheels; curl is used by the compose healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app

WORKDIR /code/app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
