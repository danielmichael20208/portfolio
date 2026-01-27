#!/usr/bin/env python3
"""
Uploads logs_web.json to GitHub for SIEM Dashboard
"""

import os
import base64
import requests
import json

REPO = "danielmichael20208/portfolio"
FILE_PATH = "data/logs_web.json"
BRANCH = "main"

API_URL = f"https://api.github.com/repos/{REPO}/contents/{FILE_PATH}"

TOKEN = os.environ.get("GH_TOKEN")

if not TOKEN:
    raise SystemExit("ERROR: GH_TOKEN environment variable not set.")

# Load local file
with open(FILE_PATH, "r") as f:
    content = f.read()

# Get current file SHA (required for updates)
r = requests.get(API_URL, headers={"Authorization": f"Bearer {TOKEN}"})
if r.status_code == 200:
    sha = r.json()["sha"]
else:
    sha = None

# Encode file for GitHub API
encoded = base64.b64encode(content.encode()).decode()

payload = {
    "message": "SIEM log update",
    "content": encoded,
    "branch": BRANCH
}

if sha:
    payload["sha"] = sha

resp = requests.put(API_URL, headers={
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json"
}, data=json.dumps(payload))

if resp.status_code in (200, 201):
    print("✔ Logs uploaded successfully!")
else:
    print("✖ Upload failed:", resp.status_code, resp.text)
