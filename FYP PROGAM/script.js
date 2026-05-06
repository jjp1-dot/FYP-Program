let questionPool = [];          
let askedIndices = [];          
let currentIndex = 0;
let answers = [];               

let scores = {
    "Technology": 0,
    "Healthcare": 0,
    "Education": 0,
    "Business": 0,
    "Creative Arts": 0
};

const MIN_QUESTIONS = 8;
const MAX_QUESTIONS = 12;
const CONFIDENCE_THRESHOLD = 3;  

const questionTextDiv = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const progressBarFill = document.getElementById('progressBarFill');
const motivationMessage = document.getElementById('motivationMessage');
const questionCounterSpan = document.getElementById('questionCounter'); // optional

function updateProgressAndMotivation() {
    const answeredCount = answers.filter(a => a !== null).length;
    const total = MAX_QUESTIONS;
    const percent = (answeredCount / total) * 100;
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;

    let message = '';
    if (answeredCount === 0) message = '🌟 Ready? Answer the first question!';
    else if (answeredCount === total) message = '🎉 You did it! Submitting your results...';
    else if (answeredCount <= Math.floor(total * 0.25)) message = '🚀 Great start! Keep going!';
    else if (answeredCount <= Math.floor(total * 0.5)) message = '📈 Halfway there! You’re doing great.';
    else if (answeredCount <= Math.floor(total * 0.75)) message = '⚡ Almost there! Just a few more.';
    else message = '💪 Final stretch! Finish strong.';
    if (motivationMessage) motivationMessage.innerText = message;
}

function getNextQuestion() {
    if (askedIndices.length >= MAX_QUESTIONS) return null;
    
    let topCategory = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b, "Technology");
    
    let available = questionPool.filter((_, idx) => !askedIndices.includes(idx));
    if (available.length === 0) return null;
    
    let candidates = available.filter(q => q.category === topCategory);
    if (candidates.length === 0) candidates = available;
    
    return candidates[0];
}

function renderCurrentQuestion() {
    const q = questionPool[currentIndex];
    if (!q) return;
    questionTextDiv.innerText = q.questionText;
    optionsContainer.innerHTML = '';
    q.choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = `${String.fromCharCode(65+idx)}. ${choice.text}`;
        btn.addEventListener('click', () => selectOption(idx));
        optionsContainer.appendChild(btn);
    });
    if (questionCounterSpan) {
        questionCounterSpan.innerText = `Question ${askedIndices.length + 1}`;
    }
}

// ----- Handle answer selection -----
function selectOption(choiceIndex) {
    const q = questionPool[currentIndex];
    const category = q.category;
    const weight = q.choices[choiceIndex].weight || 1;
    scores[category] += weight;
    answers[askedIndices.length] = choiceIndex;
    saveStateToLocal();

    const answeredCount = answers.filter(a => a !== null).length;
    let shouldStop = false;
    if (answeredCount >= MIN_QUESTIONS) {
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const lead = sorted[0][1] - sorted[1][1];
        if (lead >= CONFIDENCE_THRESHOLD || answeredCount >= MAX_QUESTIONS) {
            shouldStop = true;
        }
    }
    if (shouldStop || answeredCount >= MAX_QUESTIONS) {
        submitAssessment();
        return;
    }

    const nextQ = getNextQuestion();
    if (!nextQ) {
        submitAssessment();
        return;
    }
    const nextIndex = questionPool.findIndex(q => q === nextQ);
    askedIndices.push(nextIndex);
    currentIndex = nextIndex;
    renderCurrentQuestion();
    updateProgressAndMotivation();
}


function saveStateToLocal() {
    const state = { answers, scores, askedIndices, currentIndex };
    localStorage.setItem('adaptiveAssessment', JSON.stringify(state));
}

function loadSavedState() {
    const saved = localStorage.getItem('adaptiveAssessment');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            answers = data.answers || [];
            scores = data.scores || scores;
            askedIndices = data.askedIndices || [];
            currentIndex = data.currentIndex || 0;
            const answeredCount = answers.filter(a => a !== null).length;
            if (answeredCount >= MAX_QUESTIONS) {
                
                localStorage.removeItem('adaptiveAssessment');
                return false;
            }
            return true;
        } catch(e) {}
    }
    return false;
}

