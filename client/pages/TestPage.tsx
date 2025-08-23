import React from "react";

export default function TestPage() {
  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Page</h1>
      <p className="text-gray-600 mb-4">
        This is a minimal test page to check if the basic routing works.
      </p>
      <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
        ✅ Page loaded successfully!
      </div>
    </div>
  );
}
