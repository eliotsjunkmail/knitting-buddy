import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export default async function HomePage() {
  const auth = await getAuthUser();
  if (auth) redirect("/dashboard");
  return <AuthForm />;
}
