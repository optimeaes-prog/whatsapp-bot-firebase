export const REGION = "europe-west1";

// Re-exports from cloudTasks to make them available to other services without index.ts circularity
export { scheduleBufferTask, scheduleImmediateHttpTask, BUFFER_DELAY_SECONDS } from "./services/cloudTasks";
