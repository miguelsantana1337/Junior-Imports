export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div><span className="section-kicker">{eyebrow}</span><h2>{title}</h2></div>
      {action ?? (subtitle ? <p>{subtitle}</p> : null)}
    </div>
  );
}
