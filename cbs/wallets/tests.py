import uuid
from decimal import Decimal

from rest_framework import status

from cbs.test_base import BaseAPITestCase


def idempotency_headers():
    """A fresh Idempotency-Key for a POST that's meant to be a genuinely new operation —
    required on /deposits/, /transfers/, and /payments/ since wallets/idempotency.py."""
    return {"headers": {"Idempotency-Key": str(uuid.uuid4())}}


class MyWalletTests(BaseAPITestCase):
    def test_customer_can_fetch_own_wallet(self):
        profile = self.make_wallet_profile()
        owner, _, wallet = self.make_customer("owner", profile)
        self.auth_as(owner)

        response = self.client.get("/api/wallets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(wallet.id))
        self.assertEqual(response.data[0]["tag"], wallet.tag)

    def test_customer_with_multiple_wallets_gets_them_all(self):
        eur_profile = self.make_wallet_profile(currency="EUR")
        usd_profile = self.make_wallet_profile(name="USD Standard", currency="USD")
        owner, _, eur_wallet = self.make_customer("multi", eur_profile)
        from wallets.models import Wallet
        usd_wallet = Wallet.objects.create(client=owner, profile=usd_profile, tag="multi.usd")
        self.auth_as(owner)

        response = self.client.get("/api/wallets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {w["id"] for w in response.data}
        self.assertEqual(ids, {str(eur_wallet.id), str(usd_wallet.id)})

    def test_agent_has_no_wallet_of_their_own(self):
        self.auth_as(self.make_agent())
        response = self.client.get("/api/wallets/mine/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_with_no_wallet_gets_empty_list(self):
        # Shouldn't happen via the normal create flow, but the endpoint must not crash if it does.
        from django.contrib.auth import get_user_model
        from accounts.models import Role
        user = get_user_model().objects.create_user(username="walletless", password="pass12345", role=Role.CLIENT)
        self.auth_as(user)

        response = self.client.get("/api/wallets/mine/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])


class WalletCreationRequestTests(BaseAPITestCase):
    def setUp(self):
        from wallets.models import WalletCreationRequest

        self.WalletCreationRequest = WalletCreationRequest
        self.agent = self.make_agent()
        self.usd_profile = self.make_wallet_profile(name="USD Standard", currency="USD")
        self.eur_profile = self.make_wallet_profile(name="EUR Standard", currency="EUR")
        self.customer, _, self.eur_wallet = self.make_customer("jdoe", self.eur_profile)
        self.other_customer, _, _ = self.make_customer("other", self.eur_profile)

        self.request = self.WalletCreationRequest.objects.create(
            customer=self.customer, wallet_profile=self.usd_profile, requested_by=self.agent,
        )

    def test_customer_sees_own_pending_request(self):
        self.auth_as(self.customer)
        response = self.client.get("/api/wallets/requests/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["status"], "PENDING")
        self.assertEqual(response.data[0]["wallet_profile"]["currency"], "USD")
        self.assertEqual(response.data[0]["requested_by"], self.agent.username)

    def test_other_customer_does_not_see_it(self):
        self.auth_as(self.other_customer)
        response = self.client.get("/api/wallets/requests/mine/")
        self.assertEqual(response.data, [])

    def test_confirm_creates_wallet_and_marks_confirmed(self):
        self.auth_as(self.customer)
        response = self.client.post(f"/api/wallets/requests/{self.request.id}/confirm/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["profile"]["currency"], "USD")

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, self.WalletCreationRequest.Status.CONFIRMED)
        self.assertIsNotNone(self.request.wallet)
        self.assertIsNotNone(self.request.decided_at)

    def test_decline_creates_no_wallet(self):
        self.auth_as(self.customer)
        response = self.client.post(f"/api/wallets/requests/{self.request.id}/decline/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "DECLINED")

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, self.WalletCreationRequest.Status.DECLINED)
        self.assertIsNone(self.request.wallet)

    def test_other_customer_cannot_confirm(self):
        self.auth_as(self.other_customer)
        response = self.client.post(f"/api/wallets/requests/{self.request.id}/confirm/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_agent_cannot_confirm(self):
        self.auth_as(self.agent)
        response = self.client.post(f"/api/wallets/requests/{self.request.id}/confirm/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_already_decided_request_cannot_be_decided_again(self):
        self.auth_as(self.customer)
        self.client.post(f"/api/wallets/requests/{self.request.id}/confirm/")

        response = self.client.post(f"/api/wallets/requests/{self.request.id}/decline/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class RecipientLookupTests(BaseAPITestCase):
    def setUp(self):
        self.profile = self.make_wallet_profile()
        self.sender, _, _ = self.make_customer("sender", self.profile)
        self.recipient, _, self.recipient_wallet = self.make_customer("recipient", self.profile)
        self.recipient.first_name = "Jean"
        self.recipient.last_name = "Dupont"
        self.recipient.save()

    def test_customer_can_resolve_a_recipient_tag_to_a_name(self):
        self.auth_as(self.sender)
        response = self.client.get(f"/api/wallets/recipients/{self.recipient_wallet.tag}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Jean")
        self.assertEqual(response.data["name"], "Dupont")
        self.assertEqual(response.data["tag"], self.recipient_wallet.tag)
        self.assertNotIn("balance", response.data)

    def test_unknown_tag_is_rejected(self):
        self.auth_as(self.sender)
        response = self.client.get("/api/wallets/recipients/does.not.exist/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_merchant_tag_is_rejected(self):
        merchant = self.make_merchant("WaterCo", self.make_agent("agent2"), self.profile)
        self.auth_as(self.sender)
        response = self.client.get(f"/api/wallets/recipients/{merchant.wallet.tag}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_agent_cannot_use_recipient_lookup(self):
        self.auth_as(self.make_agent())
        response = self.client.get(f"/api/wallets/recipients/{self.recipient_wallet.tag}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class WalletProfileTests(BaseAPITestCase):
    def test_admin_can_create_profile_with_default_currency(self):
        self.auth_as(self.make_admin())

        response = self.client.post("/api/wallets/profiles/", {
            "name": "Standard",
            "max_balance": "1000000", "max_transfer_amount": "500000",
            "max_daily_transfer_total": "1000000", "max_deposit_amount": "500000",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["currency"], "EUR")

    def test_agent_cannot_create_profile(self):
        self.auth_as(self.make_agent())

        response = self.client.post("/api/wallets/profiles/", {
            "name": "Standard", "max_balance": "1000000", "max_transfer_amount": "500000",
            "max_daily_transfer_total": "1000000", "max_deposit_amount": "500000",
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_any_authenticated_user_can_list_profiles(self):
        self.make_wallet_profile()
        self.auth_as(self.make_agent())

        response = self.client.get("/api/wallets/profiles/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_any_authenticated_user_can_view_a_profile(self):
        profile = self.make_wallet_profile()
        self.auth_as(self.make_agent())

        response = self.client.get(f"/api/wallets/profiles/{profile.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], profile.name)

    def test_admin_can_update_a_profiles_limits(self):
        profile = self.make_wallet_profile()
        self.auth_as(self.make_admin())

        response = self.client.patch(
            f"/api/wallets/profiles/{profile.id}/", {"max_transfer_amount": "250000"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(response.data["max_transfer_amount"])), Decimal("250000"))
        profile.refresh_from_db()
        self.assertEqual(profile.max_transfer_amount, Decimal("250000"))

    def test_agent_cannot_update_a_profile(self):
        profile = self.make_wallet_profile()
        self.auth_as(self.make_agent())

        response = self.client.patch(
            f"/api/wallets/profiles/{profile.id}/", {"max_transfer_amount": "250000"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class WalletDetailBalanceTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.profile = self.make_wallet_profile(currency="USD")
        self.owner, _, self.wallet = self.make_customer("owner", self.profile)
        self.other, _, _ = self.make_customer("other", self.profile)

    def test_owner_can_view_wallet_detail_with_nested_profile(self):
        self.auth_as(self.owner)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["profile"]["currency"], "USD")
        self.assertNotIn("currency", response.data)  # only inside "profile" now, not top-level

    def test_agent_can_view_any_wallet(self):
        self.auth_as(self.agent)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_other_customer_cannot_view_wallet(self):
        self.auth_as(self.other)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_balance_endpoint_is_flat(self):
        self.auth_as(self.owner)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/balance/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["currency"], "USD")
        self.assertEqual(Decimal(str(response.data["balance"])), Decimal("0"))

    def test_invalid_id_returns_400_not_404(self):
        self.auth_as(self.owner)
        response = self.client.get("/api/wallets/garbage/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_hyphenated_uuid_still_resolves(self):
        self.auth_as(self.owner)
        compact_id = str(self.wallet.id).replace("-", "")
        response = self.client.get(f"/api/wallets/{compact_id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DepositTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.profile = self.make_wallet_profile()
        self.owner, _, self.wallet = self.make_customer("owner", self.profile)

    def test_agent_can_deposit(self):
        self.auth_as(self.agent)
        response = self.client.post(
            f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "100.00"}, **idempotency_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["reference"].startswith("DEP-"))
        self.assertEqual(response.data["currency"], "EUR")

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("100.00"))

    def test_customer_cannot_deposit(self):
        self.auth_as(self.owner)
        response = self.client.post(
            f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "100.00"}, **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_exceeds_max_deposit_amount_rejected(self):
        self.auth_as(self.agent)
        response = self.client.post(
            f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "999999999"}, **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_idempotency_key_is_a_400(self):
        self.auth_as(self.agent)
        response = self.client.post(f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "100.00"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_owner_can_view_deposit_history_not_agent(self):
        from wallets.services import do_deposit
        do_deposit(self.wallet, Decimal("50.00"), self.agent)

        self.auth_as(self.owner)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/deposits/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

        self.auth_as(self.agent)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/deposits/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_amount_filter(self):
        from wallets.services import do_deposit
        do_deposit(self.wallet, Decimal("50.00"), self.agent)
        do_deposit(self.wallet, Decimal("500.00"), self.agent)

        self.auth_as(self.owner)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/deposits/?min_amount=100")

        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(Decimal(str(response.data["results"][0]["amount"])), Decimal("500.00"))

    def test_list_is_paginated(self):
        from wallets.services import do_deposit
        for _ in range(24):
            do_deposit(self.wallet, Decimal("1.00"), self.agent)

        self.auth_as(self.owner)
        response = self.client.get(f"/api/wallets/{self.wallet.id}/deposits/")

        self.assertEqual(response.data["count"], 24)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIsNotNone(response.data["next"])

        second_page = self.client.get(response.data["next"])
        self.assertEqual(len(second_page.data["results"]), 4)


class TransferTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.eur_profile = self.make_wallet_profile(name="EUR Standard", currency="EUR")
        self.usd_profile = self.make_wallet_profile(name="USD Standard", currency="USD")
        self.sender, _, self.sender_wallet = self.make_customer("sender", self.eur_profile)
        self.recipient, _, self.recipient_wallet = self.make_customer("recipient", self.eur_profile)
        self.usd_customer, _, self.usd_wallet = self.make_customer("usder", self.usd_profile)

        from wallets.services import do_deposit
        do_deposit(self.sender_wallet, Decimal("200.00"), self.agent)

        self.auth_as(self.sender)

    def test_successful_transfer(self):
        response = self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": self.recipient_wallet.tag, "amount": "50.00"},
            **idempotency_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["reference"].startswith("TRF-"))
        # response.data holds the pre-render Python objects (test client bypasses the
        # JSON renderer), so this is a real uuid.UUID here, not a string yet.
        self.assertEqual(response.data["performed_by"]["user_id"], self.sender.id)
        self.assertEqual(response.data["performed_by"]["type"], "CLIENT")

        self.sender_wallet.refresh_from_db()
        self.recipient_wallet.refresh_from_db()
        self.assertEqual(self.sender_wallet.balance, Decimal("150.00"))
        self.assertEqual(self.recipient_wallet.balance, Decimal("50.00"))

    def test_insufficient_balance_rejected(self):
        response = self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": self.recipient_wallet.tag, "amount": "999.00"},
            **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_currency_mismatch_rejected(self):
        response = self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": self.usd_wallet.tag, "amount": "10.00"},
            **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_transfer_to_self(self):
        response = self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": self.sender_wallet.tag, "amount": "10.00"},
            **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_transfer_to_merchant_tag(self):
        merchant = self.make_merchant("ElectricCo", self.agent, self.eur_profile)
        response = self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": merchant.wallet.tag, "amount": "10.00"},
            **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_idempotency_key_is_a_400(self):
        response = self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": self.recipient_wallet.tag, "amount": "10.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_direction_labels_on_both_sides(self):
        self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": self.recipient_wallet.tag, "amount": "50.00"},
            **idempotency_headers(),
        )

        response = self.client.get(f"/api/wallets/{self.sender_wallet.id}/transfers/")
        self.assertEqual(response.data["results"][0]["direction"], "DEBIT")

        self.auth_as(self.recipient)
        response = self.client.get(f"/api/wallets/{self.recipient_wallet.id}/transfers/")
        self.assertEqual(response.data["results"][0]["direction"], "CREDIT")

    def test_agent_can_view_but_not_initiate(self):
        self.auth_as(self.agent)

        response = self.client.get(f"/api/wallets/{self.sender_wallet.id}/transfers/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            f"/api/wallets/{self.sender_wallet.id}/transfers/",
            {"to_tag": self.recipient_wallet.tag, "amount": "10.00"},
            **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class PaymentTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.profile = self.make_wallet_profile()
        self.payer, _, self.payer_wallet = self.make_customer("payer", self.profile)
        self.merchant = self.make_merchant("WaterCo", self.agent, self.profile)

        from wallets.services import do_deposit
        do_deposit(self.payer_wallet, Decimal("100.00"), self.agent)

        self.auth_as(self.payer)

    def test_successful_payment(self):
        response = self.client.post(
            f"/api/wallets/{self.payer_wallet.id}/payments/",
            {"merchant_tag": self.merchant.wallet.tag, "amount": "40.00"},
            **idempotency_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "COMPLETED")
        self.assertEqual(response.data["failure_reason"], "")

        self.payer_wallet.refresh_from_db()
        self.assertEqual(self.payer_wallet.balance, Decimal("60.00"))

    def test_insufficient_balance_is_declined_not_rejected(self):
        response = self.client.post(
            f"/api/wallets/{self.payer_wallet.id}/payments/",
            {"merchant_tag": self.merchant.wallet.tag, "amount": "500.00"},
            **idempotency_headers(),
        )

        # Key behavior from Topic 4: this is a 201 with a FAILED record, not a 400.
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "FAILED")
        self.assertEqual(response.data["failure_reason"], "Insufficient balance.")

        self.payer_wallet.refresh_from_db()
        self.assertEqual(self.payer_wallet.balance, Decimal("100.00"))  # untouched

    def test_inactive_merchant_is_declined(self):
        self.merchant.is_active = False
        self.merchant.save()

        response = self.client.post(
            f"/api/wallets/{self.payer_wallet.id}/payments/",
            {"merchant_tag": self.merchant.wallet.tag, "amount": "10.00"},
            **idempotency_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "FAILED")
        self.assertEqual(response.data["failure_reason"], "This merchant account is not active.")

    def test_unknown_merchant_tag_is_a_400(self):
        response = self.client.post(
            f"/api/wallets/{self.payer_wallet.id}/payments/",
            {"merchant_tag": "no.such.tag", "amount": "10.00"},
            **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_idempotency_key_is_a_400(self):
        response = self.client.post(
            f"/api/wallets/{self.payer_wallet.id}/payments/",
            {"merchant_tag": self.merchant.wallet.tag, "amount": "10.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_agent_can_view_payment_history_not_initiate(self):
        self.auth_as(self.agent)

        response = self.client.get(f"/api/wallets/{self.payer_wallet.id}/payments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            f"/api/wallets/{self.payer_wallet.id}/payments/",
            {"merchant_tag": self.merchant.wallet.tag, "amount": "10.00"},
            **idempotency_headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class IdempotencyTests(BaseAPITestCase):
    def setUp(self):
        self.agent = self.make_agent()
        self.profile = self.make_wallet_profile()
        self.owner, _, self.wallet = self.make_customer("owner", self.profile)
        self.auth_as(self.agent)

    def test_repeating_the_same_key_replays_the_first_response_without_re_executing(self):
        key = str(uuid.uuid4())

        first = self.client.post(
            f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "100.00"}, headers={"Idempotency-Key": key},
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post(
            f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "100.00"}, headers={"Idempotency-Key": key},
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.data["reference"], first.data["reference"])

        # The real assertion: the mutation only actually happened once.
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("100.00"))

    def test_different_keys_are_independent_operations(self):
        self.client.post(f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "100.00"}, **idempotency_headers())
        self.client.post(f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "100.00"}, **idempotency_headers())

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("200.00"))

    def test_a_failed_attempt_releases_the_key_for_a_retry(self):
        key = str(uuid.uuid4())

        failed = self.client.post(
            f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "999999999"}, headers={"Idempotency-Key": key},
        )
        self.assertEqual(failed.status_code, status.HTTP_400_BAD_REQUEST)

        retried = self.client.post(
            f"/api/wallets/{self.wallet.id}/deposits/", {"amount": "50.00"}, headers={"Idempotency-Key": key},
        )
        self.assertEqual(retried.status_code, status.HTTP_201_CREATED)

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("50.00"))

    def test_a_key_still_in_flight_returns_409(self):
        from .models import IdempotencyKey

        key = str(uuid.uuid4())
        path = f"/api/wallets/{self.wallet.id}/deposits/"
        # Simulates a genuine concurrent duplicate: the key is claimed but no response is
        # recorded yet, as if another request with the same key were still being processed.
        IdempotencyKey.objects.create(user=self.agent, key=key, path=path)

        response = self.client.post(path, {"amount": "100.00"}, headers={"Idempotency-Key": key})

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("0"))
