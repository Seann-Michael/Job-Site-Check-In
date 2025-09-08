PayPal example webhook payloads

1) PAYMENT.CAPTURE.COMPLETED (simplified)
{
  "id": "WH-1ABCD",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "2GG12345",
    "status": "COMPLETED",
    "amount": {
      "value": "49.99",
      "currency_code": "USD"
    },
    "payer": {
      "payer_id": "ABCXYZ",
      "email_address": "buyer@example.com"
    }
  }
}

2) BILLING.SUBSCRIPTION.ACTIVATED
{
  "id": "WH-2SUBS",
  "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
  "resource": {
    "id": "I-XXXXXX",
    "status": "ACTIVE",
    "plan_id": "P-XXXX",
    "subscriber": {
      "payer_id": "ABCXYZ",
      "email_address": "buyer@example.com"
    }
  }
}

Notes
- PayPal webhooks include additional headers used for signature verification. Use the verify-webhook-signature API to validate events in netlify/functions/webhook-paypal.ts.
