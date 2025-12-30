"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NavLink = ({ href, children, onClick }) => {
  const pathname = usePathname();
  const active = pathname === href;
  const className = active ? "nav__link nav__link--active" : "nav__link";
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
};

