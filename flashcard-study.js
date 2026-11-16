document.addEventListener("DOMContentLoaded", async () => {
  const setId = new URLSearchParams(location.search).get("set");
  const cardElement = document.getElementById("studyCard");
  const message = document.getElementById("studyMessage");
  let cards = [];
  let index = 0;
  let flipped = false;
  let studiedThisSession = 0;
  try {
    if (!setId || !/^\d+$/.test(setId)) throw new Error("Choose a flashcard set to study.");
    const [set, allCards] = await Promise.all([api(`/flashcard-sets/${setId}`), api("/flashcards")]);
    cards = allCards.filter(card => Number(card.set_id) === Number(setId));
    document.getElementById("studySetTitle").textContent = set.title;
    if (!cards.length) throw new Error("This set has no cards yet. Add a card before studying.");
    function render() {
      const card = cards[index];
      document.getElementById("studyCardText").textContent = flipped ? card.definition : card.term;
      document.getElementById("studySideLabel").textContent = flipped ? "Answer · click to show question" : "Question · click to reveal answer";
      document.getElementById("studyProgress").textContent = `Card ${index + 1} of ${cards.length} · ${studiedThisSession} reviewed this session · ${card.review_count} total reviews`;
    }
    function flip() { flipped = !flipped; render(); }
    function move(step) { index = (index + step + cards.length) % cards.length; flipped = false; render(); }
    cardElement.addEventListener("click", flip);
    cardElement.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); flip(); } });
    document.getElementById("flipCard").addEventListener("click", flip);
    document.getElementById("previousCard").addEventListener("click", () => move(-1));
    document.getElementById("nextCard").addEventListener("click", () => move(1));
    document.getElementById("markStudied").addEventListener("click", async () => {
      try {
        await api(`/flashcards/${cards[index].id}/study`, { method: "POST", body: "{}" });
        cards[index].review_count += 1;
        studiedThisSession += 1;
        message.textContent = "Review recorded.";
        render();
      } catch (error) { message.textContent = error.message; }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === " ") { event.preventDefault(); flip(); }
    });
    render();
  } catch (error) {
    cardElement.innerHTML = `<div class="empty-state"><strong>Unable to load cards</strong><p>${escapeHtml(error.message)}</p><a href="flashcard-creator.html">Go to flashcards →</a></div>`;
  }
});
