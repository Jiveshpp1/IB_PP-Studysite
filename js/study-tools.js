document.addEventListener("DOMContentLoaded", () => {
  const tabs = [...document.querySelectorAll("[data-tool]")];
  const source = document.getElementById("studySource");
  const wordCount = document.getElementById("sourceWordCount");
  const generateButton = document.getElementById("generateStudyContent");
  const output = document.getElementById("studyOutput");
  const outputTitle = document.getElementById("studyOutputTitle");
  const outputDescription = document.getElementById("studyOutputDescription");
  const message = document.getElementById("studyMessage");
  const copyButton = document.getElementById("copyStudyOutput");
  let selectedTool = "summary";
  let latestOutput = "";

  const toolInfo = {
    summary: ["Summary draft", "A shorter version of your notes."],
    flashcards: ["Flashcard draft", "Key terms and definitions to review."],
    questions: ["Practice question draft", "Questions to check your understanding."],
    tutor: ["AI tutor prompt", "A prompt you can connect to an AI service later."]
  };
  tabs.forEach(tab => tab.addEventListener("click", () => {
    selectedTool = tab.dataset.tool;
    tabs.forEach(other => other.classList.toggle("active", other === tab));
    outputTitle.textContent = toolInfo[selectedTool][0];
    outputDescription.textContent = toolInfo[selectedTool][1];
    message.textContent = "";
  }));
  source.addEventListener("input", () => {
    const count = source.value.trim() ? source.value.trim().split(/\s+/).length : 0;
    wordCount.textContent = `${count} word${count === 1 ? "" : "s"}`;
  });

  function makeSummary(text) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    return sentences.map(s => s.trim()).filter(Boolean).slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ");
  }
  function makeFlashcards(text) {
    const lines = text.split(/\n|[.!?]\s+/).map(line => line.trim()).filter(line => line.length > 15);
    const selected = lines.slice(0, 6);
    if (!selected.length) return `<p>Add a few sentences or lines of notes to draft flashcards.</p>`;
    return `<div class="flashcard-list">${selected.map((line, index) => {
      const words = line.split(/\s+/);
      const term = words.slice(0, Math.min(4, Math.ceil(words.length / 3))).join(" ");
      return `<article class="flashcard"><strong>Card ${index + 1}: ${escapeHtml(term)}…</strong><p>${escapeHtml(line)}</p></article>`;
    }).join("")}</div>`;
  }
  function makeQuestions(text) {
    const lines = text.split(/\n|[.!?]\s+/).map(line => line.trim()).filter(line => line.length > 15).slice(0, 6);
    if (!lines.length) return `<p>Add a few sentences or lines of notes to draft questions.</p>`;
    return lines.map((line, index) => `<div class="question-item"><strong>${index + 1}. Explain this idea in your own words.</strong><p>Study point: ${escapeHtml(line)}</p></div>`).join("");
  }

  generateButton.addEventListener("click", () => {
    const text = source.value.trim();
    if (!text) {
      message.textContent = "Paste some notes first so there's material to work with.";
      return;
    }
    if (selectedTool === "summary") {
      latestOutput = makeSummary(text);
      output.innerHTML = `<p>${escapeHtml(latestOutput)}</p>`;
    } else if (selectedTool === "flashcards") {
      output.innerHTML = makeFlashcards(text);
      latestOutput = output.innerText;
    } else if (selectedTool === "questions") {
      output.innerHTML = makeQuestions(text);
      latestOutput = output.innerText;
    } else {
      latestOutput = `Help me study the following notes. Explain difficult ideas simply, identify important terms, ask me one question at a time, and correct my misunderstandings without immediately giving away the answer.\n\nNOTES:\n${text}`;
      output.innerHTML = `<div class="prompt-output">${escapeHtml(latestOutput)}</div>`;
    }
    message.textContent = "Draft created. Review it for accuracy.";
  });

  copyButton.addEventListener("click", async () => {
    if (!latestOutput) {
      message.textContent = "Create a draft before copying.";
      return;
    }
    try {
      await navigator.clipboard.writeText(latestOutput);
      message.textContent = "Output copied.";
    } catch {
      message.textContent = "Copy is not available in this browser context. Select the output text and copy it manually.";
    }
  });
});
