import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      {/* Clerk SignIn doesn't expose redirectUrl in types; cast to any to pass through */}
      <SignIn {...({ redirectUrl: '/dashboard' } as any)} />
    </div>
  );
}