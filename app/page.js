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
    <div className="mt-[200px]">
      <HeroSection />

      {/* Stats Section */}
      <section className="py-16  bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {statsData.map((data, index) => (
              <div key={index} className="transition-transform hover:scale-105">
                <div className="text-5xl font-extrabold text-blue-700 mb-2 transition-colors hover:text-blue-900">
                  {data.value}
                </div>
                <div className="text-gray-700 text-lg">{data.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-bold text-center mb-16 text-blue-600">
            The Ultimate Tool for Smart Money Management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {featuresData.map((feature, index) => (
              <Card
                key={index}
                className="p-8 shadow-lg hover:shadow-xl transition-transform duration-300 rounded-lg hover:scale-105 transform"
              >
                <CardContent>
                  <div className="text-4xl text-blue-600 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-2xl mb-2 text-gray-800">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* New: Benefits Section */}
      <section className="py-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-bold text-center mb-12">
            Why Choose Us?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 bg-white shadow-lg rounded-lg text-center">
              <div className="text-4xl text-blue-600 mb-4">💡</div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">
                Intuitive Interface
              </h3>
              <p className="text-gray-700">
                Manage your finances without any learning curve. Our app is
                user-friendly and intuitive.
              </p>
            </div>
            <div className="p-8 bg-white shadow-lg rounded-lg text-center">
              <div className="text-4xl text-blue-600 mb-4">🔒</div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">
                Secure & Private
              </h3>
              <p className="text-gray-700">
                Your data is safe with us. We use state-of-the-art encryption to
                protect your privacy.
              </p>
            </div>
            <div className="p-8 bg-white shadow-lg rounded-lg text-center">
              <div className="text-4xl text-blue-600 mb-4">📊</div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-800">
                Powerful Insights
              </h3>
              <p className="text-gray-700">
                Gain detailed insights into your spending, saving, and financial
                health with easy-to-read graphs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-bold text-center mb-12 text-blue-700">
            Affordable Pricing
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 shadow-lg rounded-lg hover:shadow-xl transition-transform duration-300">
              <CardContent>
                <h3 className="text-3xl font-semibold text-blue-600 mb-4">
                  Free Plan
                </h3>
                <p className="text-gray-700 mb-4">
                  Start using the app with no commitment and no cost.
                </p>
                <ul className="text-gray-600 mb-4">
                  <li>Track up to 5 accounts</li>
                  <li>Basic expense tracking</li>
                  <li>Budgeting features</li>
                </ul>
                <Button className="bg-blue-500 text-white hover:bg-blue-600 w-full py-3 rounded-lg">
                  Get Started
                </Button>
              </CardContent>
            </Card>
            <Card className="p-8 shadow-lg rounded-lg hover:shadow-xl transition-transform duration-300">
              <CardContent>
                <h3 className="text-3xl font-semibold text-blue-600 mb-4">
                  Pro Plan
                </h3>
                <p className="text-gray-700 mb-4">$9.99/month</p>
                <ul className="text-gray-600 mb-4">
                  <li>Track unlimited accounts</li>
                  <li>Advanced insights & reports</li>
                  <li>Custom budgeting tools</li>
                </ul>
                <Button className="bg-blue-600 text-white hover:bg-blue-700 w-full py-3 rounded-lg">
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
            <Card className="p-8 shadow-lg rounded-lg hover:shadow-xl transition-transform duration-300">
              <CardContent>
                <h3 className="text-3xl font-semibold text-blue-600 mb-4">
                  Business Plan
                </h3>
                <p className="text-gray-700 mb-4">$29.99/month</p>
                <ul className="text-gray-600 mb-4">
                  <li>Team collaboration features</li>
                  <li>Automated reporting</li>
                  <li>Priority support</li>
                </ul>
                <Button className="bg-blue-700 text-white hover:bg-blue-800 w-full py-3 rounded-lg">
                  Contact Us
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gradient-to-br from-slate-100 to-slate-50">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl font-bold text-center mb-12 text-blue-700">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold text-gray-800">
                How secure is my data?
              </h3>
              <p className="text-gray-700">
                We use the latest encryption techniques to ensure your data is
                safe. Your privacy is our priority.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold text-gray-800">
                Can I use the app for free?
              </h3>
              <p className="text-gray-700">
                Yes! Our Free Plan allows you to track your spending and manage
                basic budgets. Upgrade for more features!
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold text-gray-800">
                How do I cancel my subscription?
              </h3>
              <p className="text-gray-700">
                You can cancel your subscription at any time through the
                settings section of the app. No hidden fees.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-700 to-blue-900 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Master Your Finances?
          </h2>
          <p className="text-lg text-white mb-8 max-w-3xl mx-auto">
            Track your spending, set budgets, and gain insights into your
            financial health—all in one easy-to-use app. Start managing your
            money smarter today.
          </p>
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-blue-600 text-white px-8 py-4 text-lg font-medium rounded-lg hover:bg-blue-700 transition duration-300 shadow-lg"
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
