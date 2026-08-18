"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { StepSection } from "./step-section";
import { ServicePicker } from "./service-picker";
import { DatePickerStep } from "./date-picker-step";
import { TimePicker } from "./time-picker";
import { CustomerForm } from "@/app/(public)/book/_components/customer-form";

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

  return (
    <div className="space-y-6">
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

      {/* 04 Customer info */}
      <StepSection
        number="04"
        title="ข้อมูลผู้จอง"
        status={!time || !date || !serviceId ? "locked" : "active"}
      >
        {serviceId && date && time && selectedService && (
          <CustomerForm
            booking={{
              serviceId,
              date,
              startTime: time,
            }}
            summary={`${selectedService.name} · ${formatThaiDate(date)} · ${time} น.`}
          />
        )}
      </StepSection>
    </div>
  );
}
