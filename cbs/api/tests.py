from decimal import Decimal

from rest_framework import status

from cbs.test_base import BaseAPITestCase
from wallets.models import WalletCreationRequest
from wallets.services import do_pay_merchant


class HealthCheckTests(BaseAPITestCase):
    def setUp(self):
        self.wallet_profile = self.make_wallet_profile()

    def test_admin_can_view_health(self):
        self.auth_as(self.make_admin())
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("database", response.data)
        self.assertIn("environment", response.data)
        self.assertIn("activity_last_hour", response.data)
        self.assertIn("business", response.data)

    def test_agent_cannot_view_health(self):
        self.auth_as(self.make_agent())
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_view_health(self):
        _, _, wallet = self.make_customer("payer", self.wallet_profile)
        self.auth_as(wallet.client)
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_database_check_reports_ok_with_a_numeric_latency(self):
        self.auth_as(self.make_admin())
        response = self.client.get("/api/health/")

        self.assertEqual(response.data["database"]["status"], "ok")
        self.assertIsInstance(response.data["database"]["latency_ms"], (int, float))

    def test_error_rate_is_zero_not_a_crash_when_there_is_no_recent_activity(self):
        self.auth_as(self.make_admin())
        response = self.client.get("/api/health/")
        self.assertEqual(response.data["activity_last_hour"]["error_rate_percent"], 0)

    def test_pending_wallet_request_is_counted(self):
        agent = self.make_agent()
        customer, _, _ = self.make_customer("payer", self.wallet_profile)
        WalletCreationRequest.objects.create(
            customer=customer, wallet_profile=self.wallet_profile, requested_by=agent,
        )

        self.auth_as(self.make_admin())
        response = self.client.get("/api/health/")

        self.assertEqual(response.data["business"]["pending_wallet_requests"], 1)

    def test_failed_transaction_in_the_last_24h_is_counted(self):
        agent = self.make_agent()
        payer, _, payer_wallet = self.make_customer("payer", self.wallet_profile)
        merchant = self.make_merchant("WaterCo", agent, self.wallet_profile)

        # Exceeds the wallet's balance (0) — recorded as a FAILED transaction, not a 400.
        do_pay_merchant(payer_wallet, merchant, Decimal("50.00"), payer)

        self.auth_as(self.make_admin())
        response = self.client.get("/api/health/")

        self.assertEqual(response.data["business"]["failed_transactions_last_24h"], 1)
