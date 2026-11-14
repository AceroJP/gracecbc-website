import { LandingPagePreview } from "@/components/admin/landing-page-preview";
import { requireAdminUser } from "@/lib/auth/server";
import { getLandingPageData } from "@/lib/landing-page-data";

export const dynamic = "force-dynamic";
export default async function PreviewPage() {
  await requireAdminUser();
  const data = await getLandingPageData();
  return <LandingPagePreview data={data} />;
}
