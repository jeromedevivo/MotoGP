
import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="bg-racing-dark text-white py-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">Race Insights</h3>
            <p className="text-gray-300 text-sm">
              Your comprehensive MotoGP companion with race information, 
              statistics, and predictions.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-300 hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link to="/calendar" className="text-gray-300 hover:text-white transition-colors">Calendar</Link></li>
              <li><Link to="/standings" className="text-gray-300 hover:text-white transition-colors">Standings</Link></li>
              <li><Link to="/riders" className="text-gray-300 hover:text-white transition-colors">Riders</Link></li>
              <li><Link to="/predictions" className="text-gray-300 hover:text-white transition-colors">Predictions</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className="text-gray-300 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/disclaimer" className="text-gray-300 hover:text-white transition-colors">Disclaimer</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-6 pt-6 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Race Insights Forecaster. All rights reserved.</p>
          <p className="mt-2">Data provided by MotoGP API.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
