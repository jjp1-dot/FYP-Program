// script.js - Linear auto-advance, catch unanswered only at the end, with sidebar auto-scroll

// ---------- THE 20 QUESTIONS (exactly as provided) ----------
const questions = [
    { q: "1. Which subject do you enjoy the most in school?", options: ["A. Math and problem solving","B. Science and experiments","C. Writing, literature, or communication","D. Business or entrepreneurship topics","E. Drawing, design, or creative work"] },
    { q: "2. What type of activity do you enjoy the most?", options: ["A. Solving puzzles or coding problems","B. Conducting experiments or studying nature","C. Speaking, writing, or presenting ideas","D. Managing projects or selling products","E. Creating art, designs, or media"] },
    { q: "3. What kind of career sounds most interesting to you?", options: ["A. Building software or technology","B. Working in hospitals or healthcare","C. Teaching or helping students learn","D. Running a company or managing finances","E. Designing graphics, videos, or media"] },
    { q: "4. Which task would you rather do?", options: ["A. Fix a computer or create an app","B. Study human biology or medicine","C. Write an article or story","D. Create a marketing plan","E. Design a logo or artwork"] },
    { q: "5. What kind of problems do you enjoy solving?", options: ["A. Technical problems","B. Scientific or health problems","C. Social or communication problems","D. Business or financial problems","E. Creative challenges"] },
    { q: "6. Which environment do you prefer working in?", options: ["A. With computers and technology","B. Laboratories or medical environments","C. Schools or community organizations","D. Offices or companies","E. Studios or creative spaces"] },
    { q: "7. How would your friends describe you?", options: ["A. Analytical and logical","B. Curious and observant","C. Communicative and expressive","D. Leader and organizer","E. Creative and imaginative"] },
    { q: "8. What type of project would you enjoy the most?", options: ["A. Building a website or app","B. Conducting a scientific experiment","C. Writing a blog or article","D. Creating a business plan","E. Producing a video or artwork"] },
    { q: "9. What motivates you the most in a future career?", options: ["A. Creating innovative technology","B. Helping people with health or science","C. Educating or inspiring others","D. Achieving financial or business success","E. Expressing creativity"] },
    { q: "10. Which skill do you think is your strongest?", options: ["A. Logical thinking and programming","B. Scientific observation and research","C. Communication and writing","D. Leadership and decision-making","E. Creativity and design"] },
    { q: "11. Which type of school project do you enjoy the most?", options: ["A. Building a website, app, or technical project","B. Researching scientific topics or conducting experiments","C. Writing essays or giving presentations","D. Creating business plans or marketing ideas","E. Designing posters, videos, or digital art"] },
    { q: "12. What kind of problems do you enjoy solving in your free time?", options: ["A. Computer or technology-related issues","B. Scientific or health-related questions","C. Social or community issues","D. Financial or business challenges","E. Creative design challenges"] },
    { q: "13. What would you most likely do during your free time?", options: ["A. Explore new technology or learn coding","B. Watch science documentaries or read about health","C. Read books, write stories, or debate ideas","D. Learn about business trends or investments","E. Draw, edit videos, or create digital content"] },
    { q: "14. Which tool would you most enjoy using?", options: ["A. Programming software or computer tools","B. Laboratory equipment","C. Books, journals, or communication tools","D. Financial tools or management software","E. Design software or creative tools"] },
    { q: "15. What type of achievement would make you the proudest?", options: ["A. Creating a useful application or software","B. Discovering something new in science or medicine","C. Helping people learn or understand ideas","D. Building a successful business","E. Producing creative work people admire"] },
    { q: "16. Which task sounds the most interesting to you?", options: ["A. Developing a computer system","B. Studying diseases and health conditions","C. Teaching or mentoring others","D. Managing a company or team","E. Producing films, music, or digital media"] },
    { q: "17. What kind of class activity excites you the most?", options: ["A. Coding or technology-based activities","B. Laboratory experiments","C. Group discussions and presentations","D. Business simulations or case studies","E. Art or design projects"] },
    { q: "18. If you were to join a club, which would you pick?", options: ["A. Programming or robotics club","B. Science or medical club","C. Debate or writing club","D. Entrepreneurship club","E. Arts or multimedia club"] },
    { q: "19. What type of career impact do you want to make?", options: ["A. Innovate technology that improves everyday life","B. Improve health and scientific knowledge","C. Educate and inspire people","D. Grow businesses and create jobs","E. Inspire people through creative works"] },
    { q: "20. Which activity sounds the most enjoyable for you?", options: ["A. Building computers or apps","B. Studying the human body or nature","C. Writing, speaking, or teaching","D. Planning business strategies","E. Creating designs, videos, or artworks"] }
];

