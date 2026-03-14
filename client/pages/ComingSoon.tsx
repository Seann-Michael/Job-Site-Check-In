import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";
import {
  Construction,
  Lightbulb,
  ArrowLeft,
  Rocket,
  Clock,
  Sparkles,
  Coffee,
  Code2,
} from "lucide-react";

function ComingSoon() {
  const navigate = useNavigate();

  const funnyMessages = [
    "Our developers are caffeinated and coding furiously! ☕",
    "This feature is still in the digital oven, baking to perfection! 🍪",
    "Rome wasn't built in a day, and neither is awesome software! 🏛️",
    "We're assembling this feature like a digital IKEA project! 🔧",
    "Coming soon... after we finish arguing about the perfect font! 😅",
    "This feature is currently doing push-ups to get stronger! 💪",
  ];

  const randomMessage =
    funnyMessages[Math.floor(Math.random() * funnyMessages.length)];

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-6 pb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full blur-3xl opacity-20 scale-150"></div>
                <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                  <Construction className="h-12 w-12 text-white" />
                </div>
              </div>

              <div>
                <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  Coming Soon!
                </CardTitle>
                <p className="text-xl text-gray-600 font-medium">
                  Under Development
                </p>
              </div>
            </CardHeader>

            <CardContent className="text-center space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-lg text-gray-700">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">
                    We're working on something amazing!
                  </span>
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                </div>

                <p className="text-gray-600 text-lg leading-relaxed">
                  {randomMessage}
                </p>

                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Code2 className="h-4 w-4" />
                    <span>Coding in progress</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Coffee className="h-4 w-4" />
                    <span>Fueled by coffee</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>Worth the wait</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-gray-800">
                    Want a sneak peek?
                  </span>
                </div>
                <p className="text-gray-600 mb-4">
                  Check out our Ideas section to see what exciting features
                  we're cooking up next!
                </p>
                <Link to="/admin/ideas">
                  <Button className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                    <Rocket className="h-4 w-4" />
                    Explore Upcoming Features
                  </Button>
                </Link>
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
                <Link to="/admin/jobs">
                  <Button variant="outline" className="gap-2">
                    <span>Return to Dashboard</span>
                  </Button>
                </Link>
              </div>

              <div className="text-sm text-gray-400 space-y-1">
                <p>
                  💡 Pro tip: Great things take time, but they're worth the
                  wait!
                </p>
                <p className="text-xs">
                  This page refreshes with a new funny message each time 😄
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default ComingSoon;
