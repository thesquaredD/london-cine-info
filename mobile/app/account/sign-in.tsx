import { useState } from "react";
import { router } from "expo-router";
import { session, useApp } from "../../src/providers";
import type { Credentials } from "../../src/session/client";
import { Page, Text, Input, Button, Notice, Footer } from "../../src/ui";
export default function SignIn() {
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false);
  const app = useApp();
  async function request() {
    await app.perform(async () => {
      await session.api("/api/auth/request", "POST", { email });
      setSent(true);
    });
  }
  async function verify() {
    const success = await app.perform(async () => {
      const result = await session.api<Credentials>("/api/auth/verify-code", "POST", {
        email,
        code,
      });
      await session.accept(result);
    });
    if (success) router.back();
  }
  return (
    <Page>
      <Text tone="lede">
        Sign in with your email. We’ll send a link for the website and a code for this app.
      </Text>
      <Input
        accessibilityLabel="Email address"
        placeholder="Email address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setSent(false);
        }}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {sent ? (
        <>
          <Text>Enter the six-digit code from your email. It expires after 15 minutes.</Text>
          <Input
            accessibilityLabel="Sign-in code"
            placeholder="123 456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={7}
          />
          <Button label="Send a new code" disabled={app.busy} onPress={() => void request()} />
        </>
      ) : null}
      {app.error ? <Notice title="Sign-in could not finish">{app.error}</Notice> : null}
      <Footer>
        <Button
          label={app.busy ? "Please wait…" : sent ? "Sign in" : "Send sign-in email"}
          selected
          disabled={app.busy || !email.trim() || (sent && !/^\d{6}$/.test(code.replace(/\s/g, "")))}
          onPress={() => void (sent ? verify() : request())}
        />
      </Footer>
    </Page>
  );
}
