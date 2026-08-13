interface SectionHeaderProps {
  title: string
  description?: string
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground/70 mt-0.5 text-[13px]">{description}</p>}
    </div>
  )
}
