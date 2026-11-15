import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => (
  <footer className="mt-16 border-t border-border">
    <div className="container flex flex-col gap-4 py-8 text-sm text-muted-foreground md:flex-row md:items-start md:justify-between">
      <div className="max-w-xl space-y-1.5">
        <p className="font-display text-base text-foreground">Point de Corde</p>
        <p>
          Projet de fan indépendant, non affilié à MotoGP™ ni à Dorna. Résultats, photos et tracés : API publique MotoGP.
          Prévisions météo : Open-Meteo. Les prédictions sont des estimations statistiques, pas des certitudes.
        </p>
      </div>
      <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Liens de pied de page">
        <Link to="/predictions" className="hover:text-foreground">Prédictions</Link>
        <Link to="/riders" className="hover:text-foreground">Pilotes</Link>
        <Link to="/calendar" className="hover:text-foreground">Grands Prix</Link>
        <Link to="/standings" className="hover:text-foreground">Classements</Link>
        <span>Code sous licence MIT</span>
      </nav>
    </div>
  </footer>
);

export default Footer;
