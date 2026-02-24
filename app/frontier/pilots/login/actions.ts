"use server";

export type LoginState = { error?: string; success?: boolean } | null;

export async function submitLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const devEmail = process.env.DEV_LOGIN_EMAIL;
  const devPassword = process.env.DEV_LOGIN_PASSWORD;

  if (!devEmail || !devPassword) {
    return { error: "Login not configured. Add DEV_LOGIN_EMAIL and DEV_LOGIN_PASSWORD to .env.local" };
  }

  if (email === devEmail && password === devPassword) {
    return { success: true };
  }

  return { error: "Invalid email or password" };
}
