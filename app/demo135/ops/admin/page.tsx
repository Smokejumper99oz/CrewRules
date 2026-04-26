import { getAircraftHeroImageFallback } from "@/lib/ops/aircraft-hero-image";
import { resolveAircraftHeroImageUrl } from "@/lib/ops/aircraft-hero-image.server";
import { createClient } from "@/lib/supabase/server";
import { DemoOpsAdminPageClient } from "./demo-ops-admin-page-client";
import { DemoOpsShell } from "./demo-ops-shell";

export default async function Demo135OpsAdminPage() {
  const supabase = await createClient();
  const heroAircraftImageSrc = await resolveAircraftHeroImageUrl(supabase, {
    tenant: "demo135",
    tailNumber: "HS-125",
  });
  const heroImageIsCustom = heroAircraftImageSrc !== getAircraftHeroImageFallback();
  return (
    <DemoOpsShell>
      <DemoOpsAdminPageClient
        heroAircraftImageSrc={heroAircraftImageSrc}
        heroImageIsCustom={heroImageIsCustom}
        heroUpload={{ tenant: "demo135", tailNumber: "HS-125" }}
      />
    </DemoOpsShell>
  );
}
