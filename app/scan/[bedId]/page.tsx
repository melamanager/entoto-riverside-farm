import { redirect } from "next/navigation";

export default async function ScanRedirect({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = await params;
  redirect(`/beds/${bedId}`);
}
