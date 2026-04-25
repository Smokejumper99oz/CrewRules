import { Suspense } from "react";
import { Demo135OpsLoginForm } from "./demo135-ops-login-form";

export default function Demo135OpsLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400/40 border-t-sky-400" />
        </main>
      }
    >
      <Demo135OpsLoginForm />
    </Suspense>
  );
}
