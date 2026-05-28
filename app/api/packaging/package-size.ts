const PACKAGE_SIZE_MAP: Record<string, "p250g" | "p500g" | "p1kg" | "p2kg" | "bulk"> = {
  "250g": "p250g",
  "500g": "p500g",
  "1kg": "p1kg",
  "2kg": "p2kg",
  p250g: "p250g",
  p500g: "p500g",
  p1kg: "p1kg",
  p2kg: "p2kg",
  bulk: "bulk",
};

export function normalizePackageSize<T extends { packageSize?: unknown }>(body: T): T {
  if (typeof body.packageSize !== "string") return body;
  return {
    ...body,
    packageSize: PACKAGE_SIZE_MAP[body.packageSize] ?? body.packageSize,
  };
}
