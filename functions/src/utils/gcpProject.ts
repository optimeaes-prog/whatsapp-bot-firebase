import * as admin from "firebase-admin";

export function getGcpProjectId(): string {
  const envProject =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;
  if (envProject) return envProject;
  const appProjectId = admin.app().options.projectId;
  if (appProjectId) return appProjectId;
  throw new Error("Could not determine GCP project ID");
}
