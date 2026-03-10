import { Network, Category } from '@src/types/video';

// Local JSON imports (seed data)
import networksData from '@src/data/networks.json';
import categoriesData from '@src/data/categories.json';

export async function getNetworks(): Promise<Network[]> {
  return (networksData as Network[])
    .filter((n) => n.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategories(): Promise<Category[]> {
  return (categoriesData as Category[])
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
