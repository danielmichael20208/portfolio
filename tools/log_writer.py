import json
import os
from datetime import datetime

LOG_FILE = os.path.join(os.path.dirname(__file__), "../data/logs_web.json")

def log_event(source, level, event_type, message, context=None, timestamp=None):
    """
    Append structured event to logs_web.json for SIEM dashboard.
    No sensitive data should be logged.
    """
    event = {
        "timestamp": timestamp or datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": source.upper(),
        "level": level.upper(),
        "event_type": event_type,
        "message": message
    }

    if context:
        event["context"] = context

    # Load existing events
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            logs = json.load(f)
            if not isinstance(logs, list):
                logs = []
    except FileNotFoundError:
        logs = []

    logs.append(event)

    # Write back to file
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(logs, f, indent=2)
