#!/usr/bin/env python3
import os
import base64
import json
import requests

LOG_PATH = "data/logs_web.json"
REPO = "danielmichael20208/portfolio"
FILE_PATH_IN_REPO = "data/logs_web.json"

TOKEN = os.getenv("GH_LOG_TOKEN")  # stored as env var (recommended)

def upload_logs():
    if not TOKEN:
        print("[ERROR] Missing GH_LOG_TOKEN environment variable.")
        return False

    # Load logs
    try:
        with open(LOG_PATH, "r") as f:
            content = f.read()
    except Exception as e:
        print(f"[ERROR] Unable to read logs file: {e}")
        return False

    # Encode base64 for GitHub
    encoded = base64.b64encode(content.encode()).decode()

    # Check if file exists (get its sha)
    get_url = f"https://api.github.com/repos/{REPO}/contents/{FILE_PATH_IN_REPO}"
    headers = {"Authorization": f"token {TOKEN}"}
    sha = None

    r = requests.get(get_url, headers=headers)
    if r.status_code == 200:
        sha = r.json().get("sha")

    # Prepare commit payload
    payload = {
        "message": "Auto-upload logs from local SIEM pipeline",
        "content": encoded,
    }
    if sha:
        payload["sha"] = sha

    # Upload new logs
    put = requests.put(get_url, headers=headers, data=json.dumps(payload))

    if put.status_code in (200, 201):
        print("✅ Logs uploaded successfully!")
        return True
    else:
        print(f"[ERROR] Upload failed: {put.status_code} {put.text}")
        return False


if __name__ == "__main__":
    upload_logs()
