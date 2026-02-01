
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, Search, MenuIcon, X } from "lucide-react";

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={22} /> : <MenuIcon size={22} />}
          </Button>
          
          <div className="flex items-center">
            <Link to="/" className="font-bold text-xl md:text-2xl text-racing-red">
              Race<span className="text-racing-dark">Insights</span>
            </Link>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link 
            to="/" 
            className={`font-medium transition-colors ${isActive('/') ? 'text-racing-red' : 'hover:text-racing-red'}`}
          >
            Dashboard
          </Link>
          <Link 
            to="/calendar" 
            className={`font-medium transition-colors ${isActive('/calendar') ? 'text-racing-red' : 'hover:text-racing-red'}`}
          >
            Calendar
          </Link>
          <Link 
            to="/standings" 
            className={`font-medium transition-colors ${isActive('/standings') ? 'text-racing-red' : 'hover:text-racing-red'}`}
          >
            Standings
          </Link>
          <Link 
            to="/riders" 
            className={`font-medium transition-colors ${isActive('/riders') ? 'text-racing-red' : 'hover:text-racing-red'}`}
          >
            Riders
          </Link>
          <Link 
            to="/predictions" 
            className={`font-medium transition-colors ${isActive('/predictions') ? 'text-racing-red' : 'hover:text-racing-red'}`}
          >
            Predictions
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Search size={20} />
          </Button>
          <Button variant="ghost" size="icon">
            <Bell size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Calendar size={20} />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-border">
          <nav className="container mx-auto px-4 py-4 flex flex-col space-y-4">
            <Link 
              to="/" 
              className={`font-medium py-2 border-b border-gray-100 ${isActive('/') ? 'text-racing-red' : 'hover:text-racing-red'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              to="/calendar" 
              className={`font-medium py-2 border-b border-gray-100 ${isActive('/calendar') ? 'text-racing-red' : 'hover:text-racing-red'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Calendar
            </Link>
            <Link 
              to="/standings" 
              className={`font-medium py-2 border-b border-gray-100 ${isActive('/standings') ? 'text-racing-red' : 'hover:text-racing-red'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Standings
            </Link>
            <Link 
              to="/riders" 
              className={`font-medium py-2 border-b border-gray-100 ${isActive('/riders') ? 'text-racing-red' : 'hover:text-racing-red'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Riders
            </Link>
            <Link 
              to="/predictions" 
              className={`font-medium py-2 ${isActive('/predictions') ? 'text-racing-red' : 'hover:text-racing-red'}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Predictions
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
