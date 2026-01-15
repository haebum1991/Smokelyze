
export function shiftDate(days = 0, months = 0, years = 0) {
  const dateInput = document.getElementById("datePicker");
  if (!dateInput) return;
  const parts = (dateInput.value || "").split("-");
  const yyyy = Number(parts[0]), mm = Number(parts[1]), dd = Number(parts[2]);
  if (!yyyy || !mm || !dd) return;

  const currentDate = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (years) currentDate.setUTCFullYear(currentDate.getUTCFullYear() + years);
  if (months) currentDate.setUTCMonth(currentDate.getUTCMonth() + months);
  if (days) currentDate.setUTCDate(currentDate.getUTCDate() + days);

  const newY = currentDate.getUTCFullYear();
  const newM = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
  const newD = String(currentDate.getUTCDate()).padStart(2, "0");
  dateInput.value = `${newY}-${newM}-${newD}`;
  dateInput.dispatchEvent(new Event("change", { bubbles: true }));
}

export function initDateButtons() {
  const pairs = [
    ["minus1d", -1, 0, 0], ["plus1d", 1, 0, 0],
    ["minus1m", 0, -1, 0], ["plus1m", 0, 1, 0],
    ["minus1y", 0, 0, -1], ["plus1y", 0, 0, 1]
  ];
  pairs.forEach(([cls, d, m, y]) => {
    document.querySelectorAll("." + cls).forEach(el => {
      el.addEventListener("click", () => shiftDate(d, m, y));
    });
  });
}

