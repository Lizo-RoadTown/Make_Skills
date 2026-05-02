type SearchParams = Promise<{ error?: string }>;

const MESSAGES: Record<string, { title: string; body: string }> = {
  NoInvite: {
    title: "No invitation found",
    body: "Sign-in is currently invite-only. There&apos;s no unconsumed invitation matching your verified email. Ask the workspace owner to issue one.",
  },
  EmailNotVerified: {
    title: "Email not verified",
    body: "Your provider didn&apos;t return a verified email. Verify your email with GitHub or Google and try again.",
  },
  AccessDenied: {
    title: "Access denied",
    body: "Sign-in was denied.",
  },
  Configuration: {
    title: "Configuration error",
    body: "Something is misconfigured on the server. Try again, then contact the workspace owner if it persists.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const code = params.error || "AccessDenied";
  const { title, body } = MESSAGES[code] || MESSAGES.AccessDenied;

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        <p
          className="mt-3 text-sm text-zinc-400"
          dangerouslySetInnerHTML={{ __html: body }}
        />
        <a
          href="/auth/signin"
          className="mt-6 inline-block rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          Back to sign-in
        </a>
      </div>
    </div>
  );
}
