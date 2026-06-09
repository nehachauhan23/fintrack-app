import { Suspense } from "react";
import SignInPage from "./sign-in-page";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInPage />
    </Suspense>
  );
}