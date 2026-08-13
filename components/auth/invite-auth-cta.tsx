import Link from "next/link";
import { Button } from "@/components/ui/button";
import { inviteLoginHref, inviteRegisterHref } from "@/lib/auth/invite-signup";

export function InviteAuthCta({
  redirectPath,
  invitedEmail,
  accountExists,
}: {
  redirectPath: string;
  invitedEmail: string;
  /** null = lookup failed; show both paths rather than guessing. */
  accountExists: boolean | null;
}) {
  const loginHref = inviteLoginHref(redirectPath, invitedEmail);
  const registerHref = inviteRegisterHref(redirectPath);

  if (accountExists === false) {
    return (
      <>
        <Button asChild className="w-full">
          <Link href={registerHref}>Create an account</Link>
        </Button>
        <Link href={loginHref} className="block text-xs text-text-lo hover:text-ice">
          Already have an account? Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <Button asChild className="w-full">
        <Link href={loginHref}>Sign in to accept</Link>
      </Button>
      {accountExists !== true ? (
        <Link href={registerHref} className="block text-xs text-text-lo hover:text-ice">
          New to TEMPO? Create an account
        </Link>
      ) : null}
    </>
  );
}
