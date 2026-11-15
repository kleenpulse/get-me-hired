// Saves a file on the user's device. Nothing leaves the browser.

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before letting go of the file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(name: string, text: string, type = 'text/plain'): void {
  downloadBlob(name, new Blob([text], { type: `${type};charset=utf-8` }));
}
