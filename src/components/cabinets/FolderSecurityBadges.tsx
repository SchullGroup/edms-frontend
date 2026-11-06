import React from 'react';
import { ConfBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';
import { titleCase } from '@/utils/helpers';
import { effectiveFolderTier, restrictingFolder } from '@/utils/folders';
import type { Folder } from '@/types/models';

/**
 * Tier and "Custom access" markers for one folder, worked out from its whole path.
 * `compact` draws icons only (narrow tree); `block` wraps badges onto their own row.
 */
export function FolderSecurityBadges({
  folders,
  id,
  variant = 'inline',
}: {
  folders: Folder[];
  id: string;
  variant?: 'inline' | 'compact' | 'block';
}) {
  const tier = effectiveFolderTier(folders, id);
  const restrictor = restrictingFolder(folders, id);
  if (!tier && !restrictor) return null;

  const tierTitle = tier
    ? `Confidentiality: ${titleCase(tier.tier)}${tier.from.id === id ? '' : ` (set on ${tier.from.name})`}`
    : '';
  const accessTitle = restrictor
    ? restrictor.id === id
      ? 'Custom access: this folder uses its own access list'
      : `Custom access: limited by ${restrictor.name}`
    : '';

  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-1" style={{ marginLeft: 6, flexShrink: 0 }}>
        {tier && (
          <span
            className={`badge b-conf-${tier.tier.replace(/_/g, '-')}`}
            style={{ padding: '2.5px 5px' }}
            title={tierTitle}
            aria-label={tierTitle}
            role="img"
          >
            <Icon name="lock" size={10} />
          </span>
        )}
        {restrictor && (
          <span
            className="badge b-status-on-hold"
            style={{ padding: '2.5px 5px' }}
            title={accessTitle}
            aria-label={accessTitle}
            role="img"
          >
            <Icon name="shield" size={10} />
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      style={
        variant === 'block'
          ? { flexWrap: 'wrap', marginTop: 6, maxWidth: '100%' }
          : { marginLeft: 6 }
      }
    >
      {tier && (
        <span title={tierTitle}>
          <ConfBadge level={tier.tier} />
        </span>
      )}
      {restrictor && (
        <span className="badge b-status-on-hold" title={accessTitle}>
          <Icon name="shield" size={10} /> Custom access
        </span>
      )}
    </span>
  );
}
