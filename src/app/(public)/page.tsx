import { LandingPageView } from "@/components/public/landing-page-view";
import { getLandingPageData, getLandingPageImageUrls } from "@/lib/landing-page-data";
import { getPublishedLandingPage } from "@/lib/landing-page-server";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [params, landingPage, data] = await Promise.all([searchParams, getPublishedLandingPage(), getLandingPageData()]);
  const imageUrls = await getLandingPageImageUrls(landingPage);
  return <LandingPageView data={data} imageUrls={imageUrls} landingPage={landingPage} show={params.show} />;
}
