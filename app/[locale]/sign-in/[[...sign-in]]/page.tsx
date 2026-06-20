import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F17] px-4 py-12">
      <SignIn path="/en/sign-in" routing="path" signUpUrl="/en/sign-up" />
    </div>
  );
}
