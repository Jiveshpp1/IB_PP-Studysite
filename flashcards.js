document.addEventListener("DOMContentLoaded", () => {
  const setList = document.getElementById("setList");
  const setSelect = document.getElementById("cardSet");
  let sets = [];
  let cards = [];

  async function render() {
    [sets, cards] = await Promise.all([api("/flashcard-sets"), api("/flashcards")]);
    const classes = await api("/classes");
    document.getElementById("setClass").innerHTML = `<option value="">No class</option>${classes.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
    setSelect.innerHTML = sets.length ? sets.map(set => `<option value="${set.id}">${escapeHtml(set.title)}</option>`).join("") : `<option value="">Create a set first</option>`;
    setList.innerHTML = sets.length ? sets.map(set => {
      const setCards = cards.filter(card => Number(card.set_id) === Number(set.id));
      return `<article class="material-card"><span class="material-type">${setCards.length} CARDS</span><h3>${escapeHtml(set.title)}</h3><p>${setCards.reduce((sum, card) => sum + Number(card.review_count || 0), 0)} reviews</p><div class="card-actions"><a class="text-link" href="flashcard-study.html?set=${set.id}">Study set →</a><div><button class="link-button" type="button" data-edit-set="${set.id}">Rename</button><button class="link-button" type="button" data-delete-set="${set.id}">Delete</button></div></div><div class="list-stack">${setCards.map(card => `<div class="class-row"><span class="row-main"><strong>${escapeHtml(card.term)}</strong><small>${escapeHtml(card.definition)}</small></span><button class="link-button" type="button" data-edit-card="${card.id}">Edit</button><button class="link-button" type="button" data-delete-card="${card.id}">Delete</button></div>`).join("")}</div></article>`;
    }).join("") : `<div class="empty-state"><strong>No flashcard sets yet</strong><p>Create a set above to get started.</p></div>`;
  }
  document.getElementById("setForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await api("/flashcard-sets", { method: "POST", body: JSON.stringify({
        title: document.getElementById("setTitle").value.trim(),
        class_id: document.getElementById("setClass").value ? Number(document.getElementById("setClass").value) : null,
      }) });
      event.target.reset();
      document.getElementById("setMessage").textContent = "Set created.";
      await render();
    } catch (error) { document.getElementById("setMessage").textContent = error.message; }
  });
  document.getElementById("cardForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await api("/flashcards", { method: "POST", body: JSON.stringify({
        set_id: Number(setSelect.value),
        term: document.getElementById("cardTerm").value.trim(),
        definition: document.getElementById("cardDefinition").value.trim(),
      }) });
      event.target.reset();
      document.getElementById("cardMessage").textContent = "Card added.";
      await render();
    } catch (error) { document.getElementById("cardMessage").textContent = error.message; }
  });
  setList.addEventListener("click", async event => {
    const button = event.target.closest("[data-edit-set], [data-delete-set], [data-edit-card], [data-delete-card]");
    if (!button) return;
    try {
      if (button.dataset.deleteSet) {
        if (!confirm("Delete this set and all its cards?")) return;
        await api(`/flashcard-sets/${button.dataset.deleteSet}`, { method: "DELETE" });
      } else if (button.dataset.editSet) {
        const set = sets.find(item => item.id === Number(button.dataset.editSet));
        const title = prompt("Set name", set.title);
        if (title === null) return;
        await api(`/flashcard-sets/${set.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim() }) });
      } else {
        const card = cards.find(item => item.id === Number(button.dataset.editCard || button.dataset.deleteCard));
        if (button.dataset.deleteCard) {
          await api(`/flashcards/${card.id}`, { method: "DELETE" });
        } else {
          const term = prompt("Card front", card.term);
          if (term === null) return;
          const definition = prompt("Card back", card.definition);
          if (definition === null) return;
          await api(`/flashcards/${card.id}`, { method: "PATCH", body: JSON.stringify({ term: term.trim(), definition: definition.trim() }) });
        }
      }
      await render();
    } catch (error) { document.getElementById("setsMessage").textContent = error.message; }
  });
  render().catch(error => { setList.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; });
});
