import os
import pytest
from unittest.mock import MagicMock, patch
import base64

# Must be set before main.py is imported — it validates the key at module level
os.environ.setdefault("GEMINI_API_KEY", "test-key-for-ci")
os.environ.setdefault("LEADERBOARD_ENABLED", "true")

# Stub out StaticFiles so tests don't need a built frontend
import starlette.staticfiles
starlette.staticfiles.StaticFiles.__init__ = lambda self, *a, **kw: None

# --- Stub Firebase at import time so main.py loads cleanly in CI ---
# main.py calls firebase_admin.initialize_app() and firestore.client() at module
# level. These must be stubbed before any fixture imports main.py.
import firebase_admin as _firebase_admin
if "[DEFAULT]" not in _firebase_admin._apps:
    _firebase_admin._apps["[DEFAULT]"] = MagicMock()

import firebase_admin.firestore as _fb_firestore
_mock_db = MagicMock()
_mock_doc = MagicMock()
_mock_doc.id = "test_doc_id"
_mock_doc.to_dict.return_value = {"score": 99, "name": "TestDino"}
_mock_db.collection.return_value.order_by.return_value.limit.return_value.get.return_value = [_mock_doc]
_mock_db.collection.return_value.get.return_value = [_mock_doc]
_fb_firestore.client = lambda *a, **kw: _mock_db

import firebase_admin.auth as _fb_auth
_fb_auth.verify_id_token = lambda *a, **kw: {"uid": "test-uid", "email": "test@example.com"}
# --- End Firebase stubbing ---


@pytest.fixture
def mock_firebase():
    """Provides the module-level Firestore DB mock for test assertions.
    Resets call history between tests while keeping return-value setup intact."""
    _mock_db.reset_mock()
    mock_doc = MagicMock()
    mock_doc.id = "test_doc_id"
    mock_doc.to_dict.return_value = {"score": 99, "name": "TestDino"}
    _mock_db.collection.return_value.order_by.return_value.limit.return_value.get.return_value = [mock_doc]
    _mock_db.collection.return_value.get.return_value = [mock_doc]
    return _mock_db


def pytest_collection_modifyitems(items):
    for item in items:
        if "Level2" in item.nodeid:
            item.add_marker(pytest.mark.xfail(
                reason="Level 2 not yet implemented", strict=False
            ))


@pytest.fixture
def mock_genai_client():
    """Patches genai.Client so tests never call the real Gemini API."""
    with patch("main.client") as mock_client:
        # --- Text generation response (first call in /api/generate) ---
        mock_text_part = MagicMock()
        mock_text_part.text = (
            '{"name": "Testosaurus", "type": "Speedy", '
            '"description": "A fast test dinosaur.", '
            '"stats": {"speed": 8, "health": 6, "jump": 7}, '
            '"imagePrompt": "A speedy cartoon dinosaur"}'
        )
        mock_text_response = MagicMock()
        mock_text_response.candidates[0].content.parts = [mock_text_part]

        # --- Image generation response (second call in /api/generate) ---
        mock_image_part = MagicMock()
        mock_image_part.text = None
        mock_image_part.inline_data.data = b"fake-png-bytes"
        mock_image_part.inline_data.mime_type = "image/png"
        mock_image_response = MagicMock()
        mock_image_response.candidates[0].content.parts = [mock_image_part]

        mock_client.models.generate_content.side_effect = [
            mock_text_response,
            mock_image_response,
        ]
        yield mock_client


@pytest.fixture
def client(mock_genai_client):
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)


@pytest.fixture
def client_no_mock():
    """FastAPI TestClient WITHOUT mocking Gemini.
    Only use for endpoints that never call the Gemini API (telemetry endpoints)."""
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)
