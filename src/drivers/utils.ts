import type { Buffer } from "buffer";

export function download_buffer(img: Buffer) {
  const blob = new Blob([img], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "output.bin";
  document.body.appendChild(a);
  a.click();

  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
