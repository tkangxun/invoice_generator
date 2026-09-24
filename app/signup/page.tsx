import { SignupForm } from "@/components/SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; error?: string }>;
}) {
  const { canceled, error } = await searchParams;
  return <SignupForm canceled={canceled === "1"} error={error} />;
}
