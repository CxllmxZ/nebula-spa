import { SectionEyebrow, GoldDivider } from "./section-eyebrow";

export function AboutSection() {
  return (
    <section
      id="about"
      className="relative overflow-hidden px-[clamp(1.5rem,5vw,6rem)] py-20 md:py-32"
      style={{
        background:
          "linear-gradient(180deg, #0F1024 0%, #14152A 50%, #0F1024 100%)",
      }}
    >
      {/* Ambient nebula */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[20%] h-[600px] w-[600px] blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(75,63,114,0.55), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[10%] left-[-8%] h-[400px] w-[400px] blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(201,169,97,0.08), transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <SectionEyebrow number="02" label="About" />
        <h2 className="mt-5 font-serif text-4xl font-medium leading-[1.55] tracking-wide text-foreground md:text-5xl">
          หนึ่งค่ำคืน
          <br />
          <span className="font-normal italic text-primary">หลายจักรวาล</span>
        </h2>
        <GoldDivider className="mx-auto mt-10" />

        <div
          className="mt-10 flex flex-col gap-6 text-left text-base font-normal leading-[1.85] tracking-wide text-foreground/80 md:text-center md:text-lg lg:text-xl"
          style={{ animation: "textStarGlow 6s ease-in-out infinite" }}
        >
          <p>
            Nebula Spa เกิดจากความเชื่อว่า
            การผ่อนคลายที่แท้จริงคือการหลุดออกจากเวลา
            ในห้องแสงสลัวที่หอมด้วยกลิ่นสมุนไพร คุณจะพบว่าโลกภายนอกช้าลง
            ในขณะที่ร่างกายและใจกลับมาสู่จังหวะของตัวเองอีกครั้ง
            นักบำบัดของเราผ่านการฝึกทั้งศาสตร์นวดไทยดั้งเดิมและเทคนิคน้ำมันหอมระเหยแบบสากล
            ทุกทริตเมนต์ออกแบบเฉพาะบุคคล
            จากแรงกดที่คุณต้องการไปจนถึงกลิ่นที่คุณอยากได้
          </p>
          <p>
            จองออนไลน์ตลอด 24 ชั่วโมง — เลือกบริการ เลือกเวลา
            ยืนยันได้ในไม่กี่คลิก
          </p>
        </div>
      </div>
    </section>
  );
}
