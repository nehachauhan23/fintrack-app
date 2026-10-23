import { Select } from "@/components/ui/field";
import { categoriesFor } from "@/domain/categories";

export function CategorySelect({ type, value, onChange, allowAuto, id, ...rest }: { type: "INCOME" | "EXPENSE"; value: string; onChange: (v: string) => void; allowAuto?: boolean; id?: string } & Omit<React.ComponentProps<"select">, "value" | "onChange" | "type">) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {allowAuto && <option value="">Pick for me</option>}
      {categoriesFor(type).map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </Select>
  );
}
