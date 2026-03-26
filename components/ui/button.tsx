import Link from "next/link";

type ButtonProps = {
  variant?: "default";
  className?: string;
  href?: string;
  children: React.ReactNode;
};

export function Button({
  variant: _variant = "default",
  className = "",
  href,
  children,
}: ButtonProps) {
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className}>
      {children}
    </button>
  );
}
