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
function getTaskName(chatId: string): string {
  // Sanitize chatId for task name (only alphanumeric, hyphens, underscores allowed)
  const sanitizedChatId = chatId.replace(/[^a-zA-Z0-9-_]/g, "-");
  return `${getQueuePath()}/tasks/buffer-${sanitizedChatId}`;
}

/**
 * Schedule a Cloud Task to process buffered messages after the delay
 * If a task already exists for this chatId, it will be deleted and recreated
 */
export async function scheduleBufferTask(
  chatId: string,
  processUrl: string
): Promise<{ taskName: string; scheduledTime: number }> {
  const taskName = getTaskName(chatId);
  const scheduledTime = Math.floor(Date.now() / 1000) + BUFFER_DELAY_SECONDS;

  // Try to delete existing task first (ignore errors if it doesn't exist)
  try {
    await client.deleteTask({ name: taskName });
    console.log(`Deleted existing task for ${chatId}`);
  } catch (error) {
    // Task doesn't exist, that's fine
    const err = error as { code?: number };
    if (err.code !== 5) {
      // 5 = NOT_FOUND
      console.warn("Error deleting task (non-critical):", error);
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
export async function cancelBufferTask(chatId: string): Promise<boolean> {
  const taskName = getTaskName(chatId);

  try {
    await client.deleteTask({ name: taskName });
    console.log(`Cancelled buffer task for ${chatId}`);
    return true;
  } catch (error) {
    const err = error as { code?: number };
    if (err.code === 5) {
      // NOT_FOUND - task already executed or doesn't exist
      console.log(`No active task found for ${chatId}`);
      return false;
    }
    console.error("Error cancelling task:", error);
    throw error;
  }
}

/**
 * Check if there's a pending task for a conversation
 */
export async function hasPendingTask(chatId: string): Promise<boolean> {
  const taskName = getTaskName(chatId);

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
