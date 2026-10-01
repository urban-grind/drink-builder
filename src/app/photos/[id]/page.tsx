import { redirect } from "next/navigation";
import { photoCodeForId } from "@/lib/photos";
import { photoEntryPath } from "@/lib/first-name";

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = photoCodeForId(id);
  if (code) redirect(photoEntryPath(code));
  redirect("/");
}
