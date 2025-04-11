"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import Image from "next/image";
import { useEffect, useRef } from "react";

const HeroSection = () => {
  const imageRef = useRef(null);
  const titleRef = useRef(null);

  // Scroll effect for image and title animation
  useEffect(() => {
    const imageElement = imageRef.current;
    const titleElement = titleRef.current;
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrollThreshold = 100;

      if (scrollPosition > scrollThreshold) {
        imageElement.classList.add("opacity-70");
        titleElement.classList.add("transform", "translate-y-10", "opacity-50");
      } else {
        imageElement.classList.remove("opacity-70");
        titleElement.classList.remove("transform", "translate-y-10", "opacity-50");
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="pb-20 px-4">
      <div className="container mx-auto text-center">
        <h1
          ref={titleRef}
          className="text-5xl md:text-8xl lg:text-[105px] pb-6 text-blue-600 font-extrabold transition-transform duration-500 ease-in-out"
        >
          Track your money <br />{" "}
          <span className="italic text-blue-400">Effortlessly</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          FinTrack is a simple and easy-to-use money management app that helps
          you track your expenses, income, and savings.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/dashboard">
            <Button
              size="lg"
              className="px-8 bg-blue-500 hover:bg-blue-600 text-white transition-all duration-300 transform hover:scale-105"
            >
              Get Started
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button
              size="lg"
              variant="outline"
              className="px-8 text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 transform hover:scale-105"
            >
              Watch Demo
            </Button>
          </Link>
        </div>
        <div className="hero-image-wrapper mt-8">
          <div
            ref={imageRef}
            className="hero-image transition-opacity duration-500 ease-in-out transform"
          >
            <Image
              src="/assets/images/dashboard_1.png"
              width={1280}
              height={200}
              alt="Dashboard Preview"
              className="rounded-lg shadow-xl border mx-auto transition-opacity duration-500 ease-in-out"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
