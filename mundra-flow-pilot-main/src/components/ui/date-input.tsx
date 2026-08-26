import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value?: string; // ISO format: "YYYY-MM-DD" or ""
  onChange?: (value: string) => void; // Emits ISO: "YYYY-MM-DD" or ""
  className?: string;
  disabled?: boolean;
}

export function DateInput({
  value = "",
  onChange,
  className,
  disabled,
  placeholder = "DD/MM/YYYY",
  id,
  ...props
}: DateInputProps) {
  // Convert ISO string (YYYY-MM-DD) to display string (DD/MM/YYYY)
  const isoToDisplay = (iso: string): string => {
    if (!iso) return "";
    try {
      const parsed = parse(iso, "yyyy-MM-dd", new Date());
      return isValid(parsed) ? format(parsed, "dd/MM/yyyy") : "";
    } catch {
      return "";
    }
  };

  // Convert display string (DD/MM/YYYY) to ISO (YYYY-MM-DD)
  const displayToIso = (display: string): string => {
    if (!display || display.length < 8) return "";
    try {
      // Support dd/MM/yyyy, dd-MM-yyyy, dd.MM.yyyy
      const clean = display.replace(/[-.]/g, "/");
      const parsed = parse(clean, "dd/MM/yyyy", new Date());
      return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : "";
    } catch {
      return "";
    }
  };

  const [displayText, setDisplayText] = React.useState<string>(() => isoToDisplay(value));
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  // Synchronize when external value changes
  React.useEffect(() => {
    setDisplayText(isoToDisplay(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Filter to allowed characters (digits, slash, dash)
    let cleaned = raw.replace(/[^\d/-]/g, "");

    // Auto-insert slashes if purely numeric input
    if (/^\d{3,8}$/.test(cleaned) && !cleaned.includes("/") && !cleaned.includes("-")) {
      if (cleaned.length <= 4) {
        cleaned = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
      } else {
        cleaned = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
      }
    }

    setDisplayText(cleaned);

    const iso = displayToIso(cleaned);
    if (iso) {
      onChange?.(iso);
    } else if (cleaned === "") {
      onChange?.("");
    }
  };

  const handleBlur = () => {
    const iso = displayToIso(displayText);
    if (iso) {
      setDisplayText(isoToDisplay(iso));
      onChange?.(iso);
    } else if (displayText.trim() !== "") {
      // If invalid date was typed, reset back to prop value
      setDisplayText(isoToDisplay(value));
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const iso = format(date, "yyyy-MM-dd");
      setDisplayText(format(date, "dd/MM/yyyy"));
      onChange?.(iso);
      setPopoverOpen(false);
    }
  };

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const parsed = parse(value, "yyyy-MM-dd", new Date());
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Input
        id={id}
        type="text"
        placeholder={placeholder}
        value={displayText}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        maxLength={10}
        className="pr-9 font-mono text-xs sm:text-sm"
        {...props}
      />
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0.5 h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Pick date from calendar"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
