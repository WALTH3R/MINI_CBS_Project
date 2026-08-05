from rest_framework import status

from cbs.test_base import BaseAPITestCase
from .models import AuditLogEntry


class AuditLogCaptureTests(BaseAPITestCase):
    def test_mutating_request_creates_an_entry(self):
        self.make_agent("kev")

        # Login itself is unauthenticated by definition — no token exists yet to authenticate
        # *this* request with — so it's correctly captured as anonymous, same as a failed
        # attempt; see test_agent_action_is_attributed_to_the_agent for the authenticated case.
        response = self.client.post(
            "/api/token/", {"username": "kev", "password": "pass12345"}, HTTP_USER_AGENT="pytest-agent",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("X-Request-ID", response.headers)

        entry = AuditLogEntry.objects.get()
        self.assertEqual(entry.method, "POST")
        self.assertEqual(entry.path, "/api/token/")
        self.assertEqual(entry.status_code, 200)
        self.assertIsNone(entry.user)
        self.assertEqual(entry.ip_address, "127.0.0.1")
        self.assertEqual(entry.user_agent, "pytest-agent")
        self.assertEqual(str(entry.request_id), response.headers["X-Request-ID"])

    def test_get_request_creates_no_entry(self):
        agent = self.make_agent("kev")
        self.auth_as(agent)

        response = self.client.get("/api/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(AuditLogEntry.objects.count(), 0)

    def test_anonymous_failed_login_creates_entry_without_a_user(self):
        self.make_agent("kev")

        response = self.client.post("/api/token/", {"username": "kev", "password": "wrong"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        entry = AuditLogEntry.objects.get()
        self.assertIsNone(entry.user)
        self.assertEqual(entry.username, "")
        self.assertEqual(entry.status_code, 401)
        self.assertEqual(entry.ip_address, "127.0.0.1")

    def test_agent_action_is_attributed_to_the_agent(self):
        agent = self.make_agent("kev")
        self.auth_as(agent)

        self.client.post("/api/accounts/agents/", {"username": "new_agent", "password": "pass12345"})

        entry = AuditLogEntry.objects.get()
        self.assertEqual(entry.username, "kev")
        self.assertEqual(entry.user_id, agent.id)


class AuditLogListTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent("kev")
        self.customer, _, _ = self.make_customer("cust", self.make_wallet_profile())

    def _make_entries(self, n, **overrides):
        import uuid as uuid_module
        defaults = dict(method="POST", path="/api/wallets/x/deposits/", status_code=201, ip_address="10.0.0.1")
        defaults.update(overrides)
        for _ in range(n):
            AuditLogEntry.objects.create(request_id=uuid_module.uuid4(), **defaults)

    def test_agent_cannot_view_audit_log(self):
        self.auth_as(self.agent)
        response = self.client.get("/api/audit/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_view_audit_log(self):
        self.auth_as(self.customer)
        response = self.client.get("/api/audit/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_view_and_it_is_paginated(self):
        self._make_entries(24)
        self.auth_as(self.make_admin())

        response = self.client.get("/api/audit/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 24)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIsNotNone(response.data["next"])

    def test_filter_by_method(self):
        self._make_entries(2, method="POST")
        self._make_entries(3, method="PATCH")
        self.auth_as(self.make_admin())

        response = self.client.get("/api/audit/?method=PATCH")

        self.assertEqual(response.data["count"], 3)

    def test_filter_by_search_matches_username_or_path(self):
        self._make_entries(1, username="kev", path="/api/wallets/a/deposits/")
        self._make_entries(1, username="regid", path="/api/accounts/customers/")
        self.auth_as(self.make_admin())

        response = self.client.get("/api/audit/?search=kev")
        self.assertEqual(response.data["count"], 1)

        response = self.client.get("/api/audit/?search=customers")
        self.assertEqual(response.data["count"], 1)
