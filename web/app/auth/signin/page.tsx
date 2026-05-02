import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in with GitHub or Google. The first user on a fresh
          deployment becomes the workspace owner; subsequent users need
          an invitation from an existing admin.
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
          New sign-ins after the workspace owner have to match an active
          invitation row, otherwise no account is created.
        </p>
      </div>
    </div>
  );
}
