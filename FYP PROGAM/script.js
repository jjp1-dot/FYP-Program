let questions = [];
let currentIndex = 0;
let answers = [];

const questionTextDiv = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const questionsNav = document.getElementById('questionsNav');
const sidebarProgressFill = document.getElementById('sidebarProgressFill');
const progressCountSpan = document.getElementById('progressCount');

function getFirstUnansweredIndex() {
    return answers.findIndex(ans => ans === null);
}

function allAnswered() {
    return answers.every(ans => ans !== null);
}

function saveAnswers() {
    localStorage.setItem('assessmentAnswers', JSON.stringify(answers));
    const letterAnswers = answers.map(a => a !== null ? String.fromCharCode(65 + a) : null);
    localStorage.setItem('answers', JSON.stringify(letterAnswers));
}

function loadAnswers() {
    const saved = localStorage.getItem('assessmentAnswers');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.length === questions.length) answers = parsed;
        } catch(e) {}
    }
}

function scrollSidebarToActive() {
    const activeItem = document.querySelector('.nav-question.active');
    if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

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
    scrollSidebarToActive();
}

function renderCurrentQuestion() {
    const q = questions[currentIndex];
    if (!q) return;
    questionTextDiv.innerText = q.questionText;
    optionsContainer.innerHTML = '';
    q.choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = `${String.fromCharCode(65+idx)}. ${choice.text}`;
        if (answers[currentIndex] === idx) {
            btn.style.background = '#2563eb';
            btn.style.color = 'white';
        }
        btn.addEventListener('click', () => selectOption(idx));
        optionsContainer.appendChild(btn);
    });
    document.querySelectorAll('.nav-question').forEach((el, i) => {
        if (i === currentIndex) el.classList.add('active');
        else el.classList.remove('active');
    });
    scrollSidebarToActive();
}

function selectOption(choiceIndex) {
    answers[currentIndex] = choiceIndex;
    saveAnswers();

    if (allAnswered()) {
        submitAssessment();
        return;
    }
    if (currentIndex < questions.length - 1) {
        currentIndex++;
        renderSidebar();
        renderCurrentQuestion();
        return;
    }
    const firstUnanswered = getFirstUnansweredIndex();
    if (firstUnanswered !== -1) {
        currentIndex = firstUnanswered;
        renderSidebar();
        renderCurrentQuestion();
    }
}

function jumpToQuestion(index) {
    if (index === currentIndex) return;
    currentIndex = index;
    renderSidebar();
    renderCurrentQuestion();
}

async function submitAssessment() {
    const userInfo = {
        name: localStorage.getItem('userName') || 'Anonymous',
        age: parseInt(localStorage.getItem('userAge')) || 18,
        gender: localStorage.getItem('userGender') || 'not specified',
        strand: localStorage.getItem('userStrand') || 'Not provided',
        gradeLevel: localStorage.getItem('userGrade') || 'Not provided'
    };
    const answerDetails = answers.map((choiceIdx, qIdx) => {
        const q = questions[qIdx];
        const choice = q.choices[choiceIdx];
        return {
            questionId: q._id,
            selectedChoice: choice.text,
            category: choice.category,
            weight: choice.weight
        };
    });
    const payload = { ...userInfo, answers: answerDetails };
    try {
        const response = await fetch('http://localhost:5000/api/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            const result = await response.json();
            localStorage.setItem('recommendation', JSON.stringify(result));
            window.location.href = 'results.html';
        } else {
            alert('Submission failed. Please try again.');
        }
    } catch (err) {
        console.error(err);
        alert('Network error. Please check backend.');
    }
}

async function loadQuestions() {
    try {
        const res = await fetch('http://localhost:5000/api/questions');
        if (!res.ok) throw new Error('Failed to load questions');
        questions = await res.json();
        answers = new Array(questions.length).fill(null);
        loadAnswers();
        const startIndex = getFirstUnansweredIndex();
        currentIndex = startIndex !== -1 ? startIndex : 0;
        renderSidebar();
        renderCurrentQuestion();
    } catch (err) {
        console.error(err);
        questionTextDiv.innerText = 'Failed to load questions. Please refresh.';
    }
}
loadQuestions();