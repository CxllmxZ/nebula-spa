import type { Metadata } from "next";
import Link from "next/link";

/**
 * นโยบายความเป็นส่วนตัว (PDPA) — Day 42
 *
 * ครอบคลุมสิ่งที่ประกาศความเป็นส่วนตัวต้องบอก (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล 2562):
 *   ข้อมูลที่เก็บ · วัตถุประสงค์ + ฐานทางกฎหมาย · ระยะเวลาเก็บ · การเปิดเผย/ส่งต่างประเทศ
 *   · สิทธิของเจ้าของข้อมูล + วิธีใช้สิทธิ · ข้อมูลผู้ควบคุมข้อมูล
 *
 * ⚠️ ระยะเวลาเก็บต้องตรงกับระบบจริง: ANONYMIZE_AFTER_DAYS ใน custom-worker.ts (183 วัน)
 *    แก้ตัวเลขที่ไหน ต้องแก้อีกที่ด้วย
 *
 * ⚠️ แม่แบบสำหรับเดโม — ร้านที่ใช้จริงต้องแก้ SHOP ด้านล่าง + ให้ผู้เชี่ยวชาญกฎหมายตรวจ
 */

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว — Nebula Spa",
};

/** ข้อมูลผู้ควบคุมข้อมูล — ร้านที่ซื้อระบบไปแก้ตรงนี้ */
const SHOP = {
  name: "Nebula Spa",
  address: "123 ถนน... กรุงเทพ (ที่อยู่ตัวอย่างสำหรับเดโม)",
  line: process.env.NEXT_PUBLIC_LINE_OA_BASIC_ID || "-",
  phone: "0X-XXX-XXXX (เบอร์ตัวอย่างสำหรับเดโม)",
};

