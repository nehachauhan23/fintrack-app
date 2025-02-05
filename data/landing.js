import {
  BarChart3,
  Receipt,
  PieChart,
  CreditCard,
  Globe,
  Zap,
} from "lucide-react";

export const statsData = [
  {
    value: "50K+",
    label: "Active Users",
  },
  {
    value: "$2B+",
    label: "Transactions Tracked",
  },
  {
    value: "99.9%",
    label: "Uptime Guarantee",
  },
  {
    value: "4.9/5",
    label: "User Satisfaction",
  },
];

export const featuresData = [
  {
    icon: <BarChart3 className="h-8 w-8 text-green-600" />,
    title: "Advanced Analytics",
    description:
      "Unlock deep insights into your spending habits with AI-driven reports.",
  },
  {
    icon: <Receipt className="h-8 w-8 text-green-600" />,
    title: "Smart Receipt Scanning",
    description:
      "Extract and categorize receipt data instantly using AI-powered recognition.",
  },
  {
    icon: <PieChart className="h-8 w-8 text-green-600" />,
    title: "Smart Budgeting",
    description: "Easily create, track, and adjust budgets with automated suggestions.",
  },
  {
    icon: <CreditCard className="h-8 w-8 text-green-600" />,
    title: "Multi-Account Management",
    description: "Manage all your accounts and cards seamlessly from one place.",
  },
  {
    icon: <Globe className="h-8 w-8 text-green-600" />,
    title: "Worldwide Currency Support",
    description: "Effortlessly handle multi-currency transactions with real-time rates.",
  },
  {
    icon: <Zap className="h-8 w-8 text-green-600" />,
    title: "Real-Time Financial Insights",
    description: "Get instant, AI-powered financial advice tailored to your spending.",
  },
];

export const howItWorksData = [
  {
    icon: <CreditCard className="h-8 w-8 text-green-600" />,
    title: "1. Create Your Profile",
    description:
      "Set up your account quickly with a smooth and secure onboarding process.",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-green-600" />,
    title: "2. Track Your Spending",
    description:
      "Automatically sort and monitor your expenses in real time.",
  },
  {
    icon: <PieChart className="h-8 w-8 text-green-600" />,
    title: "3. Leverage AI Insights",
    description:
      "Receive personalized financial tips and suggestions for smarter money management.",
  },
];

export const testimonialsData = [
  {
    name: "Jessica Carter",
    role: "E-commerce Entrepreneur",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    quote:
      "FinTrack has revolutionized the way I handle my business finances. Its AI-driven insights have uncovered savings I never knew existed.",
  },
  {
    name: "Daniel Lee",
    role: "Freelance Designer",
    image: "https://randomuser.me/api/portraits/men/72.jpg",
    quote:
      "The receipt scanning tool is a game-changer! I save so much time every month by avoiding manual entry and organizing my expenses effortlessly.",
  },
  {
    name: "Sophia Martinez",
    role: "Investment Consultant",
    image: "https://randomuser.me/api/portraits/women/70.jpg",
    quote:
      "I always recommend FinTrack to my clients. Its multi-currency support and powerful analytics make it an essential tool for global investors.",
  },
];
