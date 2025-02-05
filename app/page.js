import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import {
  featuresData,
  howItWorksData,
  statsData,
  testimonialsData,
} from "@/data/landing";
import HeroSection from "@/components/hero";
import Link from "next/link";

const LandingPage = () => {
  return (
    <div className="mt-40">
    <HeroSection />
    <section className="py-10 bg-gray-100">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {statsData.map((data, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {data.value}
              </div>
              <div className="text-gray-600">{data.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* features section */}
    <section className="py-10">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">
          {" "}
          The Ultimate Tool for Smart Money Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuresData.map((feature, index) => (
            <Card key={index} className="p-6">
              <CardContent>
                <p className="pb-2 text-green-600">{feature.icon}</p>
                <h3 className="font-semibold pb-2">{feature.title}</h3>
                <p>{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
    {/* how it works section */}

    <section className="py-10 bg-gray-100">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {howItWorksData.map((data, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                {data.icon}
              </div>
              <h3 className="text-xl text-center font-semibold mb-4">
                {data.title}
              </h3>
              <p className="text-gray-800 text-medium">{data.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
    {/* testimonials */}
    <section className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">
          Insights From Our Users
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonialsData.map((testimonial, index) => (
            <Card key={index} className="pt-6">
              <CardContent>
                <div className="flex items-center mb-4">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <div className="ml-4">
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600">{testimonial.quote}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
    {/* testimonials */}
    {/* <section className="py-20 bg-green-600 bg-gradient-to-br from-[#FFD700] via-[#3ea30f] to-[#FFD700] "> */}
    <section className="py-20 bg-slate-100 ">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-green-500 mb-6">
          Ready to Master Your Finances?
        </h2>
        <p className="text-black mb-8 max-w-2xl mx-auto">
          Track your spending, set budgets, and gain insights into your
          financial health—all in one easy-to-use app. Start managing your
          money smarter today.
        </p>
        <Link href="/dashboard">
          <Button
            size="lg"
            className="bg-green-500 border-b-4 border-white-500 text-white
                           hover:bg-green-100 hover:text-green-500 hover:border-green-600 
                            hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-green-500 rounded-lg animate-bounce"
          >
            Get Started Now
          </Button>
        </Link>
      </div>
    </section>
  </div>
  );
};

export default LandingPage;
