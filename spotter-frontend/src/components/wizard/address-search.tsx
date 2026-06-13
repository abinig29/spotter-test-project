import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { type AddressResult, searchAddresses } from "@/lib/geocode";
import { cn } from "@/lib/utils";

interface AddressSearchProps {
  /** The currently selected address text, shown in the input (synced on drag). */
  value: string;
  onSelect: (result: AddressResult) => void;
  /** Accent color for the result pins. */
  accent: string;
  placeholder?: string;
}

export function AddressSearch({
  value,
  onSelect,
  accent,
  placeholder = "Search an address or place",
}: AddressSearchProps) {
  const [draft, setDraft] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const editingRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Mirror the external value (selection / marker drag) unless the user is typing.
  useEffect(() => {
    if (!editingRef.current) setDraft(value);
  }, [value]);

  // Debounced lookup — only while the user is actively editing.
  useEffect(() => {
    if (!editingRef.current) return;
    const q = draft.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await searchAddresses(q, controller.signal);
      setResults(found);
      setActive(0);
      setOpen(true);
      setLoading(false);
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function choose(result: AddressResult) {
    editingRef.current = false;
    setDraft(result.label);
    setResults([]);
    setOpen(false);
    onSelect(result);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = results[active];
      if (result) choose(result);
    }
  }

  function onBlur() {
    setOpen(false);
    // If the user typed but didn't pick anything, revert to the selected value.
    if (editingRef.current) {
      editingRef.current = false;
      setDraft(value);
    }
  }

  const showEmpty =
    open && !loading && results.length === 0 && draft.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => {
            editingRef.current = true;
            setDraft(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-label="Search for an address"
          autoComplete="off"
          className="h-9 pr-8 pl-8 text-sm"
        />
        {loading && (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:hidden" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1.5 max-h-72 w-full overflow-hidden overflow-y-auto rounded-md border bg-popover shadow-md">
          {results.map((result, i) => (
            <button
              type="button"
              key={`${result.lat}-${result.lng}-${result.label}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(result);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex w-full items-start gap-2 px-2.5 py-2 text-left",
                i === active && "bg-accent",
              )}
            >
              <MapPin
                className="mt-0.5 size-3.5 shrink-0"
                style={{ color: accent }}
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-xs">{result.label}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {result.detail}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="absolute z-10 mt-1.5 w-full rounded-md border bg-popover px-2.5 py-2 text-muted-foreground text-xs shadow-md">
          No matches — try a city or full address, or click the map.
        </div>
      )}
    </div>
  );
}
