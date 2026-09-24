export type FirstPackCharge = {
  email: string;
  packs: 1;
  interval: "month";
  currency: "SGD";
};

export type PaymentResult =
  | { ok: true; customerId: string; subscriptionId: string }
  | { ok: false };

export type RenewalFailureReport =
  | { ok: true; failedAt: Date }
  | { ok: false };

export type PaymentSuccessReport = { ok: true } | { ok: false };

export type PaymentPort = {
  chargeFirstPack(input: FirstPackCharge): Promise<PaymentResult>;
  /** Reports a failed renewal for the subscription; Account starts the 7-day grace from failedAt. */
  renewalFailure(subscriptionId: string): Promise<RenewalFailureReport>;
  /** Reports a successful payment that clears grace/lock for the subscription. */
  paymentSuccess(subscriptionId: string): Promise<PaymentSuccessReport>;
};
