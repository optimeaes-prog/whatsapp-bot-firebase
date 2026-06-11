export type AssistantAvatarId =
  | "francisco"
  | "javier"
  | "juan"
  | "lucia"
  | "marina"
  | "marta"
  | "pedro"
  | "raquel";

export type AssistantAvatarOption = {
  id: AssistantAvatarId;
  name: string;
  fileName: string;
  imagePath: string;
};

const AVATAR_IMAGE_FILES: Record<AssistantAvatarId, { name: string; fileName: string }> = {
  francisco: { name: "Francisco", fileName: "Francisco avatar.png" },
  javier: { name: "Javier", fileName: "Javier avatar.png" },
  juan: { name: "Juan", fileName: "Juan avatar.png" },
  lucia: { name: "Lucía", fileName: "Lucia avatar.png" },
  marina: { name: "Marina", fileName: "Marina avatar.png" },
  marta: { name: "Marta", fileName: "Marta avatar.png" },
  pedro: { name: "Pedro", fileName: "Pedro avatar.png" },
  raquel: { name: "Raquel", fileName: "Raquel avatar.png" },
};

export const ASSISTANT_AVATARS: AssistantAvatarOption[] = (
  Object.keys(AVATAR_IMAGE_FILES) as AssistantAvatarId[]
).map((id) => {
  const config = AVATAR_IMAGE_FILES[id];
  const imagePath = `/avatars/${encodeURIComponent(config.fileName)}`;
  return {
    id,
    name: config.name,
    fileName: config.fileName,
    imagePath,
  };
});

export function getAssistantAvatarById(id?: string | null): AssistantAvatarOption | undefined {
  if (!id) return undefined;
  return ASSISTANT_AVATARS.find((avatar) => avatar.id === id);
}

export const ASSISTANT_NAME_OPTIONS: string[] = ASSISTANT_AVATARS.map((a) => a.name);

/**
 * Picks the photo URL to show for the assistant.
 * Custom logo (assistantPhotoUrl) wins over the stock avatar URL.
 */
export function resolveAssistantPhotoUrl(s: {
  assistantPhotoUrl?: string | null;
  assistantAvatarUrl?: string | null;
  assistantAvatarId?: string | null;
}): string | undefined {
  if (s.assistantPhotoUrl) return s.assistantPhotoUrl;
  if (s.assistantAvatarUrl) return s.assistantAvatarUrl;
  const stock = getAssistantAvatarById(s.assistantAvatarId);
  return stock?.imagePath;
}
