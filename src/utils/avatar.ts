export const generateAvatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/bottts-neutral/png?seed=${encodeURIComponent(seed)}`;