import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F17] px-4 py-12">
      <SignUp path="/en/sign-up" routing="path" signInUrl="/en/sign-in" />
    </div>
  );
}
