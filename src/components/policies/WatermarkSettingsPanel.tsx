'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  useResetWatermarkSettings,
  useUpdateWatermarkSettings,
  useWatermarkPreview,
  useWatermarkSettings,
} from '@/apis/hooks/useWatermarkSettings';
import { useUIStore } from '@/store/useUIStore';
import { SkeletonText } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { loadPdfJs, PDFJS_ASSETS } from '@/lib/pdfjs';
import { fmtDate } from '@/utils/helpers';
import type { WatermarkFields, WatermarkSettings } from '@/types/models';

const FIELDS: { key: keyof WatermarkFields; label: string; help: string }[] = [
  {
    key: 'includeName',
    label: 'Viewer’s name',
    help: 'Who opened, printed or downloaded the file.',
  },
  { key: 'includeIpAddress', label: 'IP address', help: 'The network address they used.' },
  { key: 'includeTimestamp', label: 'Date and time', help: 'When the file was served, in UTC.' },
];

function fieldsOf(s: WatermarkSettings): WatermarkFields {
  return {
    includeName: s.includeName,
    includeIpAddress: s.includeIpAddress,
    includeTimestamp: s.includeTimestamp,
  };
}

/** What the server's watermark says (`/settings/watermark`). The server draws it
 *  into every PDF and image it serves; the app adds no mark of its own. */
export function WatermarkSettingsPanel() {
  const { openConfirm } = useUIStore();
  const { data: saved, isLoading, isError, refetch } = useWatermarkSettings();
  const update = useUpdateWatermarkSettings();
  const reset = useResetWatermarkSettings();
  const preview = useWatermarkPreview();
  const [draft, setDraft] = useState<WatermarkFields | null>(null);

  // Resync whenever the saved settings change (first load, a save or a reset).
  useEffect(() => {
    if (saved) setDraft(fieldsOf(saved));
  }, [saved]);

  if (isLoading || (saved && !draft)) {
    return (
      <div className="card card-pad">
        <SkeletonText lines={5} />
      </div>
    );
  }
  if (isError || !saved || !draft) {
    return <ErrorMessage message="Failed to load watermark settings." retry={refetch} />;
  }

  const dirty = FIELDS.some((f) => draft[f.key] !== saved[f.key]);
  const onCount = FIELDS.filter((f) => draft[f.key]).length;
  const isDefault = FIELDS.every((f) => saved[f.key]);
  const busy = update.isPending || reset.isPending;

  const change = (fields: WatermarkFields) => {
    setDraft(fields);
    // The sample no longer matches the switches.
    preview.reset();
  };

  return (
    <div className="grid" style={{ gap: '16px' }}>
      <div className="banner info" style={{ marginBottom: 0 }}>
        Every PDF and image carries a diagonal watermark on screen, in print and in downloaded
        copies. A saved change applies from the next time a file is opened; copies already
        downloaded keep the mark they have.
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">What the watermark shows</span>
          {saved.updatedBy && (
            <span className="caption">Last changed {fmtDate(saved.updatedAt)}</span>
          )}
        </div>
        <div className="card-body grid" style={{ gap: '16px' }}>
          {FIELDS.map((f) => {
            const last = draft[f.key] && onCount === 1;
            return (
              <div key={f.key} className="flex items-center gap-3">
                <label
                  className="switch"
                  title={last ? 'The watermark has to show at least one of these' : undefined}
                >
                  <input
                    type="checkbox"
                    aria-label={f.label}
                    aria-describedby={`wm-${f.key}`}
                    checked={draft[f.key]}
                    disabled={busy || last}
                    onChange={(e) => change({ ...draft, [f.key]: e.target.checked })}
                  />
                  <i></i>
                </label>
                <div>
                  <b>{f.label}</b>
                  <div className="help" id={`wm-${f.key}`} style={{ marginTop: 0 }}>
                    {f.help}
                    {last && ' At least one has to stay on.'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          disabled={preview.isPending}
          onClick={() => preview.mutate(draft)}
        >
          {preview.isPending ? 'Preparing…' : 'Preview'}
        </button>
        <button
          className="btn btn-secondary"
          disabled={isDefault || busy}
          onClick={() =>
            openConfirm({
              title: 'Reset the watermark?',
              message:
                'The watermark goes back to showing the viewer’s name, IP address, and date and time.',
              confirmLabel: 'Reset',
              onConfirm: () =>
                reset.mutateAsync().then(
                  () => preview.reset(),
                  () => false,
                ),
            })
          }
        >
          Reset to defaults
        </button>
        <div className="flex gap-2" style={{ marginLeft: 'auto' }}>
          <button
            className="btn btn-secondary"
            disabled={!dirty || busy}
            onClick={() => change(fieldsOf(saved))}
          >
            Discard
          </button>
          <button
            className="btn btn-primary"
            disabled={!dirty || busy}
            onClick={() => update.mutate(draft)}
          >
            {update.isPending ? 'Saving…' : 'Save watermark'}
          </button>
        </div>
      </div>

      {preview.isError && (
        <div className="banner error" role="alert" style={{ marginBottom: 0 }}>
          The preview couldn’t be made. {preview.error.message}
        </div>
      )}
      {preview.data && (
        <div className="card">
          <div className="card-head">
            <span className="h3">Preview</span>
            <span className="caption">
              {dirty ? 'A sample page. These changes aren’t saved yet.' : 'A sample page.'}
            </span>
          </div>
          <div className="card-body" style={{ background: 'var(--surface)' }}>
            <SamplePage file={preview.data} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Draws the sample PDF's one page. */
function SamplePage({ file }: { file: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setFailed(false);
    (async () => {
      try {
        const [lib, data] = await Promise.all([loadPdfJs(), file.arrayBuffer()]);
        if (cancelled) return;
        const task = lib.getDocument({ data: new Uint8Array(data), ...PDFJS_ASSETS });
        destroy = () => void task.destroy();
        const page = await (await task.promise).getPage(1);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const viewport = page.getViewport({ scale: 2 });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [file]);

  if (failed) return <ErrorMessage message="The preview couldn’t be shown." />;
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Sample page with the watermark"
      style={{
        display: 'block',
        width: '100%',
        maxWidth: 560,
        margin: '0 auto',
        background: '#fff',
        border: '1px solid var(--border)',
      }}
    />
  );
}