const UPDATED_AT = "4 พฤศจิกายน 2569";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-[clamp(1.5rem,5vw,6rem)] py-16 md:py-24">
      <div className="mb-12 text-center">
        <div className="text-sm font-medium uppercase tracking-[0.32em] text-primary md:text-base">
          Privacy
        </div>
        <h1 className="mt-5 font-serif text-3xl font-medium leading-[1.55] tracking-wide text-foreground md:text-4xl">
          นโยบายความเป็นส่วนตัว
        </h1>
        <div className="mx-auto mt-8 h-px w-10 bg-primary" />
        <p className="mt-6 text-xs tracking-wide text-foreground/50">
          ปรับปรุงล่าสุด {UPDATED_AT}
        </p>
      </div>

      <div className="mb-10 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed tracking-wide text-foreground/80">
        เว็บไซต์นี้เป็น
        <strong className="font-medium">ระบบตัวอย่าง (เดโม)</strong>{" "}
        ข้อความในหน้านี้เป็นแม่แบบ ร้านที่นำไปใช้จริงควรปรับให้ตรงกับธุรกิจ
        และให้ผู้เชี่ยวชาญด้านกฎหมายตรวจสอบก่อนใช้งาน
      </div>

      <div className="space-y-10 text-sm leading-relaxed tracking-wide text-foreground/80">
        <Section title="1. ผู้เก็บข้อมูลของคุณ">
          <p>
            {SHOP.name} (&quot;ร้าน&quot;)
            เป็นผู้ควบคุมข้อมูลส่วนบุคคลที่คุณให้ไว้ผ่านระบบจองนี้
          </p>
          <InfoList
            items={[
              ["ที่อยู่", SHOP.address],
              ["LINE", SHOP.line],
              ["โทร", SHOP.phone],
            ]}
          />
        </Section>

        <Section title="2. ข้อมูลที่เราเก็บ">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-medium">ข้อมูลการจอง:</strong> ชื่อ
              เบอร์โทร บริการ วันเวลาที่จอง และหมายเหตุที่คุณกรอก
            </li>
            <li>
              <strong className="font-medium">
                ข้อมูล LINE (เฉพาะเมื่อคุณกดเชื่อม LINE):
              </strong>{" "}
              รหัสผู้ใช้ LINE (user ID) ชื่อและรูปโปรไฟล์ LINE ซึ่ง LINE
              ส่งให้หลังคุณกดยินยอมบนหน้าจอของ LINE
            </li>
            <li>
              <strong className="font-medium">การยกเลิกผ่าน LINE:</strong>{" "}
              เวลาที่ยกเลิก และสาเหตุ (ถ้าคุณเลือกตอบ)
            </li>
            <li>
              <strong className="font-medium">ข้อมูลกันระบบอัตโนมัติ:</strong>{" "}
              ตอนกดจอง ระบบใช้ Cloudflare Turnstile ตรวจว่าไม่ใช่บอท
              ซึ่งอาจอ่านข้อมูลทางเทคนิคของอุปกรณ์และเบราว์เซอร์
            </li>
          </ul>
          <p>เราไม่ได้เก็บข้อมูลบัตรเครดิต และไม่ได้ขอข้อมูลสุขภาพ</p>
        </Section>

        <Section title="3. เราใช้ข้อมูลทำอะไร">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-medium">รับจองและให้บริการ</strong> —
              บันทึกคิว แจ้งร้านและพนักงาน ติดต่อคุณเรื่องการนัด (ฐานทางกฎหมาย:
              จำเป็นเพื่อให้บริการตามที่คุณขอจอง)
            </li>
            <li>
              <strong className="font-medium">
                ส่งรายละเอียดการจองทาง LINE
              </strong>{" "}
              และให้คุณยกเลิกผ่าน LINE ได้ — เฉพาะเมื่อคุณเลือกเชื่อม LINE เอง
              (ฐานทางกฎหมาย: ความยินยอมของคุณ)
            </li>
            <li>
              <strong className="font-medium">ปรับปรุงบริการของร้าน</strong> —
              ดูสถิติ เช่น บริการยอดนิยม อัตราการยกเลิก และสาเหตุ (ฐานทางกฎหมาย:
              ประโยชน์โดยชอบด้วยกฎหมายของร้าน)
            </li>
          </ul>
          <p>เราไม่ขายข้อมูลของคุณ และไม่ใช้ส่งโฆษณา</p>
        </Section>

        <Section title="4. เราเก็บข้อมูลนานแค่ไหน">
          <p>
            เราเก็บชื่อและเบอร์โทรไว้ตราบที่คุณยังใช้บริการ ถ้าเบอร์ของคุณ
            <strong className="font-medium">ไม่มีการจองเลยเกิน 6 เดือน</strong>{" "}
            (นับจากวันนัดครั้งล่าสุด) ระบบจะปิดบังข้อมูลโดยอัตโนมัติภายใน 1
            เดือนหลังจากนั้น:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>ชื่อเหลือแค่อักษรตัวแรก เบอร์โทรและหมายเหตุถูกลบ</li>
            <li>ยกเลิกการเชื่อมต่อ LINE</li>
            <li>
              ข้อมูลที่ระบุตัวคุณไม่ได้แล้ว (บริการ วันที่ ราคา สถานะ)
              ร้านยังเก็บไว้ใช้ทำสถิติ
            </li>
          </ul>
        </Section>

        <Section title="5. ใครเห็นข้อมูลของคุณ">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-medium">เจ้าของร้าน</strong>{" "}
              เห็นข้อมูลการจองทั้งหมด
            </li>
            <li>
              <strong className="font-medium">
                พนักงานในกลุ่ม LINE ของร้าน
              </strong>{" "}
              เห็นเวลา บริการ ชื่อ และหมายเหตุ —{" "}
              <strong className="font-medium">ไม่เห็นเบอร์โทร</strong>
            </li>
            <li>
              <strong className="font-medium">ผู้ให้บริการระบบ</strong>{" "}
              ที่ร้านใช้ประมวลผลข้อมูลแทนร้าน: Cloudflare
              (เซิร์ฟเวอร์และฐานข้อมูล) และ LINE (ส่งข้อความ) ถ้าร้านเปิดใช้
              Google Sheets จะส่งข้อมูลการยกเลิกไปที่ Google Sheets ของร้านด้วย
            </li>
          </ul>
          <p>
            ผู้ให้บริการเหล่านี้อาจเก็บข้อมูลบนเซิร์ฟเวอร์นอกประเทศไทย
            ซึ่งแต่ละรายมีมาตรการคุ้มครองข้อมูลของตัวเอง
          </p>
        </Section>

        <Section title="6. สิทธิของคุณ">
          <p>ตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล คุณมีสิทธิ:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>ขอดูหรือขอสำเนาข้อมูลของคุณ</li>
            <li>ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
            <li>ขอให้ลบ หรือทำให้ข้อมูลระบุตัวคุณไม่ได้</li>
            <li>คัดค้าน หรือขอให้ระงับการใช้ข้อมูล</li>
            <li>
              ถอนความยินยอมเรื่อง LINE ได้ทุกเมื่อ (บล็อกหรือลบเพื่อน LINE
              ของร้าน ระบบจะหยุดส่งข้อความหาคุณ)
            </li>
            <li>
              ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)
            </li>
          </ul>
          <p>
            ใช้สิทธิได้โดยติดต่อร้านตามช่องทางในข้อ 1 ร้านจะดำเนินการโดยเร็ว
            และไม่เกิน 90 วันนับจากได้รับคำขอ
          </p>
        </Section>

        <Section title="7. การรักษาความปลอดภัย">
          <p>
            ข้อมูลส่งผ่านการเชื่อมต่อที่เข้ารหัส (HTTPS)
            หน้าจัดการร้านต้องเข้าสู่ระบบ
            และพนักงานเห็นเฉพาะข้อมูลที่จำเป็นต่อการทำงาน
          </p>
        </Section>

        <Section title="8. การเปลี่ยนแปลงนโยบาย">
          <p>
            ถ้าเราแก้ไขนโยบายนี้ จะแสดงวันที่ปรับปรุงล่าสุดไว้ด้านบนของหน้านี้
          </p>
        </Section>
      </div>

      <div className="mt-14 text-center">
        <Link
          href="/book"
          className="text-sm tracking-wide text-primary underline-offset-4 hover:underline"
        >
          ← กลับไปหน้าจอง
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg font-medium tracking-wide text-foreground md:text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoList({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-foreground/50">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
