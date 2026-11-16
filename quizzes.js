document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("quizList");
  let quizzes = [];
  let questions = [];
  async function render() {
    [quizzes, questions] = await Promise.all([api("/quizzes"), api("/questions")]);
    const classes = await api("/classes");
    document.getElementById("quizClass").innerHTML = `<option value="">No class</option>${classes.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
    document.getElementById("questionQuiz").innerHTML = quizzes.map(quiz => `<option value="${quiz.id}">${escapeHtml(quiz.title)}</option>`).join("") || `<option value="">Create a quiz first</option>`;
    list.innerHTML = quizzes.length ? quizzes.map(quiz => {
      const count = questions.filter(question => Number(question.quiz_id) === Number(quiz.id)).length;
      return `<article class="material-card"><span class="material-type">${count} QUESTIONS</span><h3>${escapeHtml(quiz.title)}</h3><div class="card-actions"><a class="text-link" href="quiz-take.html?id=${quiz.id}">Take quiz →</a><button class="link-button" type="button" data-delete-quiz="${quiz.id}">Delete</button></div><div class="list-stack">${questions.filter(question => Number(question.quiz_id) === Number(quiz.id)).map(question => `<div class="class-row"><span class="row-main"><strong>${escapeHtml(question.prompt)}</strong></span><button class="link-button" type="button" data-delete-question="${question.id}">Delete</button></div>`).join("")}</div></article>`;
    }).join("") : `<div class="empty-state"><strong>No quizzes yet</strong><p>Create a quiz to get started.</p></div>`;
  }
  document.getElementById("quizForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await api("/quizzes", { method: "POST", body: JSON.stringify({
        title: document.getElementById("quizTitle").value.trim(),
        class_id: document.getElementById("quizClass").value ? Number(document.getElementById("quizClass").value) : null,
      }) });
      event.target.reset();
      document.getElementById("quizMessage").textContent = "Quiz created.";
      await render();
    } catch (error) { document.getElementById("quizMessage").textContent = error.message; }
  });
  document.getElementById("questionForm").addEventListener("submit", async event => {
    event.preventDefault();
    const options = [0, 1, 2, 3].map(index => document.getElementById(`option${index}`).value.trim()).filter(Boolean);
    const correct = Number(document.getElementById("correctOption").value);
    if (correct >= options.length) {
      document.getElementById("questionMessage").textContent = "Choose one of the answer options you filled in.";
      return;
    }
    try {
      await api("/questions", { method: "POST", body: JSON.stringify({
        quiz_id: Number(document.getElementById("questionQuiz").value),
        prompt: document.getElementById("questionPrompt").value.trim(),
        options_json: options,
        correct_option: correct,
      }) });
      event.target.reset();
      document.getElementById("questionMessage").textContent = "Question added.";
      await render();
    } catch (error) { document.getElementById("questionMessage").textContent = error.message; }
  });
  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-quiz], [data-delete-question]");
    if (!button) return;
    try {
      if (button.dataset.deleteQuiz) {
        if (!confirm("Delete this quiz and all its questions?")) return;
        await api(`/quizzes/${button.dataset.deleteQuiz}`, { method: "DELETE" });
      } else {
        await api(`/questions/${button.dataset.deleteQuestion}`, { method: "DELETE" });
      }
      await render();
    } catch (error) { document.getElementById("quizListMessage").textContent = error.message; }
  });
  render().catch(error => { list.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; });
});
