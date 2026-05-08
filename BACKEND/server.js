const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// ---------- AI Setup ----------
const { GoogleGenerativeAI } = require("@google/generative-ai");

const USE_AI_FOR_RECOMMENDATIONS = true;
const USE_AI_FOR_QUESTIONS = true;

async function getAIRecommendation(answers, userInfo) {
    if (!USE_AI_FOR_RECOMMENDATIONS) return null;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelNames = [
        "gemini-1.5-flash",
        "gemini-pro",
        "gemini-2.0-flash",
        "gemini-2.5-flash"
    ];
    const prompt = `You are a highly accurate career guidance AI. Based on the student's answers, recommend the most suitable college program in the Philippines. Provide 2 alternative programs and a confidence level (High/Medium/Low). Speak directly to the student using "you". Keep reasoning very brief (2 sentences). Return ONLY valid JSON.

Student: ${userInfo.name || "the student"}, age ${userInfo.age}, strand: ${userInfo.strand || "N/A"}

Answers (each includes question text and selected choice):
${JSON.stringify(answers, null, 2)}

Rules:
- If the student's answers consistently point to a single category (e.g., Technology, Healthcare, Education, Business, Creative Arts), set confidence to "High".
- If there is some ambiguity, set confidence to "Medium" or "Low" accordingly.
- Recommended program must be a real, well‑known program in the Philippines.

Output JSON format:
{
  "recommendedProgram": "Program name",
  "alternativePrograms": ["Program 2", "Program 3"],
  "reasoning": "Short personal explanation.",
  "confidence": "High"
}`;

    for (const modelName of modelNames) {
        try {
            console.log(`🤖 Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("AI request timeout after 15s")), 15000)
            );
            const resultPromise = model.generateContent(prompt);
            const result = await Promise.race([resultPromise, timeoutPromise]);
            const text = result.response.text();
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                console.log(`✅ AI success with ${modelName}`);
                return JSON.parse(match[0]);
            } else {
                console.warn(`⚠️ ${modelName} returned no valid JSON`);
            }
        } catch (err) {
            console.error(`❌ ${modelName} failed:`, err.message);
            if (err.message.includes('503') || err.message.includes('429')) {
                console.log(`⏳ ${modelName} unavailable, trying next...`);
            }
        }
    }
    console.error("❌ All AI models failed after timeout.");
    return null;
}

// ---------- Express App ----------
const app = express();
app.use(cors());
app.use(express.json());

const uri = "mongodb://localhost:27017/fypprogram";
const client = new MongoClient(uri);

let db;
let adminsCollection;
let responsesCollection;
let questionsCollection;
let schoolsCollection;
let cmsCollection;
let usersCollection;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['x-auth-token'];
    const token = authHeader && authHeader.split(' ')[0];
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });
    jwt.verify(token, process.env.JWT_SECRET || 'secretkey', (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

function getAlternativePrograms(category) {
    const alt = {
        "Technology": ["BS Computer Science", "BS Data Science"],
        "Healthcare": ["BS Medical Technology", "BS Pharmacy"],
        "Education": ["BS Early Childhood Education", "BS Physical Education"],
        "Business": ["BS Marketing Management", "BS Entrepreneurship"],
        "Creative Arts": ["BS Animation", "BS Digital Design"]
    };
    return alt[category] || ["General Studies", "Liberal Arts"];
}

async function startServer() {
    try {
        await client.connect();
        console.log("✅ Connected to local MongoDB");
        db = client.db();
        adminsCollection = db.collection("admins");
        responsesCollection = db.collection("responses");
        questionsCollection = db.collection("questions");
        schoolsCollection = db.collection("schools");
        cmsCollection = db.collection("cms");
        usersCollection = db.collection("users");

        const cmsCount = await cmsCollection.countDocuments();
        if (cmsCount === 0) {
            await cmsCollection.insertOne({
                siteTitle: "PathFind",
                siteSubtitle: "College Program Recommender",
                logoUrl: "",
                primaryColor: "#2c6e9e",
                secondaryColor: "#0f3b4f",
                fontFamily: "Inter"
            });
            console.log("✅ Default CMS settings created");
        }

        app.get('/', (req, res) => res.send('FYP Backend is running'));
        app.get('/api/questions', async (req, res) => {
            try {
                const questions = await questionsCollection.find({ isActive: true }).sort({ order: 1 }).toArray();
                res.json(questions);
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.get('/api/schools', async (req, res) => {
            try {
                const schools = await schoolsCollection.find().toArray();
                res.json(schools);
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.get('/api/cms', async (req, res) => {
            try {
                let cms = await cmsCollection.findOne();
                if (!cms) cms = {};
                res.json(cms);
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.get('/api/responses/latest', async (req, res) => {
            const name = req.query.name;
            if (!name) return res.status(400).json({ message: 'Name required' });
            try {
                const latest = await responsesCollection.find({ name: name }).sort({ createdAt: -1 }).limit(1).toArray();
                if (latest.length === 0) return res.status(404).json({ message: 'No responses found' });
                res.json(latest[0]);
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.post('/api/users/profile', async (req, res) => {
            const { name, age, gender, gradeLevel, strand } = req.body;
            if (!name || !age || !gender || !gradeLevel) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
            try {
                const userDoc = {
                    name: name.trim(),
                    age: parseInt(age),
                    gender: gender,
                    gradeLevel: gradeLevel,
                    strand: strand || '',
                    createdAt: new Date()
                };
                const result = await usersCollection.insertOne(userDoc);
                res.status(201).json({ message: 'Profile saved', userId: result.insertedId });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.post('/api/admin/login', async (req, res) => {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
            try {
                const admin = await adminsCollection.findOne({ username });
                if (!admin || admin.password !== password) return res.status(401).json({ message: 'Invalid credentials' });
                const token = jwt.sign({ id: admin._id, username: admin.username, role: admin.role || 'admin' }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '1d' });
                res.json({ token });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.get('/api/analytics/summary', async (req, res) => {
            try {
                const responses = await responsesCollection.find().toArray();
                const total = responses.length;
                if (total === 0) {
                    return res.json({
                        totalAssessments: 0,
                        averageAge: 0,
                        genderDistribution: { male: 0, female: 0, other: 0 },
                        gradeLevelDistribution: {},
                        mostRecommendedCategory: null,
                        topPrograms: [],
                        categoryInterest: []
                    });
                }
                const avgAge = responses.reduce((sum, r) => sum + (r.age || 0), 0) / total;
                const gender = { male: 0, female: 0, other: 0 };
                responses.forEach(r => {
                    const g = (r.gender || '').toLowerCase();
                    if (g === 'male') gender.male++;
                    else if (g === 'female') gender.female++;
                    else gender.other++;
                });
                const gradeDist = {};
                responses.forEach(r => { if (r.gradeLevel) gradeDist[r.gradeLevel] = (gradeDist[r.gradeLevel] || 0) + 1; });
                const catCount = {};
                responses.forEach(r => { if (r.recommendedCategory) catCount[r.recommendedCategory] = (catCount[r.recommendedCategory] || 0) + 1; });
                let mostRecommendedCategory = null, maxCat = 0;
                for (const [cat, count] of Object.entries(catCount)) if (count > maxCat) { maxCat = count; mostRecommendedCategory = cat; }
                const progCount = {};
                responses.forEach(r => { if (r.recommendedProgram) progCount[r.recommendedProgram] = (progCount[r.recommendedProgram] || 0) + 1; });
                const topPrograms = Object.entries(progCount).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0,5);
                const categoryInterest = Object.entries(catCount).map(([category, count]) => ({ category, percentage: Math.round((count / total) * 100) })).sort((a,b) => b.percentage - a.percentage);
                res.json({ totalAssessments: total, averageAge: avgAge.toFixed(1), genderDistribution: gender, gradeLevelDistribution: gradeDist, mostRecommendedCategory, topPrograms, categoryInterest });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: err.message });
            }
        });

        // Admin CRUD for questions
        app.get('/api/questions/all', authenticateToken, async (req, res) => {
            try {
                const questions = await questionsCollection.find().sort({ order: 1 }).toArray();
                res.json(questions);
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.post('/api/questions', authenticateToken, async (req, res) => {
            try {
                const result = await questionsCollection.insertOne(req.body);
                res.status(201).json({ ...req.body, _id: result.insertedId });
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.put('/api/questions/:id', authenticateToken, async (req, res) => {
            try {
                const { id } = req.params;
                await questionsCollection.updateOne({ _id: new ObjectId(id) }, { $set: req.body });
                res.json({ message: 'Updated' });
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
            try {
                const { id } = req.params;
                await questionsCollection.deleteOne({ _id: new ObjectId(id) });
                res.json({ message: 'Deleted' });
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });

        // Admin CRUD for schools
        app.post('/api/schools', authenticateToken, async (req, res) => {
            try {
                const result = await schoolsCollection.insertOne(req.body);
                res.status(201).json({ ...req.body, _id: result.insertedId });
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.put('/api/schools/:id', authenticateToken, async (req, res) => {
            try {
                const { id } = req.params;
                await schoolsCollection.updateOne({ _id: new ObjectId(id) }, { $set: req.body });
                res.json({ message: 'Updated' });
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });
        app.delete('/api/schools/:id', authenticateToken, async (req, res) => {
            try {
                const { id } = req.params;
                await schoolsCollection.deleteOne({ _id: new ObjectId(id) });
                res.json({ message: 'Deleted' });
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });

        // CMS update
        app.put('/api/cms', authenticateToken, async (req, res) => {
            try {
                const existing = await cmsCollection.findOne();
                if (existing) {
                    await cmsCollection.updateOne({ _id: existing._id }, { $set: req.body });
                } else {
                    await cmsCollection.insertOne(req.body);
                }
                res.json({ message: 'CMS updated' });
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });

        // Admin profile update
        app.put('/api/admin/profile', authenticateToken, async (req, res) => {
            const { username, password } = req.body;
            const adminId = req.user.id;
            if (!username && !password) return res.status(400).json({ message: 'Nothing to update' });
            try {
                const updateFields = {};
                if (username) updateFields.username = username;
                if (password) updateFields.password = password;
                await adminsCollection.updateOne({ _id: new ObjectId(adminId) }, { $set: updateFields });
                res.json({ message: 'Admin profile updated successfully' });
            } catch (err) {
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.post('/api/ai/check-confidence', async (req, res) => {
            const { userInfo, answers } = req.body;
            if (!answers || !answers.length) return res.status(400).json({ message: 'Answers required' });
            const scores = {};
            for (const ans of answers) {
                const cat = ans.category;
                scores[cat] = (scores[cat] || 0) + (ans.weight || 1);
            }
            const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
            const topScore = sorted[0]?.[1] || 0;
            const secondScore = sorted[1]?.[1] || 0;
            const lead = topScore - secondScore;
            const answeredCount = answers.length;
            let confidence = "Low";
            let tentativeRecommendation = null;
            const programMap = {
                "Technology": "BS Information Technology",
                "Healthcare": "BS Nursing",
                "Education": "BS Education",
                "Business": "BS Business Administration",
                "Creative Arts": "BS Multimedia Arts"
            };
            if (answeredCount >= 8 && lead >= 5) {
                confidence = "High";
                const topCategory = sorted[0][0];
                tentativeRecommendation = programMap[topCategory] || "General Studies";
            } else if (answeredCount >= 6 && lead >= 3) {
                confidence = "Medium";
                const topCategory = sorted[0][0];
                tentativeRecommendation = programMap[topCategory] || "General Studies";
            }
            res.json({ confidence, tentativeRecommendation });
        });

        app.post('/api/ai/generate-question', async (req, res) => {
            const { answers, tentativeRecommendation } = req.body;
            if (!answers || !answers.length) return res.status(400).json({ message: 'Answers required' });
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `You are a career guidance AI. Based on the student's answers so far, you have a tentative recommendation: ${tentativeRecommendation || "unknown"}. Generate a single multiple‑choice question (with 5 options) to confirm or refine this recommendation. The question should probe the student's interest in that field. Return ONLY a valid JSON object with: "questionText" and "choices" (array of 5 objects, each with "text" and "category"). The category should be the same as the tentative recommendation's category.

Here are the student's answers so far:
${JSON.stringify(answers, null, 2)}

Example output:
{
  "questionText": "How interested are you in designing user interfaces?",
  "choices": [
    {"text": "Very interested", "category": "Technology"},
    {"text": "Somewhat interested", "category": "Technology"},
    {"text": "Neutral", "category": "Technology"},
    {"text": "Not very interested", "category": "Technology"},
    {"text": "Not at all", "category": "Technology"}
  ]
}`;
            try {
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                const match = text.match(/\{[\s\S]*\}/);
                if (match) {
                    const question = JSON.parse(match[0]);
                    return res.json(question);
                }
            } catch (err) {
                console.error("AI question generation error:", err);
            }
           
            res.json({
                questionText: "How strongly do you feel about pursuing this field?",
                choices: [
                    { text: "Very strongly", category: "General" },
                    { text: "Somewhat strongly", category: "General" },
                    { text: "Neutral", category: "General" },
                    { text: "Weakly", category: "General" },
                    { text: "Not at all", category: "General" }
                ]
            });
        });

        
        app.post('/api/responses', async (req, res) => {
            console.log("📥 Received submission request");
            try {
                const { name, age, gender, strand, gradeLevel, answers } = req.body;
                const scores = {};
                for (const ans of answers) {
                    const cat = ans.category;
                    scores[cat] = (scores[cat] || 0) + (ans.weight || 1);
                }
                const sortedCats = Object.entries(scores).sort((a,b) => b[1] - a[1]);
                const topCategory = sortedCats[0]?.[0] || "Technology";
                const topScore = sortedCats[0]?.[1] || 0;
                const secondScore = sortedCats[1]?.[1] || 0;
                const lead = topScore - secondScore;
                let deterministicConfidence = "Medium";
                if (lead >= 5) deterministicConfidence = "High";
                else if (lead <= 1) deterministicConfidence = "Low";

                let recommendedProgram = "General Studies";
                let alternativePrograms = [];
                let reasoning = "";
                let confidence = deterministicConfidence;
                let isAI = false;

                try {
                    const userInfo = { name, age, gender, strand, gradeLevel };
                    const aiResult = await getAIRecommendation(answers, userInfo);
                    if (aiResult && aiResult.recommendedProgram) {
                        recommendedProgram = aiResult.recommendedProgram;
                        alternativePrograms = aiResult.alternativePrograms || [];
                        reasoning = aiResult.reasoning;
                        confidence = deterministicConfidence === "High" ? "High" : (aiResult.confidence || deterministicConfidence);
                        isAI = true;
                    } else {
                        throw new Error("AI returned empty");
                    }
                } catch (aiError) {
                    console.error("AI failed, using deterministic scoring:", aiError.message);
                    const programMap = {
                        "Technology": "BS Information Technology",
                        "Healthcare": "BS Nursing",
                        "Education": "BS Education",
                        "Business": "BS Business Administration",
                        "Creative Arts": "BS Multimedia Arts"
                    };
                    recommendedProgram = programMap[topCategory] || "General Studies";
                    if (topCategory === "Technology") {
                        reasoning = `You seem to enjoy logical thinking, problem-solving, and working with computers. That's perfect for a career in Information Technology.`;
                    } else if (topCategory === "Healthcare") {
                        reasoning = `You care deeply about helping others and are curious about science and the human body. Nursing or other health-related fields are a natural fit.`;
                    } else if (topCategory === "Education") {
                        reasoning = `You love communicating ideas and helping people grow. That passion for teaching makes Education a wonderful path for you.`;
                    } else if (topCategory === "Business") {
                        reasoning = `You have an eye for opportunities and a drive to lead. Business Administration is a great fit.`;
                    } else if (topCategory === "Creative Arts") {
                        reasoning = `You have a vivid imagination and enjoy expressing yourself through art or media. Creative fields like Multimedia Arts would let you turn your ideas into reality.`;
                    } else {
                        reasoning = `Based on your answers, we think this program aligns well with your interests.`;
                    }
                    confidence = deterministicConfidence;
                    alternativePrograms = getAlternativePrograms(topCategory);
                }

                const responseDoc = {
                    name, age, gender,
                    strand: strand || '',
                    gradeLevel: gradeLevel || 'Not provided',
                    answers,
                    scores,
                    recommendedCategory: topCategory,
                    recommendedProgram,
                    alternativePrograms,
                    reasoning,
                    confidence,
                    isAI,
                    createdAt: new Date()
                };
                await responsesCollection.insertOne(responseDoc);
                console.log("✅ Response saved, returning result");
                res.json({ recommendedProgram, alternativePrograms, reasoning, confidence, isAI });
            } catch (err) {
                console.error("❌ Error in /api/responses:", err);
                res.status(500).json({ message: err.message });
            }
        });

        app.get('/api/responses/all', authenticateToken, async (req, res) => {
            try {
                const responses = await responsesCollection.find().sort({ createdAt: -1 }).toArray();
                res.json(responses);
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
        });

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
}

startServer();

app.post('/api/test', (req, res) => {
    console.log("Test endpoint hit");
    res.json({ message: "ok" });
});