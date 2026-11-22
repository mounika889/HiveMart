import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, Heart } from 'lucide-react';
import { SUPPORTED_CITIES } from '../../types/index.ts';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-brand-deep-navy text-slate-300 border-t border-brand-navy mt-16">
      {/* City Hub Banner */}
      <div className="border-b border-white/10 py-6 bg-brand-navy/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <MapPin className="w-4 h-4 text-brand-honey" />
            <span className="font-semibold text-white">Live Real-Time Inventory in 5 Indian Tech Hubs:</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {SUPPORTED_CITIES.map((city) => (
              <span
                key={city}
                className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium text-slate-300 hover:border-brand-honey/40 transition-colors"
              >
                {city}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-navy border border-brand-honey/40 flex items-center justify-center p-1">
                <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
                  <polygon points="24,3 43,14 43,34 24,45 5,34 5,14" fill="#14213D" stroke="#F5B700" strokeWidth="3" />
                  <polygon points="24,10 35,16.5 35,29.5 24,36 13,29.5 13,16.5" fill="#F5B700" />
                </svg>
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Hive<span className="text-brand-honey">Mart</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              "Your City. Your Cart. Your Hive."
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              An event-driven Indian retail e-commerce platform built with PostgreSQL, OpenSearch, and Apache Kafka.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Explore HiveMart
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="hover:text-brand-honey transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-brand-honey transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/orders" className="hover:text-brand-honey transition-colors">
                  Track Orders
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-brand-honey transition-colors">
                  Shopping Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Supported Categories */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Retail Categories
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/products?category=Electronics" className="hover:text-brand-honey transition-colors">
                  Electronics
                </Link>
              </li>
              <li>
                <Link to="/products?category=Fashion" className="hover:text-brand-honey transition-colors">
                  Fashion & Apparel
                </Link>
              </li>
              <li>
                <Link to="/products?category=Home%20%26%20Kitchen" className="hover:text-brand-honey transition-colors">
                  Home & Kitchen
                </Link>
              </li>
              <li>
                <Link to="/products?category=Beauty%20%26%20Personal%20Care" className="hover:text-brand-honey transition-colors">
                  Beauty & Personal Care
                </Link>
              </li>
              <li>
                <Link to="/products?category=Groceries" className="hover:text-brand-honey transition-colors">
                  Groceries & Staples
                </Link>
              </li>
              <li>
                <Link to="/products?category=Sports%20%26%20Fitness" className="hover:text-brand-honey transition-colors">
                  Sports & Fitness
                </Link>
              </li>
            </ul>
          </div>

          {/* Architecture & Engineering */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Platform Architecture
            </h4>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 text-xs space-y-2 text-slate-300">
              <div className="flex items-center gap-1.5 text-brand-honey font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Cloud Stack</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Strict transactional outbox pattern with row-locked inventory deduction and asynchronous search projection.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 mt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} HiveMart. Built for Hack With Bengaluru.</p>
          <div className="flex items-center gap-1 text-[11px]">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-brand-honey fill-brand-honey inline mx-0.5" />
            <span>for Indian Retail</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

