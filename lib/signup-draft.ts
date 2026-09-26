import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptionsFor } from "@/lib/session";

export type SignupDraft = {
  name?: string;
  email?: string;
  password?: string;
  companyName?: string;
  companyCode?: string;
};

export async function getSignupDraft() {
  return getIronSession<SignupDraft>(
    await cookies(),
    sessionOptionsFor("signup_draft", 60 * 60)
  );
}
