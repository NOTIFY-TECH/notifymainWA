'use client';

import { useRef, useState } from 'react';
import { useImportContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export default function ImportContactsModal({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useImportContacts();

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith('.csv')) {
      alert('Only .csv files are accepted');
      return;
    }
    setFile(selected);
    setResult(null);
  };

  const handleUpload = () => {
    if (!file) return;
    mutate(file, {
      onSuccess: data => setResult(data),
    });
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Import Contacts</h2>
          <button
            onClick={handleClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Format note */}
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Upload a <span className="font-medium text-[hsl(var(--foreground))]">.csv</span> file with columns:{' '}
            <span className="font-mono text-[10px] bg-[hsl(var(--muted))] px-1 py-0.5 rounded">name</span>,{' '}
            <span className="font-mono text-[10px] bg-[hsl(var(--muted))] px-1 py-0.5 rounded">phoneNumber</span>,{' '}
            <span className="font-mono text-[10px] bg-[hsl(var(--muted))] px-1 py-0.5 rounded">email</span> (optional),{' '}
            <span className="font-mono text-[10px] bg-[hsl(var(--muted))] px-1 py-0.5 rounded">tags</span> (optional,
            comma-separated). Existing contacts are updated by phone number.
          </p>

          {/* File picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[hsl(var(--border))] rounded-lg py-8 cursor-pointer hover:border-[#22C55E]/50 transition-colors"
          >
            {file ? (
              <>
                <FileText className="w-6 h-6 text-[hsl(var(--green))]" />
                <p className="text-xs font-medium text-[hsl(var(--foreground))]">{file.name}</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </p>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6 text-[hsl(var(--muted-foreground))]" />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Click to select a CSV file</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

          {/* Result summary */}
          {result && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--foreground))]">
                <CheckCircle className="w-4 h-4 text-[hsl(var(--green))]" />
                Import complete
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Created', value: result.created },
                  { label: 'Updated', value: result.updated },
                  { label: 'Skipped', value: result.skipped },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-center">
                    <p className="text-base font-semibold text-[hsl(var(--foreground))]">{value}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</p>
                  </div>
                ))}
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    {result.errors.length} row{result.errors.length > 1 ? 's' : ''} had errors
                  </div>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Row {e.row}: {e.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[hsl(var(--border))]">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              size="sm"
              disabled={!file || isPending}
              onClick={handleUpload}
              className="bg-[#22C55E]/20 border border-[#22C55E]/30 text-[hsl(var(--green))] hover:bg-[#22C55E]/30"
            >
              {isPending ? 'Importing…' : 'Import'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
