import { CloudTasksClient } from "@google-cloud/tasks";
import { google } from "@google-cloud/tasks/build/protos/protos";

const client = new CloudTasksClient();

// Configuration
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
const LOCATION = "europe-west1";
const QUEUE_NAME = "message-buffer-queue";

// Buffer delay in seconds (90 seconds)
export const BUFFER_DELAY_SECONDS = 90;

/**
 * Get the full queue path for Cloud Tasks
 */
function getQueuePath(): string {
  return client.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);
}

/**
 * Generate a unique task name for a conversation
 */
function getTaskName(chatId: string, timestamp?: number): string {
  // Sanitize chatId for task name (only alphanumeric, hyphens, underscores allowed)
  const sanitizedChatId = chatId.replace(/[^a-zA-Z0-9-_]/g, "-");
  const suffix = timestamp ? `-${timestamp}` : "";
  return `${getQueuePath()}/tasks/buffer-${sanitizedChatId}${suffix}`;
}

/**
 * Schedule a Cloud Task to process buffered messages after the delay
 * If a previousTaskName is provided, it will be deleted to avoid duplicate processing
 */
export async function scheduleBufferTask(
  chatId: string,
  processUrl: string,
  previousTaskName?: string
): Promise<{ taskName: string; scheduledTime: number }> {
  // Use a unique name for EACH task creation to avoid the "already exists" error
  // which happens if we reuse the exact same name too soon after deletion.
  const now = Date.now();
  const taskName = getTaskName(chatId, now);
  const scheduledTime = Math.floor(now / 1000) + BUFFER_DELAY_SECONDS;

  // Try to delete previous task if provided
  if (previousTaskName) {
    try {
      await client.deleteTask({ name: previousTaskName });
      console.log(`Deleted previous task: ${previousTaskName}`);
    } catch (error) {
      // Task might already be executed or doesn't exist, ignore NOT_FOUND
      const err = error as { code?: number };
      if (err.code !== 5) { // 5 = NOT_FOUND
        console.warn(`Error deleting previous task ${previousTaskName}:`, error);
      }
    }
  }

  // Create new task
  const task: google.cloud.tasks.v2.ITask = {
    name: taskName,
    httpRequest: {
      httpMethod: "POST",
      url: processUrl,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify({ chatId })).toString("base64"),
      oidcToken: {
        serviceAccountEmail: `${PROJECT_ID}@appspot.gserviceaccount.com`,
      },
    },
    scheduleTime: {
      seconds: scheduledTime,
    },
  };

  const [response] = await client.createTask({
    parent: getQueuePath(),
    task,
  });

  console.log(`Created buffer task for ${chatId}, scheduled at ${new Date(scheduledTime * 1000).toISOString()}`);

  return {
    taskName: response.name || taskName,
    scheduledTime: scheduledTime * 1000,
  };
}

/**
 * Cancel a pending buffer task
 */
export async function cancelBufferTask(taskName: string): Promise<boolean> {
  try {
    await client.deleteTask({ name: taskName });
    console.log(`Cancelled buffer task: ${taskName}`);
    return true;
  } catch (error) {
    const err = error as { code?: number };
    if (err.code === 5) {
      // NOT_FOUND - task already executed or doesn't exist
      console.log(`No active task found for: ${taskName}`);
      return false;
    }
    console.error("Error cancelling task:", error);
    throw error;
  }
}

/**
 * Check if there's a pending task for a conversation
 */
export async function hasPendingTask(taskName: string): Promise<boolean> {
  try {
    await client.getTask({ name: taskName });
    return true;
  } catch (error) {
    const err = error as { code?: number };
    if (err.code === 5) {
      // NOT_FOUND
      return false;
    }
    throw error;
  }
}
