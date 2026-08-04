from decimal import Decimal

from rest_framework import status

from cbs.test_base import BaseAPITestCase
from wallets.services import do_deposit, do_pay_merchant


class MerchantCreateTests(BaseAPITestCase):
    def setUp(self):
        self.admin = self.make_admin()
        self.agent = self.make_agent()
        self.profile = self.make_wallet_profile()

    def test_admin_can_create_merchant_with_generated_tag(self):
        self.auth_as(self.admin)

        response = self.client.post("/api/merchants/", {
            "name": "CityElectric", "owner": str(self.agent.id),
            "wallet_profile_id": str(self.profile.id),
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # generate_unique_tag only replaces non-alphanumeric chars — it doesn't split
        # camelCase, so "CityElectric" collapses to one word, not "city.electric".
        self.assertTrue(response.data["tag"].startswith("cityelectric."))

    def test_client_supplied_tag_is_ignored(self):
        self.auth_as(self.admin)

        response = self.client.post("/api/merchants/", {
            "name": "CityElectric", "owner": str(self.agent.id),
            "wallet_profile_id": str(self.profile.id), "tag": "hacker.tag",
        })

        self.assertNotEqual(response.data["tag"], "hacker.tag")

    def test_agent_cannot_create_merchant(self):
        self.auth_as(self.agent)

        response = self.client.post("/api/merchants/", {
            "name": "CityElectric", "owner": str(self.agent.id),
            "wallet_profile_id": str(self.profile.id),
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_category_defaults_to_other_when_omitted(self):
        self.auth_as(self.admin)

        response = self.client.post("/api/merchants/", {
            "name": "CityElectric", "owner": str(self.agent.id),
            "wallet_profile_id": str(self.profile.id),
        })

        self.assertEqual(response.data["category"], "OTHER")

    def test_category_can_be_set_explicitly(self):
        self.auth_as(self.admin)

        response = self.client.post("/api/merchants/", {
            "name": "CityElectric", "owner": str(self.agent.id),
            "wallet_profile_id": str(self.profile.id), "category": "UTILITIES",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["category"], "UTILITIES")

    def test_owner_must_be_an_agent(self):
        customer, _, _ = self.make_customer("notanagent", self.profile)
        self.auth_as(self.admin)

        response = self.client.post("/api/merchants/", {
            "name": "CityElectric", "owner": str(customer.id),
            "wallet_profile_id": str(self.profile.id),
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MerchantListDetailTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.profile = self.make_wallet_profile()
        self.merchant = self.make_merchant("WaterCo", self.agent, self.profile)
        self.customer, _, _ = self.make_customer("cust", self.profile)

    def test_any_authenticated_user_can_list_merchants(self):
        self.auth_as(self.customer)
        response = self.client.get("/api/merchants/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["wallet_tag"], self.merchant.wallet.tag)

    def test_admin_can_deactivate_merchant(self):
        self.auth_as(self.make_admin())
        response = self.client.patch(f"/api/merchants/{self.merchant.id}/", {"is_active": False})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.merchant.refresh_from_db()
        self.assertFalse(self.merchant.is_active)

    def test_agent_cannot_deactivate_merchant(self):
        self.auth_as(self.agent)
        response = self.client.patch(f"/api/merchants/{self.merchant.id}/", {"is_active": False})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_is_paginated(self):
        for i in range(24):
            self.make_merchant(f"Merchant{i}", self.agent, self.profile, tag=f"merch{i}.tag")

        self.auth_as(self.customer)
        response = self.client.get("/api/merchants/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 25)  # 24 + the one from setUp
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIsNotNone(response.data["next"])

        second_page = self.client.get(response.data["next"])
        self.assertEqual(len(second_page.data["results"]), 5)
        self.assertIsNone(second_page.data["next"])


class MerchantPaymentListTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.profile = self.make_wallet_profile()
        self.merchant = self.make_merchant("WaterCo", self.agent, self.profile)
        self.payer, _, self.payer_wallet = self.make_customer("payer", self.profile)

        do_deposit(self.payer_wallet, Decimal("100.00"), self.agent)
        do_pay_merchant(self.payer_wallet, self.merchant, Decimal("30.00"), self.payer)
        do_pay_merchant(self.payer_wallet, self.merchant, Decimal("999.00"), self.payer)  # declined

    def test_agent_sees_both_completed_and_failed_attempts(self):
        self.auth_as(self.agent)
        response = self.client.get(f"/api/merchants/{self.merchant.id}/payments/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        statuses = {row["status"] for row in response.data["results"]}
        self.assertEqual(statuses, {"COMPLETED", "FAILED"})

    def test_customer_cannot_view_merchant_payment_history(self):
        self.auth_as(self.payer)
        response = self.client.get(f"/api/merchants/{self.merchant.id}/payments/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_merchant_id_returns_400(self):
        self.auth_as(self.agent)
        response = self.client.get("/api/merchants/not-a-uuid/payments/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
