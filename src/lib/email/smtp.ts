import "server-only";

import nodemailer from "nodemailer";

type ContributorApplicationDecision = "approved" | "rejected";

export async function sendContributorApplicationNotification({
  to,
  decision,
}: {
  to: string;
  decision: ContributorApplicationDecision;
}) {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim();

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !password ||
    !from
  ) {
    throw new Error("SMTP settings are incomplete or invalid.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass: password },
  });
  const isApproved = decision === "approved";
  const result = await transporter.sendMail({
    from,
    to,
    subject: isApproved
      ? "You Are Approved as a GCBC Devotional Contributor"
      : "Update on your GCBC Devotional Contributor Application",
    text: isApproved
      ? "Your application has been approved. You can now contribute devotionals to the Grace Christian Baptist Church website.\n\nTo submit a devotional, visit the Devotionals page and select Write a Devotional."
      : "Thank you for applying to become a GCBC devotional contributor. After review, we are unable to approve your application at this time. We appreciate your interest in serving the church.",
  });

  const recipientAccepted = result.accepted.some(
    (recipient) => recipient.toLowerCase() === to.trim().toLowerCase(),
  );

  if (!recipientAccepted) {
    throw new Error("SMTP server did not accept the contributor notification recipient.");
  }
}
