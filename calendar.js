document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  let shown = new Date(today.getFullYear(), today.getMonth(), 1);
  let events = [];
  let assignments = [];
  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  async function render() {
    [events, assignments] = await Promise.all([api("/events"), api("/assignments")]);
    document.getElementById("calendarMonth").textContent = shown.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - offset);
    const grid = document.getElementById("calendarGrid");
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    grid.innerHTML = weekdays.map(day => `<div class="calendar-day-number">${day}</div>`).join("");
    for (let day = 0; day < 42; day += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + day);
      const key = dayKey(date);
      const dayEvents = [
        ...assignments.filter(item => String(item.due_at).slice(0, 10) === key).map(item => ({ title: item.title, type: "Due" })),
        ...events.filter(item => String(item.starts_at).slice(0, 10) === key).map(item => ({ title: item.title, type: "Event" })),
      ];
      grid.insertAdjacentHTML("beforeend", `<div class="calendar-day ${date.getMonth() === shown.getMonth() ? "" : "muted-day"}"><span class="calendar-day-number">${date.getDate()}</span>${dayEvents.map(item => `<span class="calendar-event" title="${escapeHtml(item.type)}: ${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>`).join("")}</div>`);
    }
    document.getElementById("eventList").innerHTML = events.length ? events.map(event => `<div class="class-row"><span class="row-main"><strong>${escapeHtml(event.title)}</strong><small>${new Date(event.starts_at).toLocaleString()}</small></span><button class="link-button" data-delete-event="${event.id}" type="button">Delete</button></div>`).join("") : `<div class="empty-state"><strong>No events yet</strong><p>Add tests and reminders to your calendar.</p></div>`;
  }
  document.getElementById("previousMonth").addEventListener("click", () => { shown.setMonth(shown.getMonth() - 1); render(); });
  document.getElementById("nextMonth").addEventListener("click", () => { shown.setMonth(shown.getMonth() + 1); render(); });
  document.getElementById("eventForm").addEventListener("submit", async event => {
    event.preventDefault();
    const start = document.getElementById("eventStart").value;
    const end = document.getElementById("eventEnd").value;
    try {
      await api("/events", { method: "POST", body: JSON.stringify({
        title: document.getElementById("eventTitle").value.trim(),
        description: document.getElementById("eventDescription").value.trim() || null,
        starts_at: `${start.replace("T", " ")}:00`,
        ends_at: end ? `${end.replace("T", " ")}:00` : null,
      }) });
      event.target.reset();
      document.getElementById("calendarMessage").textContent = "Event added.";
      await render();
    } catch (error) { document.getElementById("calendarMessage").textContent = error.message; }
  });
  document.getElementById("eventList").addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-event]");
    if (!button) return;
    try { await api(`/events/${button.dataset.deleteEvent}`, { method: "DELETE" }); await render(); }
    catch (error) { document.getElementById("calendarMessage").textContent = error.message; }
  });
  render().catch(error => { document.getElementById("calendarMessage").textContent = error.message; });
});
