import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

/* Browser side of sign-in. Same origin, so no base URL needed. */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
