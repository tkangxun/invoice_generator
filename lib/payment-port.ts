export type FirstPackCharge = {
  email: string;
  packs: 1;
  interval: "month";
  currency: "SGD";
};

export type PaymentResult =
  | { ok: true; customerId: string; subscriptionId: string }
  | { ok: false };

export type PaymentPort = {
  chargeFirstPack(input: FirstPackCharge): Promise<PaymentResult>;
};
