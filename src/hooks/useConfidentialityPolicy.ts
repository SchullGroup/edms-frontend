import { usePolicies } from '@/apis/hooks/usePolicies';

export interface ConfidentialityPolicy {
  download: boolean;
  print: boolean;
  watermark: boolean;
}

// Fixture levels are display-cased with spaces ("Top Secret"); the backend
// sends snake_case tiers ("top_secret"). Normalise both sides before matching.
const normaliseTier = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/**
 * Download/print/watermark rules for a confidentiality tier.
 *
 * policiesService returns `{ confidentiality: [{ level, desc, watermark, download, print }], … }`.
 * An unknown tier falls back to "download and print allowed, no watermark";
 * `restricted`/`confidential` are always watermarked regardless.
 */
export function useConfidentialityPolicy() {
  const { data: policiesData, isLoading } = usePolicies();
  const tiers: any[] = (policiesData as any)?.confidentiality ?? [];

  const policyFor = (level: string): ConfidentialityPolicy => {
    const item = tiers.find((p) => normaliseTier(String(p.level)) === normaliseTier(level));
    const highConf = ['restricted', 'confidential'].includes(level.toLowerCase());
    return {
      download: item?.download ?? true,
      print: item?.print ?? true,
      watermark: (item?.watermark ?? false) || highConf,
    };
  };

  return { policyFor, isLoading };
}
