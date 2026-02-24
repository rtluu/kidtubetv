import { Video, Channel } from '@src/types/video';

export function isAgeAppropriate(
  item: { ageRange: { min: number; max: number } },
  userAgeRange: { min: number; max: number } | null
): boolean {
  if (!userAgeRange) return true;
  return item.ageRange.min <= userAgeRange.max && item.ageRange.max >= userAgeRange.min;
}

export function filterByAge<T extends { ageRange: { min: number; max: number } }>(
  items: T[],
  userAgeRange: { min: number; max: number } | null
): T[] {
  if (!userAgeRange) return items;
  return items.filter((item) => isAgeAppropriate(item, userAgeRange));
}
