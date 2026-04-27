export type AssistantAvatarId =
  | "francisco"
  | "javier"
  | "juan"
  | "lucia"
  | "marina"
  | "marta"
  | "pedro"
  | "raquel";

export type AssistantAvatarDefinition = {
  id: AssistantAvatarId;
  name: string;
  imagePath: string;
};

const ASSISTANT_AVATAR_DEFINITIONS: AssistantAvatarDefinition[] = [
  { id: "francisco", name: "Francisco", imagePath: "/avatars/Francisco%20avatar.png" },
  { id: "javier", name: "Javier", imagePath: "/avatars/Javier%20avatar.png" },
  { id: "juan", name: "Juan", imagePath: "/avatars/Juan%20avatar.png" },
  { id: "lucia", name: "Lucía", imagePath: "/avatars/Lucia%20avatar.png" },
  { id: "marina", name: "Marina", imagePath: "/avatars/Marina%20avatar.png" },
  { id: "marta", name: "Marta", imagePath: "/avatars/Marta%20avatar.png" },
  { id: "pedro", name: "Pedro", imagePath: "/avatars/Pedro%20avatar.png" },
  { id: "raquel", name: "Raquel", imagePath: "/avatars/Raquel%20avatar.png" },
];

const AVATAR_BY_ID = new Map<AssistantAvatarId, AssistantAvatarDefinition>(
  ASSISTANT_AVATAR_DEFINITIONS.map((avatar) => [avatar.id, avatar])
);

export function getAssistantAvatarById(id?: string): AssistantAvatarDefinition | null {
  if (!id) return null;
  return AVATAR_BY_ID.get(id as AssistantAvatarId) || null;
}

export function buildAvatarPublicUrl(origin: string, imagePath: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  return `${normalizedOrigin}${imagePath}`;
}
