Stripe example webhook payloads

1) checkout.session.completed (simplified)
{
  "id": "evt_1JXXXXXX",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_a1b2c3",
      "object": "checkout.session",
      "amount_total": 4999,
      "currency": "usd",
      "payment_status": "paid",
      "metadata": {
        "user_id": "f97a3e..."
      }
    }
  }
}

2) invoice.paid (subscription invoice)
{
  "id": "evt_1IZYYYYY",
  "object": "event",
  "type": "invoice.paid",
  "data": {
    "object": {
      "id": "in_1AbC",
      "amount_paid": 1999,
      "currency": "usd",
      "subscription": "sub_1AbC",
      "lines": {}
    }
  }
}

3) payment_intent.succeeded
{
  "id": "evt_pi_1Abc",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1Abc",
      "amount": 4999,
      "currency": "usd",
      "status": "succeeded",
      "metadata": { "user_id": "f97a3e..." }
    }
  }
}
