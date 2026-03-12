
/**
 * Smart Tooltip System
 * Automatically detects [title] and displays a custom tooltip.
 * Prevents tooltips from going off-screen.
 */

export function initBtnTooltips() {
  let tooltip = null;

  document.addEventListener("mouseenter", (e) => {
  
    // Skip for touch devices (mobile) to prevent showing on tap
    if (window.matchMedia("(hover: none)").matches) return;
        
    const el = e.target;
    if (!el || !el.closest) return;

    const target = el.closest("[title], [btn-tooltip]");
    if (!target) return;

    // Get tooltip text
    const text = target.getAttribute("title") || target.getAttribute("btn-tooltip");
    if (!text) return;

    // Save original title and remove it to prevent native tooltip
    if (target.hasAttribute("title")) {
      target.setAttribute("btn-tooltip-backup", text);
      target.removeAttribute("title");
    }

    // Create tooltip element
    tooltip = document.createElement("div");
    tooltip.className = "custom-btn-tooltip";
    tooltip.innerText = text;
    document.body.appendChild(tooltip);

    // Position calculation
    const updatePosition = () => {
      if (!tooltip || !target) return;

      const rect = target.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      // Default: Top Center
      let left = rect.left + rect.width / 2;
      let top = rect.top - tooltipRect.height - 10;

      // --- Collision Detection ---
      
      // Right edge
      if (left + tooltipRect.width / 2 > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width / 2 - 10;
      }
      
      // Left edge
      if (left - tooltipRect.width / 2 < 10) {
        left = tooltipRect.width / 2 + 10;
      }

      // Top edge (flip to bottom)
      if (top < 10) {
        top = rect.bottom + 10;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.transform = "translateX(-50%)";
      
      // Show with animation
      requestAnimationFrame(() => {
        if (tooltip) tooltip.classList.add("visible");
      });
    };

    updatePosition();

    // Mouse leave cleanup
    const removeTooltip = () => {
      if (tooltip) {
        tooltip.classList.remove("visible");
        const elToRemove = tooltip;
        setTimeout(() => elToRemove.remove(), 300);
        tooltip = null;
      }
      // Restore title
      if (target.hasAttribute("btn-tooltip-backup")) {
        target.setAttribute("title", target.getAttribute("btn-tooltip-backup"));
        target.removeAttribute("btn-tooltip-backup");
      }
      target.removeEventListener("mouseleave", removeTooltip);
    };

    target.addEventListener("mouseleave", removeTooltip);
  }, true);
}

