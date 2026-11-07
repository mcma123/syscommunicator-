import { useState, type ComponentProps } from "react";
import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { Platform, View } from "react-native";
import { Button, Card, Feedback, Field, Screen, Text } from "./ui";
import { useSchool } from "./store";
import { SessionLoading } from "./auth-provider";

// The root navigator must stay mounted while auth restores; protected screens handle redirects.
export function SchoolNavigator({
  screenOptions,
}: {
  screenOptions: ComponentProps<typeof Stack>["screenOptions"];
}) {
  const { sessionReady, account } = useSchool();
  const allowed =
    sessionReady &&
    account?.status === "Active" &&
    (account.learners.length > 0 || account.roles.length > 0);
  const protectedRoutes = [
    "resources",
    "reports",
    "profile",
    "people",
    "payments",
    "forms",
    "contact",
    "conduct",
    "audit",
    "attendance",
    "groups",
    "settings",
    "notice/[id]",
    "event/[id]",
    "learner/[id]",
    "document/[id]",
    "enquiry/[id]",
    "payment/[id]",
  ];
  return (
    <>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="signin" options={{ title: "Sign in" }} />
        <Stack.Protected guard={!sessionReady || allowed}>
          <Stack.Screen name="(tabs)" options={{ title: "WGJS Connect" }} />
          {protectedRoutes.map((name) => (
            <Stack.Screen key={name} name={name} />
          ))}
        </Stack.Protected>
      </Stack>
      {!sessionReady && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
          <SessionLoading />
        </View>
      )}
    </>
  );
}

export function SignInScreen() {
  const { account, authenticate, signOut, acceptInvitation, emailReady, signedIn, sessionReady } =
    useSchool();
  const params = useLocalSearchParams<{
    email?: string;
    emailToken?: string;
    invitation?: string;
  }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [emailToken, setEmailToken] = useState(params.emailToken ?? "");
  const [invitation, setInvitation] = useState(params.invitation ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("signIn");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const parameterKey = JSON.stringify([params.email, params.emailToken, params.invitation]);
  const [appliedParameters, setAppliedParameters] = useState(parameterKey);
  // Reconcile new deep-link inputs before rendering without clearing in-progress form fields.
  if (appliedParameters !== parameterKey) {
    setAppliedParameters(parameterKey);
    if (params.email) setEmail(params.email);
    if (params.emailToken) setEmailToken(params.emailToken);
    if (params.invitation) setInvitation(params.invitation);
  }
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch {
      setMessage(
        "Could not complete this request. Check your account, code and connection, then try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = () =>
    perform(async () => {
      const normalized = email.trim().toLowerCase();
      if (emailToken) {
        await authenticate("school-email", { email: normalized, code: emailToken });
        setEmailToken("");
        router.setParams({ emailToken: undefined });
        return;
      }
      if (mode === "magic") {
        await authenticate("school-email", {
          email: normalized,
          redirectTo: Platform.OS === "web" ? "/signin" : "wgjsconnect://signin",
        });
        setMessage("Check your email for the sign-in link.");
        return;
      }
      const flow =
        mode === "verify"
          ? "email-verification"
          : mode === "resetVerify"
            ? "reset-verification"
            : mode;
      const input: Record<string, string> = { email: normalized, flow };
      if (mode === "signIn" || mode === "signUp") input.password = password;
      if (mode === "verify" || mode === "resetVerify") input.code = code;
      if (mode === "resetVerify") input.newPassword = password;
      const result = await authenticate("password", input);
      setPassword("");
      if (mode === "reset") {
        setMode("resetVerify");
        setMessage("Enter the email code and your new password.");
      } else if (!result.signingIn && (mode === "signIn" || mode === "signUp")) {
        setMode("verify");
        setMessage("Enter the verification code from your email.");
      }
    });
  const labels: Record<string, string> = {
    signIn: "Sign in",
    signUp: "Create password",
    verify: "Verify email",
    reset: "Send reset code",
    resetVerify: "Save new password",
    magic: "Email a sign-in link",
  };
  if (!sessionReady) return <SessionLoading />;
  if (
    account?.status === "Active" &&
    (account.learners.length > 0 || account.roles.length > 0) &&
    !params.invitation &&
    !params.emailToken
  )
    return <Redirect href="/" />;
  if (signedIn && !account)
    return (
      <Screen title="School account unavailable">
        <Card>
          <Feedback
            error
            message="No school profile is available for this session. Contact the school."
          />
          <Button title="Return to sign in" onPress={() => void perform(signOut)} />
          {!!message && <Feedback error message={message} />}
        </Card>
      </Screen>
    );
  return (
    <Screen title="Welcome to WGJS Connect" subtitle="Use the email registered with your school.">
      {account ? (
        <Card>
          <Text>
            Signed in as {account.name} ({account.email})
          </Text>
          {account.status !== "Active" ? (
            <Feedback
              error
              message={
                account.status === "Revoked"
                  ? "Your session has ended. Sign in again."
                  : "This account is deactivated. Contact the school."
              }
            />
          ) : (
            <>
              {account.learners.length || account.roles.length ? (
                <Button title="Open school app" onPress={() => router.replace("/")} />
              ) : (
                <Text>Your account needs a school role or linked learner.</Text>
              )}
              <Field
                label="Invitation code"
                value={invitation}
                onChangeText={setInvitation}
                autoCapitalize="none"
              />
              <Button
                title="Accept invitation"
                disabled={busy || !invitation.trim()}
                onPress={() =>
                  void perform(async () => {
                    await acceptInvitation(invitation.trim());
                    setInvitation("");
                    router.setParams({ invitation: undefined });
                    setMessage("Invitation accepted.");
                  })
                }
              />
            </>
          )}
          <Button
            secondary
            title="Sign out"
            disabled={busy}
            onPress={() => void perform(signOut)}
          />
        </Card>
      ) : (
        <Card>
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!emailToken}
          />
          {!emailToken && ["signIn", "signUp", "resetVerify"].includes(mode) && (
            <Field
              label={mode === "resetVerify" ? "New password" : "Password"}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            />
          )}
          {!emailToken && ["verify", "resetVerify"].includes(mode) && (
            <Field
              label="Email code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />
          )}
          <Button
            title={
              busy ? "Please wait..." : emailToken ? `Confirm sign-in as ${email}` : labels[mode]!
            }
            disabled={busy || !email}
            onPress={() => void submit()}
          />
          {!emailToken &&
            ["signIn", "signUp", "magic", "reset"]
              .filter((m) => m !== mode)
              .map((m) => (
                <Button
                  key={m}
                  secondary
                  title={labels[m]!}
                  disabled={busy || (!emailReady && m !== "signIn")}
                  onPress={() => {
                    setMode(m);
                    setPassword("");
                    setCode("");
                    setMessage("");
                  }}
                />
              ))}
          {!emailReady && (
            <Text>
              Email activation and recovery are awaiting the school&apos;s email-service setup.
            </Text>
          )}
        </Card>
      )}
      {!!message && <Feedback message={message} />}
    </Screen>
  );
}
