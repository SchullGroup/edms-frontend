'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icons';

type Mime = 'image/png' | 'image/jpeg' | 'image/webp';

interface Props {
  /** Fires with the current signature image (or null when cleared). */
  onChange: (result: { blob: Blob; mimeType: Mime } | null) => void;
  width?: number;
  height?: number;
}

/**
 * Draw-to-sign canvas with an "upload an image instead" fallback. Produces a
 * PNG blob from the drawing, or passes an uploaded PNG/JPEG/WebP straight
 * through. The consumer uploads the blob and sends the resulting URL as the
 * `signature` on an `approve` task action.
 */
export function SignaturePad({ onChange, width = 460, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [mode, setMode] = useState<'draw' | 'file'>('draw');
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1F3864';
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emitFromCanvas();
  };

  const emitFromCanvas = () => {
    if (!hasInk.current) return onChange(null);
    canvasRef.current!.toBlob((blob) => {
      if (blob) onChange({ blob, mimeType: 'image/png' });
    }, 'image/png');
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
    onChange(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed: Mime[] = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type as Mime)) {
      onChange(null);
      setFileName(null);
      alert('Signature image must be PNG, JPEG or WebP.');
      return;
    }
    setFileName(file.name);
    onChange({ blob: file, mimeType: file.type as Mime });
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          className={`btn btn-sm ${mode === 'draw' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMode('draw');
            clear();
          }}
        >
          <Icon name="edit" size={13} /> Draw
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMode('file');
            clear();
            fileRef.current?.click();
          }}
        >
          <Icon name="upload" size={13} /> Upload image
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
          Clear
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={onFile}
      />

      {mode === 'draw' ? (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          style={{
            width: '100%',
            maxWidth: width,
            height,
            border: '1px dashed var(--brand-primary-light)',
            borderRadius: 6,
            background: '#f8fafe',
            touchAction: 'none',
            cursor: 'crosshair',
          }}
        />
      ) : (
        <div
          className="card card-pad"
          style={{
            textAlign: 'center',
            border: '1px dashed var(--brand-primary-light)',
            background: '#f8fafe',
          }}
        >
          {fileName ? (
            <span className="caption">Selected: {fileName}</span>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              Choose a PNG / JPEG / WebP file
            </button>
          )}
        </div>
      )}
    </div>
  );
}
