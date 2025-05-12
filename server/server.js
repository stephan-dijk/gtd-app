const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { SignJWT, jwtVerify } = require('jose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { body, validationResult } = require('express-validator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});
const PORT = process.env.PORT || 5000;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your_jwt_secret');

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/gtd-multiuser')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true }
});

const taskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true },
    date_added: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    subtasks: [{
        id: { type: String, required: true },
        description: { type: String, required: true },
        completed: { type: Boolean, default: false }
    }],
    delegatee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    tags: [String],
    expected_start_date: String,
    target_end_date: String,
    date_completed: String,
    section: { type: String, enum: ['inbox', 'delegated', 'completed'], default: 'inbox' }
});

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const designControlSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    category: { 
        type: String, 
        required: true, 
        enum: ['userNeeds', 'designInputs', 'designOutputs', 'designVerifications', 'designValidations'] 
    },
    number: { type: String, required: true },
    description: { type: String, required: true },
    notes: { type: String, default: '' },
    documents: [{ type: String }]
});

// Models
const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Project = mongoose.model('Project', projectSchema);
const DesignControl = mongoose.model('DesignControl', designControlSchema);

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        console.log('JWT payload:', payload); // Debug payload
        if (!payload.id || !payload.username || !/^[0-9a-fA-F]{24}$/.test(payload.id)) {
            console.log('Invalid payload: missing or invalid id/username', { token, payload });
            return res.status(403).json({ error: 'Invalid token payload: missing or invalid id/username' });
        }
        req.user = payload;
        next();
    } catch (err) {
        console.log('Token verification failed:', err.message);
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Routes
app.post('/register', [
    body('username').isLength({ min: 3 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    console.log('POST /register called with body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) return res.status(400).json({ error: 'Username or email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();

        const token = await new SignJWT({ id: user._id.toString(), username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(JWT_SECRET);
        res.status(201).json({ token, user: { id: user._id, username } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.post('/login', [
    body('username').trim().escape(),
    body('password').notEmpty()
], async (req, res) => {
    console.log('POST /login called with body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            console.log(`Login failed: User '${username}' not found`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Login failed: Password incorrect for user '${username}'`);
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        console.log(`Login successful for user '${username}'`);
        const token = await new SignJWT({ id: user._id.toString(), username })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(JWT_SECRET);
        res.json({ token, user: { id: user._id, username } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.get('/users', authenticateToken, async (req, res) => {
    console.log('GET /users called');
    try {
        const users = await User.find({}, 'username _id');
        res.json(users);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.get('/tasks', authenticateToken, async (req, res) => {
    console.log('GET /tasks called for user:', req.user);
    try {
        if (!req.user.id) {
            console.log('Invalid user ID in request');
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        const tasks = await Task.find({
            $or: [
                { userId: req.user.id },
                { delegatee: req.user.id }
            ]
        }).populate('delegatee', 'username');
        res.json(tasks);
    } catch (err) {
        console.error('Get tasks error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.post('/tasks', authenticateToken, [
    body('description').notEmpty().withMessage('Description is required').trim().escape(),
    body('subtasks').optional().isArray().withMessage('Subtasks must be an array'),
    body('subtasks.*.description').optional().notEmpty().withMessage('Subtask description is required').trim().escape(),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('expected_start_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid start date format (YYYY-MM-DD)'),
    body('target_end_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid end date format (YYYY-MM-DD)')
], async (req, res) => {
    console.log('POST /tasks called with body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const taskData = {
        userId: req.user.id,
        description: req.body.description,
        notes: req.body.notes || '',
        subtasks: req.body.subtasks ? req.body.subtasks.map((subtask, i) => ({
            id: subtask.id || `subtask-${Date.now()}-${i}`,
            description: subtask.description,
            completed: subtask.completed || false
        })) : [],
        delegatee: req.body.delegatee || null,
        tags: req.body.tags || [],
        expected_start_date: req.body.expected_start_date || null,
        target_end_date: req.body.target_end_date || null,
        section: 'inbox'
    };

    try {
        const task = new Task(taskData);
        const savedTask = await task.save();
        io.emit('taskUpdate', { task: savedTask, action: 'add' });
        res.status(201).json(savedTask);
    } catch (err) {
        console.error('Create task error:', err);
        res.status(500).json({ error: 'Failed to create task', details: err.message });
    }
});

app.put('/tasks/:id', authenticateToken, [
    body('description').optional().notEmpty().withMessage('Description cannot be empty').trim().escape(),
    body('subtasks').optional().isArray().withMessage('Subtasks must be an array'),
    body('subtasks.*.description').optional().notEmpty().withMessage('Subtask description is required').trim().escape(),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('expected_start_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid start date format (YYYY-MM-DD)'),
    body('target_end_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid end date format (YYYY-MM-DD)')
], async (req, res) => {
    console.log(`PUT /tasks/${req.params.id} called with body:`, req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.userId.toString() !== req.user.id && task.delegatee?.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updates = req.body;
        if (updates.subtasks) {
            updates.subtasks = updates.subtasks.map((subtask, i) => ({
                id: subtask.id || `subtask-${task._id}-${i}`,
                description: subtask.description,
                completed: subtask.completed || false
            }));
        }

        Object.assign(task, updates);
        const updatedTask = await task.save();
        io.emit('taskUpdate', { task: updatedTask, action: 'update' });
        res.json(updatedTask);
    } catch (err) {
        console.error('Update task error:', err);
        res.status(500).json({ error: 'Failed to update task', details: err.message });
    }
});

app.delete('/tasks/:id', authenticateToken, async (req, res) => {
    console.log(`DELETE /tasks/${req.params.id} called`);
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (task.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await Task.deleteOne({ _id: req.params.id });
        io.emit('taskUpdate', { taskId: req.params.id, action: 'delete' });
        res.json({ message: 'Task deleted' });
    } catch (err) {
        console.error('Delete task error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.get('/projects', authenticateToken, async (req, res) => {
    console.log('GET /projects called for user:', req.user.id);
    try {
        const projects = await Project.find({ userId: req.user.id });
        res.json(projects);
    } catch (err) {
        console.error('Get projects error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.post('/projects', authenticateToken, [
    body('name').notEmpty().trim().escape()
], async (req, res) => {
    console.log('POST /projects called with body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name } = req.body;
    try {
        const project = new Project({
            name,
            userId: req.user.id
        });
        const savedProject = await project.save();
        io.emit('projectUpdate', { project: savedProject, action: 'add' });
        res.status(201).json(savedProject);
    } catch (err) {
        console.error('Create project error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.get('/designControls/:projectId', authenticateToken, async (req, res) => {
    console.log(`GET /designControls/${req.params.projectId} called for user:`, req.user.id);
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const designControls = await DesignControl.find({ projectId: req.params.projectId });
        res.json(designControls);
    } catch (err) {
        console.error('Get design controls error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.post('/designControls', authenticateToken, [
    body('category').isIn(['userNeeds', 'designInputs', 'designOutputs', 'designVerifications', 'designValidations']),
    body('description').notEmpty().trim().escape(),
    body('projectId').notEmpty()
], async (req, res) => {
    console.log('POST /designControls called with body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { category, description, notes, documents, projectId } = req.body;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (project.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const count = await DesignControl.countDocuments({ userId: req.user.id, category, projectId });
        const prefix = {
            userNeeds: 'UN',
            designInputs: 'DI',
            designOutputs: 'DO',
            designVerifications: 'DV',
            designValidations: 'DVAL'
        }[category];
        const number = `${prefix}-${(count + 1).toString().padStart(3, '0')}`;
        const designControl = new DesignControl({
            userId: req.user.id,
            projectId,
            category,
            number,
            description,
            notes: notes || '',
            documents: documents || []
        });
        const savedItem = await designControl.save();
        io.emit('designControlUpdate', { item: savedItem, action: 'add' });
        res.status(201).json(savedItem);
    } catch (err) {
        console.error('Create design control error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.put('/designControls/:id', authenticateToken, async (req, res) => {
    console.log(`PUT /designControls/${req.params.id} called with body:`, req.body);
    try {
        const item = await DesignControl.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Design control not found' });
        if (item.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const updates = req.body;
        Object.assign(item, updates);
        const updatedItem = await item.save();
        io.emit('designControlUpdate', { item: updatedItem, action: 'update' });
        res.json(updatedItem);
    } catch (err) {
        console.error('Update design control error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.delete('/designControls/:id', authenticateToken, async (req, res) => {
    console.log(`DELETE /designControls/${req.params.id} called`);
    try {
        const item = await DesignControl.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Design control not found' });
        if (item.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await DesignControl.deleteOne({ _id: req.params.id });
        io.emit('designControlUpdate', { itemId: req.params.id, action: 'delete' });
        res.json({ message: 'Design control deleted' });
    } catch (err) {
        console.error('Delete design control error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Socket.IO
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});