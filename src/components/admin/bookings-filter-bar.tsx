"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  BOOKING_STATUS_CONFIG,
  BOOKING_STATUS_LIST,
} from "@/lib/booking-status";
import type { BookingStatus } from "@/lib/db/queries/bookings";
import type { AdminBookingFilter } from "@/lib/validations";
import type { Service } from "@/lib/db/schema";

const ALL_SERVICES_VALUE = "__all__";

interface Props {
  initialFilter: AdminBookingFilter;
  services: Service[];
}

export function BookingsFilterBar({ initialFilter, services }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    initialFilter.dateFrom
      ? parse(initialFilter.dateFrom, "yyyy-MM-dd", new Date())
      : undefined,
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    initialFilter.dateTo
      ? parse(initialFilter.dateTo, "yyyy-MM-dd", new Date())
      : undefined,
  );
  const [statuses, setStatuses] = useState<BookingStatus[]>(
    initialFilter.status ?? [],
  );
  const [serviceId, setServiceId] = useState<string>(
    initialFilter.serviceId
      ? String(initialFilter.serviceId)
      : ALL_SERVICES_VALUE,
  );
  const [search, setSearch] = useState(initialFilter.search ?? "");

  // Track "dirty" search for debounce (don't apply on mount)
  const [searchDebounced, setSearchDebounced] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip on mount — URL already reflects initialFilter, no need to re-push
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", format(dateFrom, "yyyy-MM-dd"));
    if (dateTo) params.set("dateTo", format(dateTo, "yyyy-MM-dd"));
    if (statuses.length > 0) params.set("status", statuses.join(","));
    if (serviceId && serviceId !== ALL_SERVICES_VALUE) {
      params.set("serviceId", serviceId);
    }
    if (searchDebounced) params.set("search", searchDebounced);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/admin/bookings?${qs}` : "/admin/bookings");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, statuses, serviceId, searchDebounced]);

  function toggleStatus(s: BookingStatus) {
    /*setStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );*/
    setStatuses((prev) => (prev[0] === s ? [] : [s]));
  }

  function reset() {
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatuses([]);
    setServiceId(ALL_SERVICES_VALUE);
    setSearch("");
  }

  const hasActiveFilter =
    dateFrom ||
    dateTo ||
    statuses.length > 0 ||
    serviceId !== ALL_SERVICES_VALUE ||
    search;

  return (
    <div className={cn("space-y-4", isPending && "opacity-70")}>
      {/* Row 1: date range + service + search */}
      <div className="grid gap-3 md:grid-cols-4">
        {/* Date From */}
        <div className="space-y-1.5">
          <Label className="text-xs">ตั้งแต่วันที่</Label>
          <DatePicker date={dateFrom} onChange={setDateFrom} />
        </div>

        {/* Date To */}
        <div className="space-y-1.5">
          <Label className="text-xs">ถึงวันที่</Label>
          <DatePicker date={dateTo} onChange={setDateTo} />
        </div>

        {/* Service */}
        <div className="space-y-1.5">
          <Label className="text-xs">บริการ</Label>
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SERVICES_VALUE}>ทุกบริการ</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="space-y-1.5">
          <Label className="text-xs">ค้นหา (ชื่อ / เบอร์ / รหัส)</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="พิมพ์เพื่อค้นหา..."
          />
        </div>
      </div>

      {/* Row 2: status pills + reset */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">สถานะ:</span>
        {BOOKING_STATUS_LIST.map((s) => {
          const active = statuses.includes(s);
          const cfg = BOOKING_STATUS_CONFIG[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <Badge
                variant={active ? cfg.variant : "outline"}
                className={cn(
                  "cursor-pointer transition-opacity",
                  !active && "opacity-50 hover:opacity-100",
                )}
              >
                {cfg.label}
              </Badge>
            </button>
          );
        })}

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="ml-auto text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>
    </div>
  );
}

/** Popover + Calendar date picker — inline component */
function DatePicker({
  date,
  onChange,
}: {
  date: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "d MMM yyyy") : "เลือกวันที่"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  );
}
