"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  garminFailureView,
  garminSlowNoticeMs,
  garminVerifiedHoldMs,
  type GarminConnectResult,
  type GarminFailureView,
  type GarminScreen,
  type GarminStage,
} from "@/features/onboarding/garmin-flow";
import {
  completeOnboarding,
  startGarminConnection,
  verifyGarminCode,
} from "@/server/onboarding/actions";
import { GarminCode } from "./garmin-code";
import { GarminConnected } from "./garmin-connected";
import { GarminCredentials } from "./garmin-credentials";
import { GarminIntro } from "./garmin-intro";
import { useOnboardingTransition } from "./use-onboarding-transition";

export function GarminStep({
  revision,
  initialScreen,
}: {
  revision: number;
  initialScreen: GarminScreen;
}) {
  const router = useRouter();
  const completion = useOnboardingTransition();
  const [screen, setScreen] = useState(initialScreen);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<GarminFailureView | null>(null);
  const [submitting, setSubmitting] = useState<GarminStage | null>(null);
  const [slow, setSlow] = useState(false);
  const [verified, setVerified] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const remainingSeconds = lockedUntil
    ? Math.max(0, Math.ceil((lockedUntil - clock) / 1000))
    : 0;
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);
  useEffect(() => {
    if (!submitting) return;
    const timer = setTimeout(() => setSlow(true), garminSlowNoticeMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [submitting]);
  function showCredentials(keepEmail: boolean) {
    if (!keepEmail) setEmail("");
    setPassword("");
    setCode("");
    setChallengeId(null);
    setNotice(null);
    setScreen("credentials");
  }
  function connected(stage: GarminStage) {
    setPassword("");
    setChallengeId(null);
    const finish = () => {
      setCode("");
      setVerified(false);
      setJustConnected(true);
      setScreen("connected");
    };
    if (stage === "code") {
      setVerified(true);
      setTimeout(finish, garminVerifiedHoldMs);
    } else finish();
  }
  function handle(stage: GarminStage, result: GarminConnectResult) {
    if (result.status === "connected") return connected(stage);
    if (result.status === "mfa_required") {
      setPassword("");
      setCode("");
      setNotice(null);
      setChallengeId(result.challengeId);
      setScreen("code");
      return;
    }
    const view = garminFailureView(stage, result.failure);
    if (view === "session-expired") return router.replace("/sign-in");
    if (view.clearPassword) setPassword("");
    if (view.screen === "credentials") {
      setCode("");
      setChallengeId(null);
    }
    const at = Date.now();
    setClock(at);
    setLockedUntil(
      view.retryAfterSeconds ? at + view.retryAfterSeconds * 1000 : null,
    );
    setNotice(view);
    setScreen(view.screen);
  }
  async function submit(
    stage: GarminStage,
    action: () => Promise<GarminConnectResult>,
  ) {
    setSubmitting(stage);
    try {
      handle(stage, await action());
    } catch {
      handle(stage, {
        status: "error",
        failure: { state: "garmin_unavailable", canRetryCode: false },
      });
    } finally {
      setSubmitting(null);
    }
  }
  const { run } = completion;
  const onContinue = useCallback(
    () =>
      run(
        () => completeOnboarding({ step: "garmin", revision }),
        "L’enregistrement a échoué. Réessaie dans un instant.",
      ),
    [run, revision],
  );
  if (screen === "intro")
    return <GarminIntro onStart={() => showCredentials(true)} />;
  if (screen === "credentials")
    return (
      <GarminCredentials
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        notice={notice}
        remainingSeconds={remainingSeconds}
        submitting={submitting === "credentials"}
        slow={slow}
        onSubmit={() =>
          submit("credentials", () =>
            startGarminConnection({ email: email.trim(), password }),
          )
        }
        onBack={() => {
          setNotice(null);
          setPassword("");
          setScreen("intro");
        }}
      />
    );
  if (screen === "code")
    return (
      <GarminCode
        email={email}
        code={code}
        onCodeChange={setCode}
        notice={notice}
        submitting={submitting === "code"}
        verified={verified}
        slow={slow}
        onSubmit={() =>
          challengeId
            ? submit("code", () => verifyGarminCode({ challengeId, otp: code }))
            : showCredentials(true)
        }
        onSignInAgain={() => showCredentials(true)}
        onUseAnotherAccount={() => showCredentials(false)}
      />
    );
  return (
    <GarminConnected
      email={email || null}
      autoContinue={justConnected}
      pending={completion.pending}
      message={completion.message}
      onContinue={onContinue}
    />
  );
}
