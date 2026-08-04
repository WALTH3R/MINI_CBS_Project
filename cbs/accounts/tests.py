from decimal import Decimal

from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken

from cbs.test_base import BaseAPITestCase
from wallets.models import Wallet, WalletCreationRequest
from wallets.services import do_deposit, do_pay_merchant, do_transfer


class TokenClaimsTests(BaseAPITestCase):
    """The Angular frontend routes by role, decoded straight from the JWT — see accounts/auth.py."""

    def test_access_token_carries_role_username_and_staff_claims(self):
        agent = self.make_agent("kev")

        response = self.client.post("/api/token/", {"username": "kev", "password": "pass12345"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        claims = AccessToken(response.data["access"])
        self.assertEqual(claims["role"], "AGENT")
        self.assertEqual(claims["username"], "kev")
        self.assertEqual(claims["is_staff"], False)
        self.assertEqual(claims["user_id"], str(agent.id))

    def test_me_endpoint_matches_token_claims(self):
        agent = self.make_agent("kev")
        self.auth_as(agent)

        response = self.client.get("/api/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "kev")
        self.assertEqual(response.data["role"], "AGENT")
        self.assertEqual(response.data["is_staff"], False)
        self.assertEqual(str(response.data["id"]), str(agent.id))


class AgentCreateTests(BaseAPITestCase):
    def test_admin_can_create_agent(self):
        admin = self.make_admin()
        self.auth_as(admin)

        response = self.client.post("/api/accounts/agents/", {
            "username": "new_agent", "password": "pass12345",
            "first_name": "Jane", "last_name": "Smith",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "new_agent")
        self.assertNotIn("password", response.data)

    def test_agent_cannot_create_agent(self):
        self.auth_as(self.make_agent())

        response = self.client.post("/api/accounts/agents/", {
            "username": "another_agent", "password": "pass12345",
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_username_rejected(self):
        admin = self.make_admin()
        self.make_agent("taken")
        self.auth_as(admin)

        response = self.client.post("/api/accounts/agents/", {
            "username": "taken", "password": "pass12345",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AgentListTests(BaseAPITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.agent1 = self.make_agent("agent1")
        self.agent2 = self.make_agent("agent2")

    def test_admin_can_list_agents(self):
        self.auth_as(self.admin)
        response = self.client.get("/api/accounts/agents/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = {a["username"] for a in response.data}
        self.assertEqual(usernames, {"agent1", "agent2"})
        self.assertNotIn("password", response.data[0])

    def test_agent_cannot_list_agents(self):
        self.auth_as(self.agent1)
        response = self.client.get("/api/accounts/agents/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_list_agents(self):
        customer_user, _, _ = self.make_customer("bystander", self.make_wallet_profile())
        self.auth_as(customer_user)
        response = self.client.get("/api/accounts/agents/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CustomerCreateTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.wallet_profile = self.make_wallet_profile()
        self.auth_as(self.agent)

    def valid_payload(self, **overrides):
        payload = {
            "username": "jdoe", "password": "somepassword123",
            "name": "Doe", "first_name": "John", "parent_name": "Richard Doe",
            "date_of_birth": "1990-05-14", "marital_status": "SINGLE",
            "place_of_birth": "Kinshasa", "national_id_number": "NID-00001",
            "wallet_profile_id": str(self.wallet_profile.id),
        }
        payload.update(overrides)
        return payload

    def test_agent_can_create_customer_with_wallet(self):
        response = self.client.post("/api/accounts/customers/", self.valid_payload())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["tag"].startswith("jdoe."))

        wallet = Wallet.objects.get(client__username="jdoe")
        self.assertEqual(wallet.tag, response.data["tag"])
        self.assertEqual(wallet.profile_id, self.wallet_profile.id)
        self.assertEqual(wallet.balance, Decimal("0"))

    def test_client_supplied_tag_is_ignored(self):
        response = self.client.post("/api/accounts/customers/", self.valid_payload(tag="hacker.tag"))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(response.data["tag"], "hacker.tag")

    def test_customer_cannot_create_customer(self):
        customer_user, _, _ = self.make_customer("bystander", self.wallet_profile)
        self.auth_as(customer_user)

        response = self.client.post("/api/accounts/customers/", self.valid_payload(username="another"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_create_customer(self):
        self.client.force_authenticate(user=None)

        response = self.client.post("/api/accounts/customers/", self.valid_payload())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_duplicate_national_id_rejected(self):
        self.make_customer("existing", self.wallet_profile, national_id_number="NID-00001")

        response = self.client.post("/api/accounts/customers/", self.valid_payload(username="someoneelse"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CustomerDetailTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.wallet_profile = self.make_wallet_profile()
        self.customer_user, self.customer_profile, self.wallet = self.make_customer(
            "jdoe", self.wallet_profile
        )

    def test_agent_can_view_customer(self):
        self.auth_as(self.agent)
        response = self.client.get(f"/api/accounts/customers/{self.customer_profile.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["national_id_number"], "NID-jdoe")

    def test_customer_detail_includes_wallet_info(self):
        self.auth_as(self.agent)
        response = self.client.get(f"/api/accounts/customers/{self.customer_profile.id}/")
        self.assertEqual(len(response.data["wallets"]), 1)
        self.assertEqual(response.data["wallets"][0]["id"], str(self.wallet.id))
        self.assertEqual(response.data["wallets"][0]["tag"], self.wallet.tag)
        self.assertEqual(response.data["wallets"][0]["currency"], self.wallet_profile.currency)

    def test_admin_can_view_customer_detail(self):
        self.auth_as(self.make_admin())
        response = self.client.get(f"/api/accounts/customers/{self.customer_profile.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_customer_cannot_view_customer_detail(self):
        self.auth_as(self.customer_user)
        response = self.client.get(f"/api/accounts/customers/{self.customer_profile.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_id_returns_400_not_404(self):
        self.auth_as(self.agent)
        response = self.client.get("/api/accounts/customers/not-a-uuid/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_deactivate_customer(self):
        self.auth_as(self.make_admin())
        response = self.client.patch(
            f"/api/accounts/customers/{self.customer_profile.id}/", {"is_active": False},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["is_active"], False)
        self.assertIn("wallets", response.data)  # full CustomerProfileSerializer shape, not the narrow update one

        self.customer_user.refresh_from_db()
        self.assertFalse(self.customer_user.is_active)

    def test_admin_can_reactivate_customer(self):
        self.customer_user.is_active = False
        self.customer_user.save()
        self.auth_as(self.make_admin())

        response = self.client.patch(
            f"/api/accounts/customers/{self.customer_profile.id}/", {"is_active": True},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.customer_user.refresh_from_db()
        self.assertTrue(self.customer_user.is_active)

    def test_agent_cannot_change_customer_status(self):
        self.auth_as(self.agent)
        response = self.client.patch(
            f"/api/accounts/customers/{self.customer_profile.id}/", {"is_active": False},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_change_own_status(self):
        self.auth_as(self.customer_user)
        response = self.client.patch(
            f"/api/accounts/customers/{self.customer_profile.id}/", {"is_active": False},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_deactivated_customer_cannot_log_in(self):
        self.customer_user.is_active = False
        self.customer_user.save()

        response = self.client.post("/api/token/", {"username": "jdoe", "password": "pass12345"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AgentStatusTests(BaseAPITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.agent = self.make_agent("agent1")

    def test_admin_can_deactivate_agent(self):
        self.auth_as(self.admin)
        response = self.client.patch(
            f"/api/accounts/agents/{self.agent.id}/", {"is_active": False},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["is_active"], False)
        self.assertEqual(response.data["username"], "agent1")  # full AgentCreateSerializer shape

        self.agent.refresh_from_db()
        self.assertFalse(self.agent.is_active)

    def test_admin_can_reactivate_agent(self):
        self.agent.is_active = False
        self.agent.save()
        self.auth_as(self.admin)

        response = self.client.patch(
            f"/api/accounts/agents/{self.agent.id}/", {"is_active": True},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.agent.refresh_from_db()
        self.assertTrue(self.agent.is_active)

    def test_agent_cannot_change_own_status(self):
        self.auth_as(self.agent)
        response = self.client.patch(
            f"/api/accounts/agents/{self.agent.id}/", {"is_active": False},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_deactivated_agent_cannot_log_in(self):
        self.agent.is_active = False
        self.agent.save()

        response = self.client.post("/api/token/", {"username": "agent1", "password": "pass12345"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CustomerListTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.wallet_profile = self.make_wallet_profile()
        self.jdoe_user, _, _ = self.make_customer("jdoe", self.wallet_profile, national_id_number="NID-JDOE")
        self.jsmith_user, _, _ = self.make_customer("jsmith", self.wallet_profile, national_id_number="NID-JSMITH")
        self.auth_as(self.agent)

    def test_agent_can_list_all_customers(self):
        response = self.client.get("/api/accounts/customers/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_search_by_username(self):
        response = self.client.get("/api/accounts/customers/?search=jdoe")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["username"], "jdoe")

    def test_search_by_national_id(self):
        response = self.client.get("/api/accounts/customers/?search=JSMITH")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["username"], "jsmith")

    def test_customer_cannot_list_customers(self):
        self.auth_as(self.jdoe_user)
        response = self.client.get("/api/accounts/customers/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_all_customers(self):
        self.auth_as(self.make_admin())
        response = self.client.get("/api/accounts/customers/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_admin_cannot_register_a_customer(self):
        self.auth_as(self.make_admin())
        response = self.client.post("/api/accounts/customers/", {
            "username": "shouldnotwork", "password": "pass12345",
            "name": "Doe", "first_name": "John", "parent_name": "Richard Doe",
            "date_of_birth": "1990-05-14", "marital_status": "SINGLE",
            "place_of_birth": "Kinshasa", "national_id_number": "NID-99999",
            "wallet_profile_id": str(self.wallet_profile.id),
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CustomerWalletTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.eur_profile = self.make_wallet_profile(currency="EUR")
        self.usd_profile = self.make_wallet_profile(name="USD Standard", currency="USD")
        self.customer_user, self.customer_profile, self.eur_wallet = self.make_customer("jdoe", self.eur_profile)

    def test_agent_requesting_a_second_wallet_does_not_create_it_yet(self):
        self.auth_as(self.agent)
        response = self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.usd_profile.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["wallet_profile"]["currency"], "USD")
        self.assertEqual(response.data["requested_by"], self.agent.username)

        # No Wallet exists until the customer confirms.
        self.assertEqual(Wallet.objects.filter(client=self.customer_user).count(), 1)
        self.assertEqual(
            WalletCreationRequest.objects.filter(
                customer=self.customer_user, status=WalletCreationRequest.Status.PENDING,
            ).count(),
            1,
        )

    def test_customer_confirming_the_request_creates_the_wallet(self):
        self.auth_as(self.agent)
        create_response = self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.usd_profile.id)},
        )
        request_id = create_response.data["id"]

        self.auth_as(self.customer_user)
        confirm_response = self.client.post(f"/api/wallets/requests/{request_id}/confirm/")
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(confirm_response.data["tag"], self.eur_wallet.tag)

        self.auth_as(self.agent)
        response = self.client.get(f"/api/accounts/customers/{self.customer_profile.id}/")
        self.assertEqual(len(response.data["wallets"]), 2)

    def test_customer_declining_the_request_creates_no_wallet(self):
        self.auth_as(self.agent)
        create_response = self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.usd_profile.id)},
        )
        request_id = create_response.data["id"]

        self.auth_as(self.customer_user)
        decline_response = self.client.post(f"/api/wallets/requests/{request_id}/decline/")
        self.assertEqual(decline_response.status_code, status.HTTP_200_OK)
        self.assertEqual(decline_response.data["status"], "DECLINED")

        self.assertEqual(Wallet.objects.filter(client=self.customer_user).count(), 1)
        # Declined, not pending anymore — a fresh USD request should be allowed.
        self.auth_as(self.agent)
        retry_response = self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.usd_profile.id)},
        )
        self.assertEqual(retry_response.status_code, status.HTTP_201_CREATED)

    def test_duplicate_currency_wallet_rejected(self):
        self.auth_as(self.agent)
        response = self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.eur_profile.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Wallet.objects.filter(client=self.customer_user).count(), 1)

    def test_duplicate_pending_request_rejected(self):
        self.auth_as(self.agent)
        self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.usd_profile.id)},
        )
        response = self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.usd_profile.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            WalletCreationRequest.objects.filter(customer=self.customer_user).count(), 1,
        )

    def test_customer_cannot_add_their_own_wallet(self):
        self.auth_as(self.customer_user)
        response = self.client.post(
            f"/api/accounts/customers/{self.customer_profile.id}/wallets/",
            {"wallet_profile_id": str(self.usd_profile.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_wallet_id_filter_isolates_currency_in_statistics(self):
        usd_wallet = Wallet.objects.create(client=self.customer_user, profile=self.usd_profile, tag="jdoe.usd")
        do_deposit(self.eur_wallet, Decimal("300.00"), self.agent)
        do_deposit(usd_wallet, Decimal("500.00"), self.agent)
        self.auth_as(self.agent)

        eur_response = self.client.get(
            f"/api/accounts/customers/{self.customer_profile.id}/transactions/statistics/"
            f"?wallet_id={self.eur_wallet.id}"
        )
        usd_response = self.client.get(
            f"/api/accounts/customers/{self.customer_profile.id}/transactions/statistics/"
            f"?wallet_id={usd_wallet.id}"
        )

        self.assertEqual(Decimal(str(eur_response.data["total_deposited"])), Decimal("300.00"))
        self.assertEqual(Decimal(str(usd_response.data["total_deposited"])), Decimal("500.00"))


class ReportingTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.wallet_profile = self.make_wallet_profile()
        self.payer, self.payer_profile, self.payer_wallet = self.make_customer("payer", self.wallet_profile)
        self.other_user, _, self.other_wallet = self.make_customer("other", self.wallet_profile)
        self.merchant = self.make_merchant("WaterCo", self.agent, self.wallet_profile)

        # One of each transaction type, plus one declined payment (Topic 4 behavior).
        do_deposit(self.payer_wallet, Decimal("300.00"), self.agent)
        do_transfer(self.payer_wallet, self.other_wallet, Decimal("50.00"), self.payer)
        do_pay_merchant(self.payer_wallet, self.merchant, Decimal("40.00"), self.payer)
        # Declined: exceeds remaining balance (300 - 50 - 40 = 210 left, ask for way more).
        do_pay_merchant(self.payer_wallet, self.merchant, Decimal("999999.00"), self.payer)

        self.auth_as(self.agent)

    def test_list_shows_all_transaction_types(self):
        response = self.client.get(f"/api/accounts/customers/{self.payer_profile.id}/transactions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)
        types = {row["type"] for row in response.data}
        self.assertEqual(types, {"DEPOSIT", "TRANSFER", "PAYMENT"})

    def test_filter_by_type(self):
        response = self.client.get(
            f"/api/accounts/customers/{self.payer_profile.id}/transactions/?type=TRANSFER"
        )
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["type"], "TRANSFER")

    def test_filter_by_status_failed(self):
        response = self.client.get(
            f"/api/accounts/customers/{self.payer_profile.id}/transactions/?status=FAILED"
        )
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["status"], "FAILED")

    def test_statistics_exclude_declined_payment_by_default(self):
        response = self.client.get(
            f"/api/accounts/customers/{self.payer_profile.id}/transactions/statistics/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(response.data["total_deposited"])), Decimal("300.00"))
        self.assertEqual(Decimal(str(response.data["total_transferred"])), Decimal("50.00"))
        # 40.00, NOT 40.00 + 999999.00 — the declined attempt must not count.
        self.assertEqual(Decimal(str(response.data["total_paid_bills"])), Decimal("40.00"))
        self.assertEqual(response.data["total_transactions"], 3)

    def test_statistics_status_filter_overrides_default(self):
        response = self.client.get(
            f"/api/accounts/customers/{self.payer_profile.id}/transactions/statistics/?status=FAILED"
        )
        self.assertEqual(response.data["total_transactions"], 1)
        self.assertEqual(Decimal(str(response.data["total_paid_bills"])), Decimal("999999.00"))

    def test_customer_cannot_view_reports(self):
        self.auth_as(self.payer)
        response = self.client.get(f"/api/accounts/customers/{self.payer_profile.id}/transactions/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_view_customer_transaction_list(self):
        self.auth_as(self.make_admin())
        response = self.client.get(f"/api/accounts/customers/{self.payer_profile.id}/transactions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)

    def test_admin_can_view_customer_statistics(self):
        self.auth_as(self.make_admin())
        response = self.client.get(f"/api/accounts/customers/{self.payer_profile.id}/transactions/statistics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_transactions"], 3)


class AgentTransactionTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.other_agent = self.make_agent("other_agent")
        self.wallet_profile = self.make_wallet_profile()
        self.payer, self.payer_profile, self.payer_wallet = self.make_customer("payer", self.wallet_profile)

        do_deposit(self.payer_wallet, Decimal("100.00"), self.agent)
        do_deposit(self.payer_wallet, Decimal("50.00"), self.agent)
        do_deposit(self.payer_wallet, Decimal("25.00"), self.other_agent)

    def test_admin_can_view_agent_transactions(self):
        self.auth_as(self.make_admin())
        response = self.client.get(f"/api/accounts/agents/{self.agent.id}/transactions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertTrue(all(row["type"] == "DEPOSIT" for row in response.data))

    def test_agent_cannot_view_own_transactions_via_this_endpoint(self):
        self.auth_as(self.agent)
        response = self.client.get(f"/api/accounts/agents/{self.agent.id}/transactions/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_view_agent_transactions(self):
        self.auth_as(self.payer)
        response = self.client.get(f"/api/accounts/agents/{self.agent.id}/transactions/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
