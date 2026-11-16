document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(location.search).get("id");
  const container = document.getElementById("quizQuestions");
  let questions = [];
  try {
    const [quiz, loaded] = await Promise.all([api(`/quizzes/${id}`), api(`/quizzes/${id}/questions`)]);
    questions = loaded.map(question => ({ ...question, options: typeof question.options_json === "string" ? JSON.parse(question.options_json) : question.options_json }));
    document.getElementById("quizHeading").textContent = quiz.title;
    if (!questions.length) {
      container.innerHTML = `<div class="empty-state"><strong>This quiz has no questions.</strong><p>Add some questions before taking it.</p><a href="quizzes.html">Edit quiz →</a></div>`;
      return;
    }
    container.innerHTML = questions.map((question, index) => `<section class="panel"><h2>${index + 1}. ${escapeHtml(question.prompt)}</h2>${question.options.map((option, optionIndex) => `<label class="option-row"><input type="radio" name="question-${question.id}" value="${optionIndex}" required><span>${escapeHtml(option)}</span></label>`).join("")}</section>`).join("");
  } catch (error) {
    container.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
  }
  document.getElementById("takeQuizForm").addEventListener("submit", async event => {
    event.preventDefault();
    const answers = questions.map(question => ({
      questionId: question.id,
      option: Number(new FormData(event.target).get(`question-${question.id}`)),
    }));
    try {
      const result = await api(`/quizzes/${id}/attempts`, { method: "POST", body: JSON.stringify({ answers }) });
      document.getElementById("quizResult").hidden = false;
      document.getElementById("scoreHeading").textContent = `You scored ${result.score} out of ${result.total}`;
      document.getElementById("answerReview").innerHTML = questions.map((question, index) => {
        const correct = result.questions.find(item => item.id === question.id)?.correct_option;
        return `<div class="question-item"><strong>${escapeHtml(question.prompt)}</strong><p>Your answer: ${escapeHtml(question.options[answers[index].option] || "—")}</p><p>Correct answer: ${escapeHtml(question.options[correct] || "—")}</p></div>`;
      }).join("");
      document.getElementById("submitQuiz").disabled = true;
      document.getElementById("quizTakeMessage").textContent = "Attempt saved.";
    } catch (error) { document.getElementById("quizTakeMessage").textContent = error.message; }
  });
});
