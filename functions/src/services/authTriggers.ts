import { sendNewSignupAlert, sendWelcomeNotification } from "./emailService";

export async function sendWelcomeEmail(email: string, displayName: string): Promise<void> {
  await sendWelcomeNotification(email, displayName);
}

export async function sendNewSignupAlertEmail(params: {
  userId: string;
  email: string;
  displayName: string;
}): Promise<void> {
  await sendNewSignupAlert(params);
}
