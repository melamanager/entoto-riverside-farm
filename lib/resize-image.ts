// Shrink an uploaded image to a small square-ish JPEG data URL before it ever
// reaches the database. Staff portraits are stored inline (base64), so keeping
// them ~10 KB matters: a full-size phone photo would be megabytes per row and
// would bloat every query that touches Farmer.
export function resizeImage(file: File, maxPx = 200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Not a readable image"));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * A disease photo, sized for diagnosis rather than for a thumbnail.
 *
 * These are what the AI actually looks at, so they keep far more detail than a
 * staff portrait — but a raw phone capture is 4–11 MB as base64 and goes
 * straight into a database row. 1280 px at q0.8 keeps lesions and leaf texture
 * readable at a few hundred KB, which matters doubly now that one report can
 * carry several angles.
 */
export function resizeDiseasePhoto(file: File): Promise<string> {
  return resizeImage(file, 1280, 0.8);
}
