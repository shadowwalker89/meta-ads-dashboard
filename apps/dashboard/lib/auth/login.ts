import { DASHBOARD_STRINGS, type AppLanguage } from "@/lib/i18n/strings";
import type { AuthProvider, AuthSignInInput, AuthUserMapper } from "./types";

export type LoginFailure = "invalid_credentials" | "inactive_account";

export function loginFailureMessage(
  failure: LoginFailure,
  language: AppLanguage
): string {
  return failure === "inactive_account"
    ? DASHBOARD_STRINGS[language].loginInactiveAccount
    : DASHBOARD_STRINGS[language].loginInvalidCredentials;
}

export async function authenticateActiveUser(
  provider: AuthProvider,
  mapper: AuthUserMapper,
  input: AuthSignInInput
): Promise<LoginFailure | null> {
  try {
    await provider.signIn(input);
  } catch {
    return "invalid_credentials";
  }

  const session = await provider.getSession();
  if (!session) {
    return "invalid_credentials";
  }

  const user = await mapper.findByAuthId(
    session.identity.id,
    session.identity.email
  );
  if (!user) {
    await provider.signOut();
    return "invalid_credentials";
  }
  if (user.isActive === false) {
    await provider.signOut();
    return "inactive_account";
  }
  return null;
}
