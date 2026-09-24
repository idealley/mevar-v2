#!/usr/bin/env node
/*
  send-test.mjs: send ONE built email to yourself through the Resend API, to
  check the rendering and the spam placement. Not the broadcast: the /emails
  endpoint does not fill {{{RESEND_UNSUBSCRIBE_URL}}}, so it becomes a
  placeholder. For the true end-to-end test use the Broadcasts "Send test
  email" button in the dashboard.

  Usage (repo root):
    npm run email:test -- email/dist/<slug>.html --to you@example.org
*/
import { requireEnv, loadConfig, readIssue, resendClient } from "./lib.mjs";

async function main() {
  const args = process.argv.slice(2);
  const { product } = await loadConfig();
  const apiKey = requireEnv("RESEND_API_KEY");

  const to = args[args.indexOf("--to") + 1];
  if (!args.includes("--to") || !to) throw new Error("Provide --to <address> (your own inbox).");
  const htmlPath = args.find((a) => a.endsWith(".html"));
  if (!htmlPath) throw new Error("Provide email/dist/<slug>.html. Run email/build.mjs first.");

  let { html, text, subject } = await readIssue(htmlPath);
  const placeholder = "https://mevar.org/newsletter/?test=1";
  html = html.split("{{{RESEND_UNSUBSCRIBE_URL}}}").join(placeholder);
  text = text.split("{{{RESEND_UNSUBSCRIBE_URL}}}").join(placeholder);

  const body = await resendClient(apiKey).api("/emails", {
    from: product.from,
    to: [to],
    subject: `${subject} (TEST)`,
    html,
    text,
    reply_to: product.replyTo,
  });
  console.log(`Sent test to ${to}, id ${body.id}`);
  console.log("The unsubscribe link is a placeholder in a test send.");
}

main().catch((err) => {
  console.error("send-test failed:", err.message);
  process.exit(1);
});
