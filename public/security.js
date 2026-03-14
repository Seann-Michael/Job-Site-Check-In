// Content Security Policy and Security Headers
// This file should be served with appropriate CSP headers

// Detect and prevent common attacks
(function () {
  "use strict";

  // XSS Detection and Prevention
  function detectXSS() {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // Check for suspicious patterns in URL
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /data:text\/html/i,
      /vbscript:/i,
    ];

    const suspicious = xssPatterns.some(
      (pattern) =>
        pattern.test(window.location.href) || pattern.test(document.referrer),
    );

    if (suspicious) {
      console.warn("Potential XSS attempt detected");
      // Redirect to safe page
      window.location.href = "/admin/jobs";
      return true;
    }

    return false;
  }

  // Clickjacking Protection
  function preventClickjacking() {
    if (window.top !== window.self) {
      // Page is being framed
      console.warn("Clickjacking attempt detected");
      window.top.location = window.self.location;
    }
  }

  // Secure Cookie Settings
  function secureSession() {
    // Mark session cookies as secure
    document.cookie =
      document.cookie.replace(/; ?secure/gi, "") + "; secure; samesite=strict";
  }

  // Content Security Policy Violation Reporting
  function setupCSPReporting() {
    document.addEventListener("securitypolicyviolation", function (e) {
      console.warn("CSP Violation:", {
        directive: e.violatedDirective,
        blockedURI: e.blockedURI,
        lineNumber: e.lineNumber,
        sourceFile: e.sourceFile,
      });

      // In production, send to monitoring service
      if (window.location.hostname !== "localhost") {
        fetch("/api/security/csp-violation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            directive: e.violatedDirective,
            blockedURI: e.blockedURI,
            lineNumber: e.lineNumber,
            sourceFile: e.sourceFile,
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) =>
          console.error("Failed to report CSP violation:", err),
        );
      }
    });
  }

  // Disable potentially dangerous features
  function disableDangerousFeatures() {
    // Disable eval
    window.eval = function () {
      throw new Error("eval() is disabled for security reasons");
    };

    // Disable Function constructor
    window.Function = function () {
      throw new Error("Function constructor is disabled for security reasons");
    };

    // Disable inline event handlers
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName) {
      const element = originalCreateElement.call(this, tagName);

      // Override setAttribute to block event handlers
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function (name, value) {
        if (name.toLowerCase().startsWith("on")) {
          console.warn("Blocked inline event handler:", name);
          return;
        }
        return originalSetAttribute.call(this, name, value);
      };

      return element;
    };
  }

  // Initialize security measures
  function initSecurity() {
    if (detectXSS()) return;

    preventClickjacking();
    secureSession();
    setupCSPReporting();
    disableDangerousFeatures();

    console.log("Security measures initialized");
  }

  // Run on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSecurity);
  } else {
    initSecurity();
  }

  // Additional protection: Monitor for malicious modifications
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;

            // Check for suspicious script injections
            if (
              element.tagName === "SCRIPT" &&
              !element.src.includes(window.location.hostname)
            ) {
              console.warn("Suspicious script injection detected:", element);
              element.remove();
            }

            // Check for inline styles with javascript
            if (
              element.style &&
              element.style.cssText.includes("javascript:")
            ) {
              console.warn("Malicious inline style detected:", element);
              element.style.cssText = "";
            }
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();

// Recommended CSP Header for production:
/*
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.yourdomain.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  report-uri /api/security/csp-violation;

Additional Security Headers:
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
*/
