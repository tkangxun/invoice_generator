export type FirstPackCharge = {
  email: string;
  packs: 1;
  interval: "month";
  currency: "SGD";
};

export type PaymentResult =
  | { ok: true; customerId: string; subscriptionId: string }
  | { ok: false };

export type SetPackQuantityInput = {
  subscriptionId: string;
  quantity: number;
};

export type SetPackQuantityResult = { ok: true } | { ok: false };

export type PaymentPort = {
  chargeFirstPack(input: FirstPackCharge): Promise<PaymentResult>;
  setPackQuantity(input: SetPackQuantityInput): Promise<SetPackQuantityResult>;
};
