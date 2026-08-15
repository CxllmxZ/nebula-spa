import { getActiveServices } from "@/lib/db/queries/services"; // ← ปรับ path ถ้าต่าง
import { HeroSection } from "./_components/hero-section";
import { ServicesGrid } from "./_components/services-grid";
import { AboutSection } from "./_components/about-section";
import { FooterCta } from "./_components/footer-cta";
import { VisitSection } from "./_components/visit-section";

export default async function PublicHome() {
  const services = await getActiveServices();

  return (
    <>
      <HeroSection />
      <ServicesGrid services={services} />
      <AboutSection />
      <VisitSection />
      <FooterCta />
    </>
  );
}
