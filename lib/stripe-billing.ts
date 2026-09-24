import Stripe from "stripe";
import type { PaymentPort } from "@/lib/payment-port";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function createFirstPackCheckout(input: { email: string; origin: string }) {
  const stripe = stripeClient();
  const price = process.env.STRIPE_PRICE_ID;
  if (!stripe || !price) return null;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.email,
    line_items: [{ price, quantity: 1 }],
    success_url: `${input.origin}/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/signup?canceled=1`,
  });
  return session.url;
}

export function paymentForCheckoutSession(sessionId: string): PaymentPort {
  return {
    async chargeFirstPack() {
      const stripe = stripeClient();
      if (!stripe || !sessionId) return { ok: false };
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status !== "complete") return { ok: false };
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!customerId || !subscriptionId) return { ok: false };
      return { ok: true, customerId, subscriptionId };
    },
    async renewalFailure() {
      return { ok: false };
    },
    async paymentSuccess() {
      return { ok: false };
    },
  };
}
