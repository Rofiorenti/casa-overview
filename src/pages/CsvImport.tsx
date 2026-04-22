import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useData } from '@/hooks/useData';

export function CsvImportButton({ variant = 'ember', size, className }: Pick<ButtonProps, 'variant' | 'size' | 'className'>) {
  const { importCsv } = useData();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const onPick: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      await importCsv(text);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <Upload className="w-3.5 h-3.5" />
        {busy ? 'Importo…' : 'Importa CSV'}
      </Button>
    </>
  );
}
