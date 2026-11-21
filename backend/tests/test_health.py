from sqlalchemy import inspect


def test_health_ok_and_no_key(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["gemini_configured"] is False
    assert body["gemini_model"] == "gemini-4-hydrogen"


def test_openapi_docs_loads(client):
    res = client.get("/docs")
    assert res.status_code == 200
    assert "Swagger" in res.text or "swagger" in res.text


def test_exact_six_tables_created(db_session):
    inspector = inspect(db_session.get_bind())
    tables = set(inspector.get_table_names())
    assert tables == {
        "briefs",
        "ideas",
        "hackathons",
        "geocode_cache",
        "tasks",
        "chat_messages",
    }
