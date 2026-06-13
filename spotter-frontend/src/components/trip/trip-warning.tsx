import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function TripWarning({ message }: { message: string }) {
  return (
    <Alert className="border-amber-500/40 text-amber-600 dark:text-amber-400">
      <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
      <AlertTitle>Cycle hours warning</AlertTitle>
      <AlertDescription className="text-amber-600/90 dark:text-amber-400/90">
        {message}
      </AlertDescription>
    </Alert>
  );
}
