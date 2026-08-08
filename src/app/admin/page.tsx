import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminHome() {
  return (
    <div className="container mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">แดชบอร์ด</h1>
        <p className="text-muted-foreground">
          Nebula Spa — Admin Panel (Session 7A smoke test)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme + Component Smoke Test</CardTitle>
          <CardDescription>
            ทดสอบ Nova preset + IBM Plex Sans Thai + shadcn components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button>ปุ่มหลัก</Button>
            <Button variant="secondary">ปุ่มรอง</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">ลบ</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>Confirmed</Badge>
            <Badge variant="secondary">Pending</Badge>
            <Badge variant="outline">Completed</Badge>
            <Badge variant="destructive">Cancelled</Badge>
          </div>

          <div className="grid gap-2 max-w-sm">
            <Label htmlFor="test-name">ชื่อลูกค้า</Label>
            <Input id="test-name" placeholder="พิมพ์ชื่อภาษาไทย..." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
