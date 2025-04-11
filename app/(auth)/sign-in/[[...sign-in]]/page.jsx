"use client";

import { SignIn, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation"; // App Router uses this!

import { Button } from "@/components/ui/button";

export default function Page() {
  const { signIn, setActive } = useSignIn();
  const router = useRouter();

  const handleDemoLogin = async () => {
    try {
      const result = await signIn?.create({
        identifier: "chhnneha@gmail.com",
        password: "fintrackapp@123",
      });

      if (result?.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
        router.push("/dashboard");
      } else {
        console.log("Demo login incomplete:", result);
      }
    } catch (err) {
      console.error("Demo login error:", err);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "50px",
      }}
    >
      <Button
        onClick={handleDemoLogin}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-sm w-100 "
      >
        Try Demo
      </Button>
      <div className="mt-10">
        <SignIn />
      </div>

    </div>
  );
}