// Global state
let currentIndex = 0;
let answers = new Array(questions.length).fill(null);

// DOM elements
const questionTextDiv = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const questionsNav = document.getElementById('questionsNav');
const sidebarProgressFill = document.getElementById('sidebarProgressFill');
const progressCountSpan = document.getElementById('progressCount');

// Helper: find first unanswered question index (or -1)
function getFirstUnansweredIndex() {
    return answers.findIndex(ans => ans === null);
}

// Helper: check if all answered
function allAnswered() {
    return answers.every(ans => ans !== null);
}

// Save to localStorage
function saveAnswers() {
    localStorage.setItem('assessmentAnswers', JSON.stringify(answers));
}

// Load from localStorage
function loadAnswers() {
    const saved = localStorage.getItem('assessmentAnswers');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.length === questions.length) answers = parsed;
        } catch(e) {}
    }
}

// Auto-scroll sidebar to make the active question visible
function scrollSidebarToActive() {
    // Find the currently active .nav-question element
    const activeItem = document.querySelector('.nav-question.active');
    if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Render sidebar
function renderSidebar() {
    questionsNav.innerHTML = '';
    for (let i = 0; i < questions.length; i++) {
        const qNum = i + 1;
        const btn = document.createElement('div');
        btn.className = 'nav-question';
        if (answers[i] !== null) btn.classList.add('answered');
        if (i === currentIndex) btn.classList.add('active');
        btn.textContent = `Question ${qNum}`;
        btn.addEventListener('click', () => jumpToQuestion(i));
        questionsNav.appendChild(btn);
    }
    const answeredCount = answers.filter(a => a !== null).length;
    const percent = (answeredCount / questions.length) * 100;
    sidebarProgressFill.style.width = `${percent}%`;
    progressCountSpan.innerText = `${answeredCount}/${questions.length} answered`;

    // After rendering, scroll to the active item
    scrollSidebarToActive();
}

// Render current question
function renderCurrentQuestion() {
    const q = questions[currentIndex];
    questionTextDiv.innerText = q.q;
    optionsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        if (answers[currentIndex] === idx) {
            btn.style.background = '#2563eb';
            btn.style.color = 'white';
        }
        btn.addEventListener('click', () => selectOption(idx));
        optionsContainer.appendChild(btn);
    });
    // Update active highlight in sidebar
    document.querySelectorAll('.nav-question').forEach((el, i) => {
        if (i === currentIndex) el.classList.add('active');
        else el.classList.remove('active');
    });
    // Scroll sidebar to active item again in case the active class changed
    scrollSidebarToActive();
}

// Called when user clicks an option
function selectOption(choiceIndex) {
    // Record answer
    answers[currentIndex] = choiceIndex;
    saveAnswers();

    // If all questions are now answered, submit and redirect
    if (allAnswered()) {
        const letterAnswers = answers.map(a => String.fromCharCode(65 + a));
        localStorage.setItem('answers', JSON.stringify(letterAnswers));
        window.location.href = "results.html";
        return;
    }

    // If this is NOT the last question, go to the next question (linear)
    if (currentIndex < questions.length - 1) {
        currentIndex++;
        renderSidebar();
        renderCurrentQuestion();
        return;
    }

    // If this IS the last question (currentIndex === 19) but not all answered,
    // then find the first unanswered question and jump to it.
    const firstUnanswered = getFirstUnansweredIndex();
    if (firstUnanswered !== -1) {
        currentIndex = firstUnanswered;
        renderSidebar();
        renderCurrentQuestion();
    }
}

// Jump to a specific question (sidebar click)
function jumpToQuestion(index) {
    if (index === currentIndex) return;
    currentIndex = index;
    renderSidebar();
    renderCurrentQuestion();
}

// Initialization
loadAnswers();
// Start at the first unanswered question (so users don't have to manually find it)
const startIndex = getFirstUnansweredIndex();
if (startIndex !== -1) currentIndex = startIndex;
else currentIndex = 0; // all answered already (rare)
renderSidebar();
renderCurrentQuestion();