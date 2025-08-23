import React from "react";

export default function ChatMinimal() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Chat</h1>
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-96">
          {/* Channels */}
          <div className="md:col-span-1 bg-gray-50 rounded p-4">
            <h3 className="font-semibold mb-4">Channels</h3>
            <div className="space-y-2">
              <div className="p-2 bg-blue-100 rounded cursor-pointer"># General</div>
              <div className="p-2 hover:bg-gray-200 rounded cursor-pointer"># Projects</div>
              <div className="p-2 hover:bg-gray-200 rounded cursor-pointer"># Team</div>
            </div>
          </div>
          
          {/* Chat Area */}
          <div className="md:col-span-3 flex flex-col">
            <div className="flex-1 bg-gray-50 rounded p-4 mb-4 overflow-y-auto">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">JS</div>
                  <div>
                    <div className="font-medium text-sm">John Smith</div>
                    <div className="text-sm">Welcome to the team chat! 👋</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">SJ</div>
                  <div>
                    <div className="font-medium text-sm">Sarah Johnson</div>
                    <div className="text-sm">Thanks! Excited to work with everyone.</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Message Input */}
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded inline-block">
          ✅ Chat page loaded successfully!
        </div>
      </div>
    </div>
  );
}
