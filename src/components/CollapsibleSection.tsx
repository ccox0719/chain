import type { ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  className?: string;
  right?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  className = "",
  right,
  children
}: CollapsibleSectionProps) {
  return (
    <details className={`collapsible-section${className ? ` ${className}` : ""}`} open={defaultOpen}>
      <summary className="collapsible-summary">
        <div className="collapsible-summary-copy">
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {right && <div className="collapsible-summary-right">{right}</div>}
      </summary>
      <div className="collapsible-body">{children}</div>
    </details>
  );
}