function generateQuestionPool() {
    const pool = [];
    function add(qText, cat, options) {
        pool.push({
            questionText: qText,
            category: cat,
            choices: options.map(opt => ({ text: opt, category: cat, weight: 1 }))
        });
    }
   
    add("How interested are you in learning how computers and software work?", "Technology",
        ["Very interested", "Somewhat interested", "Neutral", "Not very interested", "Not at all"]);
    add("Do you enjoy solving puzzles and logical problems?", "Technology",
        ["Always", "Often", "Sometimes", "Rarely", "Never"]);
    add("How much do you like building or fixing electronic devices?", "Technology",
        ["A lot", "Somewhat", "Neutral", "A little", "Not at all"]);
    add("Are you excited about new technology trends like AI or robotics?", "Technology",
        ["Extremely", "Very", "Moderately", "Slightly", "Not at all"]);

        add("Are you interested in helping people who are sick or injured?", "Healthcare",
        ["Very much", "Somewhat", "Neutral", "A little", "Not at all"]);
    add("Do you enjoy studying biology, anatomy, or nutrition?", "Healthcare",
        ["Yes, love it", "Yes", "Neutral", "Not really", "No"]);
    add("How do you feel about working in a hospital or clinic environment?", "Healthcare",
        ["Very positive", "Positive", "Neutral", "Negative", "Very negative"]);
    
    add("Do you enjoy explaining concepts to others?", "Education",
        ["Always", "Often", "Sometimes", "Rarely", "Never"]);
    add("Are you interested in becoming a teacher or instructor?", "Education",
        ["Very interested", "Interested", "Neutral", "Not interested", "Not at all"]);
    
    add("Are you interested in starting your own business?", "Business",
        ["Very interested", "Interested", "Neutral", "Not interested", "Not at all"]);
    add("Do you like analyzing market trends or financial data?", "Business",
        ["Yes, love it", "Yes", "Neutral", "Not really", "No"]);
    
    add("Do you enjoy drawing, painting, or digital design?", "Creative Arts",
        ["Very much", "Somewhat", "Neutral", "A little", "Not at all"]);
    add("Are you interested in creating multimedia content like videos or animations?", "Creative Arts",
        ["Very interested", "Interested", "Neutral", "Not interested", "Not at all"]);

    for (let i = 0; i < 8; i++) {
        const cat = ["Technology","Healthcare","Education","Business","Creative Arts"][i % 5];
        add(`Additional ${cat} question ${i+1}`, cat,
            ["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"]);
    }
    return pool;
}

async function initAdaptive() {

    try {
        const res = await fetch('http://localhost:5000/api/questions');
        if (res.ok) {
            const dbQuestions = await res.json();
      
            console.log("Backend questions available, but using built-in pool for adaptive.");
        }
    } catch(e) {}
    questionPool = generateQuestionPool();

    const hasSaved = loadSavedState();
    if (!hasSaved) {
  
        answers = [];
        scores = { "Technology":0, "Healthcare":0, "Education":0, "Business":0, "Creative Arts":0 };
        askedIndices = [];
      
        currentIndex = 0;
        askedIndices.push(0);
    }
    updateProgressAndMotivation();
    renderCurrentQuestion();
}

async function submitAssessment() {
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => btn.disabled = true);
    motivationMessage.innerText = '📤 Analyzing your answers...';

    const userInfo = {
        name: localStorage.getItem('userName') || 'Anonymous',
        age: parseInt(localStorage.getItem('userAge')) || 18,
        gender: localStorage.getItem('userGender') || 'not specified',
        strand: localStorage.getItem('userStrand') || 'Not provided',
        gradeLevel: localStorage.getItem('userGrade') || 'Not provided'
    };

    const answerDetails = askedIndices.map((qIdx, i) => {
        const q = questionPool[qIdx];
        const choiceIdx = answers[i];
        const choice = q.choices[choiceIdx];
        return {
            questionText: q.questionText,
            selectedChoice: choice.text,
            category: q.category,
            weight: choice.weight || 1
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
            localStorage.removeItem('adaptiveAssessment');
            window.location.href = 'results.html';
        } else {
            const errText = await response.text();
            alert(`Submission failed: ${response.status} - ${errText}`);
            window.location.reload();
        }
    } catch (err) {
        console.error(err);
        alert('Network error. Is the backend running?');
        allBtns.forEach(btn => btn.disabled = false);
        motivationMessage.innerText = '❌ Submit failed. Please try again.';
    }
}

initAdaptive();