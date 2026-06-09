"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

const HeroSection = () => {
  const imageRef = useRef(null);

  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY > 80) {
        el.classList.add("scrolled");
      } else {
        el.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="relative overflow-hidden pb-24 pt-4 px-4 mt-[100px]">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-br from-blue-100/70 via-indigo-50/50 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-blue-50 to-transparent rounded-full blur-2xl" />
      </div>

      <div className="container mx-auto max-w-5xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8 animate-fade-up">
          <Sparkles size={14} className="text-blue-500" />
          AI-Powered Finance Tracking
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-6 animate-fade-up animate-fade-up-1">
          <span className="text-gray-900">Track your money</span>
          <br />
          <span className="gradient-title italic">Effortlessly</span>
        </h1>

        {/* Subtext */}
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up animate-fade-up-2">
          FinTrack is your intelligent companion for tracking expenses, income,
          and savings — all powered by AI receipt scanning and smart budgeting.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-16 animate-fade-up animate-fade-up-3">
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 gap-2 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all duration-200"
            >
              Get Started Free
              <ArrowRight size={16} />
            </Button>
          </Link>
          <Link href="#features">
            <Button
              size="lg"
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50 px-8"
            >
              See Features
            </Button>
          </Link>
        </div>

        {/* Dashboard preview */}
        <div className="hero-image-wrapper">
          <div ref={imageRef} className="hero-image">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-b from-blue-200/40 to-transparent rounded-2xl blur-xl" />
              <Image
                src="/assets/images/dashboard_1.png"
                width={1280}
                height={720}
                alt="FinTrack Dashboard Preview"
                className="relative rounded-2xl shadow-2xl border border-gray-200/80 mx-auto"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
