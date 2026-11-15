import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Accueil", end: true },
  { to: "/predictions", label: "Prédictions" },
  { to: "/riders", label: "Pilotes" },
  { to: "/calendar", label: "Grands Prix" },
  { to: "/standings", label: "Classements" },
  { to: "/live-timing", label: "Direct" },
];

/** Apex mark: a corner's racing line touching the kerb at its apex. */
const ApexMark: React.FC = () => (
  <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
    <path d="M4 28 C 8 10, 24 6, 28 4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <circle cx="11.5" cy="14" r="3.5" fill="currentColor" />
  </svg>
);

const Header: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // private mode: the toggle still works for this visit
    }
  }, [dark]);

  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      "relative px-3 py-2 text-[0.95rem] font-semibold transition-colors",
      "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:origin-left after:scale-x-0 after:bg-plate-ink after:transition-transform",
      isActive ? "after:scale-x-100" : "opacity-75 hover:opacity-100",
    );

  return (
    <header className="sticky top-0 z-50 bg-plate text-plate-ink shadow-[0_1px_0_rgba(0,0,0,0.25)]">
      <div className="container flex h-14 items-center gap-4">
        <NavLink to="/" className="flex items-center gap-2" aria-label="Point de Corde, accueil">
          <ApexMark />
          <span className="font-display text-lg leading-none">Point de Corde</span>
        </NavLink>

        <nav className="ml-6 hidden items-stretch md:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={link}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-black/10"
            aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-black/10 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-black/15 md:hidden" aria-label="Navigation principale">
          <div className="container flex flex-col py-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn("rounded-md px-3 py-2.5 font-semibold", isActive ? "bg-black/10" : "opacity-80")}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
