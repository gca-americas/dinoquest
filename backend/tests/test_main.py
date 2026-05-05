"""
DinoQuest backend tests.
Run from the backend/ directory:  pytest tests/ -v
Gemini API is mocked via conftest.py — no real API calls are made in CI.
"""
import pytest


# ============================================================
# Telemetry endpoints — no Gemini calls, use client_no_mock
# ============================================================

class TestGameEndLog:
    def test_valid_payload_returns_logged(self, client_no_mock):
        resp = client_no_mock.post("/api/log/game_end", json={
            "userId": "user123",
            "dino_type": "Speedy",
            "dino_name": "Zippyzilla",
            "score": 1500,
            "coins": 5,
            "won": True,
            "speed": 8.5,
        })
        assert resp.status_code == 200
        assert resp.json() == {"status": "logged"}

    def test_optional_userid_omitted(self, client_no_mock):
        resp = client_no_mock.post("/api/log/game_end", json={
            "dino_type": "Tank",
            "dino_name": "Boulderback",
            "score": 800,
            "coins": 3,
            "won": False,
            "speed": 4.0,
        })
        assert resp.status_code == 200

    def test_missing_required_field_returns_422(self, client_no_mock):
        # dino_name is required
        resp = client_no_mock.post("/api/log/game_end", json={
            "dino_type": "Speedy",
            "score": 100,
            "coins": 1,
            "won": True,
            "speed": 7.0,
        })
        assert resp.status_code == 422


class TestLevel2UnlockLog:
    def test_valid_payload(self, client_no_mock):
        resp = client_no_mock.post("/api/log/level2_unlock", json={
            "userId": "user456",
            "dino_id": "dino-abc-123",
        })
        assert resp.status_code == 200
        assert resp.json() == {"status": "logged"}

    def test_missing_dino_id_returns_422(self, client_no_mock):
        resp = client_no_mock.post("/api/log/level2_unlock", json={"userId": "u1"})
        assert resp.status_code == 422


class TestLevel2StartLog:
    def test_valid_payload(self, client_no_mock):
        resp = client_no_mock.post("/api/log/level2_start", json={
            "userId": "user789",
            "dino_id": "dino-xyz",
            "dino_type": "Agile",
            "dino_name": "Quickclaw",
        })
        assert resp.status_code == 200
        assert resp.json() == {"status": "logged"}

    def test_optional_dino_name_omitted(self, client_no_mock):
        resp = client_no_mock.post("/api/log/level2_start", json={
            "dino_id": "dino-xyz",
            "dino_type": "Agile",
        })
        assert resp.status_code == 200


class TestLevel2EndLog:
    def test_valid_payload(self, client_no_mock):
        resp = client_no_mock.post("/api/log/level2_end", json={
            "userId": "user999",
            "dino_id": "dino-xyz",
            "dino_type": "Agile",
            "dino_name": "Quickclaw",
            "score": 2400,
            "rocks_destroyed": 12,
            "time_survived": 45.3,
            "won": True,
        })
        assert resp.status_code == 200
        assert resp.json() == {"status": "logged"}

    def test_missing_score_returns_422(self, client_no_mock):
        resp = client_no_mock.post("/api/log/level2_end", json={
            "dino_id": "dino-xyz",
            "dino_type": "Agile",
            "rocks_destroyed": 5,
            "time_survived": 20.0,
            "won": False,
        })
        assert resp.status_code == 422


# ============================================================
# Security headers
# ============================================================

class TestSecurityHeaders:
    def test_coop_header_present(self, client_no_mock):
        # The COOP header must be on every response for Firebase OAuth popups
        resp = client_no_mock.get("/favicon.ico")
        assert resp.headers.get("cross-origin-opener-policy") == "same-origin-allow-popups"

    def test_favicon_returns_204(self, client_no_mock):
        resp = client_no_mock.get("/favicon.ico")
        assert resp.status_code == 204


# ============================================================
# /api/generate — Gemini is mocked via conftest fixture
# ============================================================

class TestGenerateDinosaur:
    def test_valid_request_returns_details_and_image(self, client):
        resp = client.post("/api/generate", json={
            "habitat": "Forest",
            "diet": "Herbivore (Plants)",
            "preferences": "green and friendly",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "details" in data
        assert "rawImageUrl" in data
        assert data["rawImageUrl"].startswith("data:image/png;base64,")

    def test_details_contain_expected_fields(self, client):
        resp = client.post("/api/generate", json={
            "habitat": "Desert",
            "diet": "Carnivore (Meat)",
            "preferences": "red and fierce",
        })
        assert resp.status_code == 200
        details = resp.json()["details"]
        assert "name" in details
        assert "type" in details
        assert details["type"] in ("Speedy", "Tank", "Balanced", "Agile")

    def test_missing_habitat_returns_422(self, client):
        resp = client.post("/api/generate", json={
            "diet": "omnivore",
            "preferences": "blue",
        })
        assert resp.status_code == 422

    def test_missing_diet_returns_422(self, client):
        resp = client.post("/api/generate", json={
            "habitat": "ocean",
            "preferences": "blue",
        })
        assert resp.status_code == 422

    def test_gemini_failure_returns_500(self, mock_genai_client, client):
        # Simulate Gemini throwing an error on the second call attempt
        mock_genai_client.models.generate_content.side_effect = Exception("Gemini API unavailable")
        resp = client.post("/api/generate", json={
            "habitat": "Swamp",
            "diet": "Herbivore (Plants)",
            "preferences": "purple",
        })
        assert resp.status_code == 500


# ============================================================
# /api/log/game_start
# ============================================================

class TestGameStartLog:
    def test_valid_payload_returns_logged(self, client_no_mock):
        resp = client_no_mock.post("/api/log/game_start", json={
            "userId": "user001",
            "dino_type": "Speedy",
            "dino_name": "Zippyzilla",
            "is_reuse": False,
        })
        assert resp.status_code == 200
        assert resp.json() == {"status": "logged"}

    def test_is_reuse_true(self, client_no_mock):
        resp = client_no_mock.post("/api/log/game_start", json={
            "dino_type": "Tank",
            "dino_name": "Boulderback",
            "is_reuse": True,
        })
        assert resp.status_code == 200

    def test_missing_dino_type_returns_422(self, client_no_mock):
        resp = client_no_mock.post("/api/log/game_start", json={
            "dino_name": "Nameless",
            "is_reuse": False,
        })
        assert resp.status_code == 422
