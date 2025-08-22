{/* Modern Business Scan Information Overlay */}
              {showBusinessOverlay && businessName && (
                <div
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    zIndex: 1000,
                    pointerEvents: "none",
                    minWidth: "460px",
                  }}
                >
                  <div className="bg-white/95 backdrop-blur-xl shadow-2xl border border-gray-200/50 rounded-2xl overflow-hidden">
                    {/* Modern Header */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-blue-400/30">
                          <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-base font-bold leading-tight">{businessName}</div>
                          {businessAddress && (
                            <div className="text-slate-300 text-xs mt-1 opacity-90 truncate">{businessAddress}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Modern Content */}
                    <div className="p-4 bg-gradient-to-br from-white to-slate-50">
                      {/* Info Grid */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {/* Keyword */}
                        {keyword && (
                          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/70 rounded-xl p-3 border border-emerald-200/50 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                              <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Keyword</div>
                            </div>
                            <div className="text-sm font-bold text-emerald-900 truncate">{keyword}</div>
                          </div>
                        )}
                        
                        {/* Average Ranking */}
                        {averageRanking !== undefined && (
                          <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 rounded-xl p-3 border border-amber-200/50 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                              <div className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Avg Rank</div>
                            </div>
                            <div className="text-sm font-bold text-amber-900">#{averageRanking}</div>
                          </div>
                        )}

                        {/* Scan Date & Time */}
                        {scanDate && scanTime && (
                          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/70 rounded-xl p-3 border border-indigo-200/50 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                              <div className="text-xs text-indigo-700 font-semibold uppercase tracking-wide">Scanned</div>
                            </div>
                            <div className="text-xs font-bold text-indigo-900">
                              {new Date(`${scanDate}T${scanTime}`).toLocaleDateString([], { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </div>
                            <div className="text-xs font-medium text-indigo-700 mt-0.5">
                              {new Date(`${scanDate}T${scanTime}`).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Ranking Distribution with Percentages */}
                      {rankingAnalytics && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ranking Distribution</div>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl p-3 text-center shadow-lg border border-emerald-300/50">
                              <div className="text-lg font-black text-white">{rankingAnalytics.green}</div>
                              <div className="text-xs font-bold text-emerald-100 mb-1">1-3</div>
                              <div className="text-xs font-medium text-emerald-200">
                                {rankingAnalytics.total > 0 ? Math.round((rankingAnalytics.green / rankingAnalytics.total) * 100) : 0}%
                              </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl p-3 text-center shadow-lg border border-yellow-300/50">
                              <div className="text-lg font-black text-white">{rankingAnalytics.yellow}</div>
                              <div className="text-xs font-bold text-yellow-100 mb-1">4-9</div>
                              <div className="text-xs font-medium text-yellow-200">
                                {rankingAnalytics.total > 0 ? Math.round((rankingAnalytics.yellow / rankingAnalytics.total) * 100) : 0}%
                              </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl p-3 text-center shadow-lg border border-orange-300/50">
                              <div className="text-lg font-black text-white">{rankingAnalytics.orange}</div>
                              <div className="text-xs font-bold text-orange-100 mb-1">10-15</div>
                              <div className="text-xs font-medium text-orange-200">
                                {rankingAnalytics.total > 0 ? Math.round((rankingAnalytics.orange / rankingAnalytics.total) * 100) : 0}%
                              </div>
                            </div>
                            
                            <div className="bg-gradient-to-br from-red-400 to-red-500 rounded-xl p-3 text-center shadow-lg border border-red-300/50">
                              <div className="text-lg font-black text-white">{rankingAnalytics.red}</div>
                              <div className="text-xs font-bold text-red-100 mb-1">16+</div>
                              <div className="text-xs font-medium text-red-200">
                                {rankingAnalytics.total > 0 ? Math.round((rankingAnalytics.red / rankingAnalytics.total) * 100) : 0}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
