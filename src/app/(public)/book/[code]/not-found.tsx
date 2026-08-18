import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BookingNotFound() {
  return (
    <div className="mx-auto max-w-md px-[clamp(1.5rem,5vw,6rem)] py-24 text-center">
      <div className="text-sm font-medium uppercase tracking-[0.32em] text-primary md:text-base">
        Not Found
      </div>
      <h1 className="mt-5 font-serif text-3xl font-medium leading-[1.55] tracking-wide text-foreground md:text-4xl">
        ไม่พบการจองนี้
      </h1>
      <div className="mx-auto mt-8 h-px w-10 bg-primary" />
      <p className="mt-8 text-sm tracking-wide text-foreground/70">
        โค้ดที่คุณกรอกอาจไม่ถูกต้อง หรือการจองอาจถูกลบไปแล้ว
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="rounded-full px-8">
          <Link href="/book">จองใหม่</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="rounded-full border-primary/30 px-8"
        >
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </div>
  );
}
