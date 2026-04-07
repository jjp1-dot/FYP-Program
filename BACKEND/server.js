const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

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
                return res.status(400).json({ message: 'Missing required fields: name, age, gender, gradeLevel' });
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
            if (!username || !password) {
                return res.status(400).json({ message: 'Username and password required' });
            }
            try {
                const admin = await adminsCollection.findOne({ username });
                if (!admin || admin.password !== password) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
                const token = jwt.sign(
                    { id: admin._id, username: admin.username, role: admin.role || 'admin' },
                    process.env.JWT_SECRET || 'secretkey',
                    { expiresIn: '1d' }
                );
                res.json({ token });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.get('/api/analytics/summary', authenticateToken, async (req, res) => {
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
                responses.forEach(r => {
                    const grade = r.gradeLevel;
                    if (grade) gradeDist[grade] = (gradeDist[grade] || 0) + 1;
                });

                const catCount = {};
                responses.forEach(r => {
                    const cat = r.recommendedCategory;
                    if (cat) catCount[cat] = (catCount[cat] || 0) + 1;
                });
                let mostRecommendedCategory = null;
                let maxCat = 0;
                for (const [cat, count] of Object.entries(catCount)) {
                    if (count > maxCat) { maxCat = count; mostRecommendedCategory = cat; }
                }

                const progCount = {};
                responses.forEach(r => {
                    const prog = r.recommendedProgram;
                    if (prog) progCount[prog] = (progCount[prog] || 0) + 1;
                });
                const topPrograms = Object.entries(progCount)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a,b) => b.count - a.count)
                    .slice(0, 5);

                const categoryInterest = Object.entries(catCount)
                    .map(([category, count]) => ({ category, percentage: Math.round((count / total) * 100) }))
                    .sort((a,b) => b.percentage - a.percentage);

                res.json({
                    totalAssessments: total,
                    averageAge: avgAge.toFixed(1),
                    genderDistribution: gender,
                    gradeLevelDistribution: gradeDist,
                    mostRecommendedCategory,
                    topPrograms,
                    categoryInterest
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: err.message });
            }
        });

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

        // ✅ Admin profile update route (already present)
        app.put('/api/admin/profile', authenticateToken, async (req, res) => {
            const { username, password } = req.body;
            const adminId = req.user.id;

            if (!username && !password) {
                return res.status(400).json({ message: 'Nothing to update' });
            }

            try {
                const updateFields = {};
                if (username) updateFields.username = username;
                if (password) updateFields.password = password;

                await adminsCollection.updateOne(
                    { _id: new ObjectId(adminId) },
                    { $set: updateFields }
                );
                res.json({ message: 'Admin profile updated successfully' });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.post('/api/responses', async (req, res) => {
            try {
                const { name, age, gender, strand, gradeLevel, answers } = req.body;
                const scores = {};
                answers.forEach(ans => {
                    const cat = ans.category;
                    const weight = ans.weight;
                    scores[cat] = (scores[cat] || 0) + weight;
                });
                let topCategory = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b, null);
                const programMap = {
                    "Technology": "BS Information Technology",
                    "Healthcare": "BS Nursing",
                    "Education": "BS Education",
                    "Business": "BS Business Administration",
                    "Creative Arts": "BS Multimedia Arts"
                };
                const recommendedProgram = programMap[topCategory] || "General Studies";
                const responseDoc = {
                    name,
                    age,
                    gender,
                    strand: strand || '',
                    gradeLevel: gradeLevel || 'Not provided',
                    answers,
                    scores,
                    recommendedCategory: topCategory,
                    recommendedProgram,
                    createdAt: new Date()
                };
                await responsesCollection.insertOne(responseDoc);
                res.json({ recommendedCategory: topCategory, recommendedProgram });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: err.message });
            }
        });

        app.get('/debug-admins', async (req, res) => {
            const admins = await adminsCollection.find().toArray();
            res.json(admins);
        });

        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
}

startServer();