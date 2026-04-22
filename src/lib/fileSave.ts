/**
 * File save utility con fallback nativo/browser.
 *
 * Browser dev: usa il classico URL.createObjectURL + a.click
 * Capacitor nativo: salva nel Documents folder via Filesystem e apre
 *                   il dialog Share per farlo condividere/salvare
 *                   dall'utente.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Salva una stringa (CSV, TXT, ecc.) come file */
export async function saveTextFile(
  filename: string,
  content: string,
  mimeType: string = 'text/plain',
): Promise<void> {
  console.log('[SAVE] saveTextFile', filename, 'bytes=', content.length);
  if (Capacitor.isNativePlatform()) {
    await saveNative(filename, content, false);
  } else {
    saveBrowser(filename, content, mimeType);
  }
}

/** Salva un blob (PDF, immagini, ecc.) come file.
 *  Su nativo il blob viene serializzato in base64.
 */
export async function saveBlobFile(
  filename: string,
  blob: Blob,
): Promise<void> {
  console.log('[SAVE] saveBlobFile', filename, 'size=', blob.size);
  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    await saveNative(filename, base64, true);
  } else {
    saveBrowserBlob(filename, blob);
  }
}

// ============================================================================
// Browser implementation
// ============================================================================

function saveBrowser(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  saveBrowserBlob(filename, blob);
}

function saveBrowserBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ============================================================================
// Native implementation (Capacitor)
// ============================================================================

async function saveNative(filename: string, content: string, isBase64: boolean): Promise<void> {
  try {
    // Su Mac Catalyst / iOS salviamo in Documents (directory privata app)
    // e poi apriamo il dialog Share per far scegliere all'utente dove spostarlo.
    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
      encoding: isBase64 ? undefined : Encoding.UTF8,
      recursive: true,
    });
    console.log('[SAVE] Scritto in:', result.uri);

    // Apre il dialog di condivisione nativo (AirDrop, Salva su File, Mail, ecc.)
    try {
      await Share.share({
        title: filename,
        url: result.uri,
        dialogTitle: 'Salva o condividi',
      });
    } catch (shareErr: any) {
      // Se lo share fallisce (es. utente annulla), il file è comunque salvato
      console.log('[SAVE] Share chiuso/cancellato:', shareErr?.message);
    }
  } catch (e: any) {
    console.error('[SAVE] Errore nativo:', e);
    throw new Error(`Salvataggio file fallito: ${e?.message ?? e}`);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Rimuove il prefisso "data:...;base64,"
      const base64 = result.substring(result.indexOf(',') + 1);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
