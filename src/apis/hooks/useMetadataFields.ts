import { useQueries } from '@tanstack/react-query';
import { cabinetsService } from '@/apis/services/cabinets.service';
import { cabinetKeys, useCabinets } from '@/apis/hooks/useCabinets';
import { CabinetMetadataField } from '@/types/models';

export interface MetadataFieldOption extends CabinetMetadataField {
  cabinetName: string;
}

/**
 * There is no tenant-wide `GET /metadata-fields` on the backend — a field is
 * only ever returned nested in `GET /cabinets/{id}` (see the comment on
 * `useCabinet` in useCabinets.ts). A workflow condition on `field: 'metadata'`
 * isn't scoped to one cabinet, though (a workflow definition isn't tied to a
 * cabinet at all — that link only exists at the instance level, via the
 * document), so building the picker means fetching every cabinet's detail and
 * aggregating. Fine at this app's cabinet counts; flagged in
 * BACKEND_REQUESTS.md as a real gap if that ever stops being true.
 *
 * A document missing a referenced field just fails that condition rule at
 * evaluation time (confirmed in `tasks.service.ts`'s `matchesWorkflowCondition`
 * — it's a no-match, not an error), so offering every tenant field here,
 * including ones a given document's own cabinet doesn't define, is safe.
 */
export function useAllMetadataFields() {
  const { data: cabinetsData, isLoading: isLoadingCabinets } = useCabinets();
  const cabinets = cabinetsData?.data || [];

  const detailQueries = useQueries({
    queries: cabinets.map((cabinet) => ({
      queryKey: cabinetKeys.detail(cabinet.id),
      queryFn: () => cabinetsService.getById(cabinet.id),
      enabled: cabinets.length > 0,
    })),
  });

  const isLoading = isLoadingCabinets || detailQueries.some((q) => q.isLoading);

  const fields: MetadataFieldOption[] = detailQueries.flatMap((q, i) => {
    const cabinet = cabinets[i];
    return (q.data?.metadataFields || []).map((field) => ({
      ...field,
      cabinetName: cabinet?.name || 'Unknown cabinet',
    }));
  });

  return { data: fields, isLoading };
}
