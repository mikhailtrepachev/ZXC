import { cn } from "../lib/utils";
import { Alert, AlertDescription } from "./ui/alert";
import { Card, CardContent } from "./ui/card";

export function PageScaffold({ title, description, actions, children, className }) {
  return (
    <main className={cn("min-h-[calc(100vh-8rem)] bg-muted/30", className)}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
            {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}

export function StateMessage({ type = "default", children, className }) {
  if (!children) {
    return null;
  }

  const variant = type === "error" ? "destructive" : "default";
  const tone =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : type === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "";

  return (
    <Alert variant={variant} className={cn(tone, className)}>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
        {action}
      </CardContent>
    </Card>
  );
}

export function FieldGroup({ label, children, hint }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}
