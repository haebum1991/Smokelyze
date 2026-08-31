
export function shiftDate(days = 0, months = 0, years = 0) {
  const dateInput = document.getElementById("datePicker");
  if (!dateInput) return;
  const parts = (dateInput.value || "").split("-");
  let yyyy = Number(parts[0]), mm = Number(parts[1]), dd = Number(parts[2]);
  if (!yyyy || !mm || !dd) return;

  if (years) yyyy += years;
  if (months) {
    mm += months;
    while (mm < 1) {
      mm += 12;
      yyyy -= 1;
    }
    while (mm > 12) {
      mm -= 12;
      yyyy += 1;
    }
  }

  // Clamp day to max days in target month (e.g. July 31 -> June 30, March 31 -> Feb 28)
  const maxDaysInTargetMonth = new Date(Date.UTC(yyyy, mm, 0)).getUTCDate();
  const targetDay = Math.min(dd, maxDaysInTargetMonth);

  const currentDate = new Date(Date.UTC(yyyy, mm - 1, targetDay));
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

