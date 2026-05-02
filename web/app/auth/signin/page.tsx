import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Make_Skills is currently invite-only. You&apos;ll need an active
          invitation matching your verified email to complete sign-in.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
            >
              Continue with GitHub
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
            >
              Continue with Google
            </button>
          </form>
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          Without an invite, sign-in is denied and no account is created.
          Contact the workspace owner for an invitation.
        </p>
      </div>
    </div>
  );
}
