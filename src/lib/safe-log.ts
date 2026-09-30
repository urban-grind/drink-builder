/** Short error text for logs. Drops URLs and any configured secret values. */
export function safeErrorText(error: unknown): string {
  let message = error instanceof Error ? error.message : "unknown error";
  const secrets = [
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_ACCOUNT_ID,
    process.env.PHOTO_REVIEW_PASSWORD,
  ];
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  return message.replace(/https?:\/\/\S+/gi, "[url]").slice(0, 300);
}
