import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../lib/firebase";

export async function uploadConsentProof(params: {
  organizationId: string;
  leadId: string;
  file: File;
}): Promise<string> {
  const ts = Date.now();
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `organizations/${params.organizationId}/consent-proofs/${params.leadId}/${ts}_${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "application/octet-stream" });
  return getDownloadURL(fileRef);
}

export async function uploadAssistantPhoto(params: {
  organizationId: string;
  file: File;
}): Promise<string> {
  const ts = Date.now();
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `organizations/${params.organizationId}/assistant-photo/${ts}_${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "image/jpeg" });
  return getDownloadURL(fileRef);
}

export async function uploadCaptacionPhoto(params: {
  organizationId: string;
  captacionId: string;
  file: File;
}): Promise<string> {
  const ts = Date.now();
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `organizations/${params.organizationId}/captacion-photos/${params.captacionId}/${ts}_${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, params.file, { contentType: params.file.type || "image/jpeg" });
  return getDownloadURL(fileRef);
}
