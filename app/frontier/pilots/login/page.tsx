"use client";

import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]" />
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
