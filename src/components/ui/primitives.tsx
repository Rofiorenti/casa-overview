import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

// ---------- Card ----------
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('card-surface', className)} {...props} />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-5 pb-3', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-base font-semibold leading-tight tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0 gap-2', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

// ---------- Input ----------
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// ---------- Label ----------
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

// ---------- Badge ----------
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'ember' | 'outline' | 'muted' | 'success' | 'warning';
}
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const styles = {
    default: 'bg-primary text-primary-foreground',
    ember: 'bg-accent/15 text-accent',
    outline: 'border border-border text-foreground',
    muted: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  }[variant];
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium tracking-wide', styles, className)}
      {...props}
    />
  );
}

// ---------- Separator ----------
export function Separator({ className, orientation = 'horizontal' }: { className?: string; orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      className={cn(
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        'bg-border/70',
        className
      )}
    />
  );
}

// ---------- Stat (small KPI block) ----------
export function Stat({ label, value, hint, accent = false }: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-border/70 px-4 py-3 bg-card', accent && 'border-accent/40 bg-accent/5')}>
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={cn('display text-2xl mt-1 tabular leading-none', accent && 'text-accent')}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
    </div>
  );
}

// ---------- Select nativo stilizzato (leggero, niente radix qui) ----------
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 rounded-md border border-input bg-background px-3 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

// ---------- Empty state ----------
export function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border/70 rounded-lg py-12 px-6 text-center">
      <div className="display text-xl">{title}</div>
      {description && <div className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{description}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
