"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepSection } from "./step-section";
import { ServicePicker } from "./service-picker";
import { DatePickerStep } from "./date-picker-step";
import { TimePicker } from "./time-picker";

type Service = {
  id: number;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
};

type Slot = { start: string; end: string };

type Props = {
  services: Service[];
  preselectedServiceId: number | null;
};

function formatThaiDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BookingFlow({ services, preselectedServiceId }: Props) {
  const [serviceId, setServiceId] = useState<number | null>(
    preselectedServiceId,
  );
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  // Fetch availability when service + date both set
  useEffect(() => {
    if (!serviceId || !date) return;
    setTime(null);
    setLoading(true);
    setFetchError(null);

    fetch(`/api/availability?serviceId=${serviceId}&date=${date}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ slots: Slot[] }>;
      })
      .then((data) => setSlots(data.slots ?? []))
      .catch((err) => {
        console.error(err);
        setFetchError("ไม่สามารถโหลดเวลาว่างได้ ลองรีเฟรช");
        setSlots([]);
      })
      .finally(() => setLoading(false));
  }, [serviceId, date]);

  const canContinue = Boolean(serviceId && date && time);

  const handleContinue = () => {
    if (!canContinue) return;
    // 8D จะทำต่อ — เก็บ state ไว้ก่อน
    console.log("→ 8D form step", { serviceId, date, time });
    alert(
      `ต่อไป 8D form step\nService: ${selectedService?.name}\nDate: ${date}\nTime: ${time}`,
    );
  };

  return (
    <div className="space-y-6 pb-32">
      {/* 01 Service */}
      <StepSection
        number="01"
        title="เลือกบริการ"
        status={serviceId ? "complete" : "active"}
        summary={
          selectedService
            ? `${selectedService.name} · ${selectedService.durationMin} นาที · ฿${selectedService.price.toLocaleString()}`
            : ""
        }
        onEdit={() => {
          setServiceId(null);
          setDate(null);
          setTime(null);
        }}
      >
        <ServicePicker
          services={services}
          selectedId={serviceId}
          onSelect={(id) => {
            setServiceId(id);
            setDate(null);
            setTime(null);
          }}
        />
      </StepSection>

      {/* 02 Date */}
      <StepSection
        number="02"
        title="เลือกวัน"
        status={!serviceId ? "locked" : date ? "complete" : "active"}
        summary={date ? formatThaiDate(date) : ""}
        onEdit={() => {
          setDate(null);
          setTime(null);
        }}
      >
        <DatePickerStep
          value={date}
          onSelect={(d) => {
            setDate(d);
            setTime(null);
          }}
        />
      </StepSection>

      {/* 03 Time */}
      <StepSection
        number="03"
        title="เลือกเวลา"
        status={!date ? "locked" : time ? "complete" : "active"}
        summary={time ? `${time} น.` : ""}
        onEdit={() => setTime(null)}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-foreground/60">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>กำลังโหลดเวลาว่าง...</span>
          </div>
        ) : fetchError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-foreground/80">
            {fetchError}
          </div>
        ) : (
          <TimePicker slots={slots} selectedTime={time} onSelect={setTime} />
        )}
      </StepSection>

      {/* Sticky Continue */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary/10 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-[clamp(1.5rem,5vw,6rem)] py-4">
          <div className="hidden text-xs tracking-widest text-foreground/60 sm:block">
            {canContinue ? (
              <span>
                {selectedService?.name} · {date && formatThaiDate(date)} ·{" "}
                {time} น.
              </span>
            ) : (
              <span>เลือกให้ครบ 3 ขั้นตอน</span>
            )}
          </div>
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            size="lg"
            className="ml-auto rounded-full px-8 py-6 text-sm tracking-[0.14em]"
          >
            ยืนยันต่อ →
          </Button>
        </div>
      </div>
    </div>
  );
}
