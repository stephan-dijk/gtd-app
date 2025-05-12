const { useState, useEffect, useRef } = React;
const { themes, API_URL, handleInputChange } = window.utils;

const GTDApp = () => {
  console.log('GTDApp initializing...');
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState({ inbox: [], delegated: [], completed: [] });
  const [users, setUsers] = useState([]);
  const [currentTab, setCurrentTab] = useState('inbox');
  const [inboxTagFilter, setInboxTagFilter] = useState('All');
  const [delegatedTagFilter, setDelegatedTagFilter] = useState('All');
  const [completedTagFilter, setCompletedTagFilter] = useState('All');
  const [newTask, setNewTask] = useState('');
  const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 });
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [tempTaskData, setTempTaskData] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [dragging, setDragging] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const [isLogin, setIsLogin] = useState(true);
  const [notification, setNotification] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [currentPage, setCurrentPage] = useState('taskManager');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [designControls, setDesignControls] = useState([]);
  const [tempDesignData, setTempDesignData] = useState({});
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef(null);
  const dropdownRef = useRef(null);
  // Refs for single-line inputs
  const taskInputRef = useRef(null);
  const subtaskInputRef = useRef(null);
  const designControlInputRef = useRef(null);
  const projectNameInputRef = useRef(null);
  const newTaskInputRef = useRef(null);
  const loginUsernameInputRef = useRef(null);
  const loginPasswordInputRef = useRef(null);
  const registerUsernameInputRef = useRef(null);
  const registerEmailInputRef = useRef(null);
  const registerPasswordInputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setUser({ id: res.data[0]._id, username: res.data[0].username });
        if (currentPage === 'taskManager') {
          fetchTasks(token);
          fetchUsers(token);
        } else if (currentPage === 'mdrDesignControl') {
          fetchProjects(token);
        }
      }).catch(err => {
        console.error('User fetch error:', err);
        localStorage.removeItem('token');
        setUser(null);
        setErrorMessage('Session expired. Please log in again.');
      });
    }

    socketRef.current = io(API_URL);
    socketRef.current.on('taskUpdate', ({ task, taskId, action }) => {
      setTasks(prev => {
        let newTasks = { ...prev };
        if (action === 'add') {
          if (task.userId === user?.id || task.delegatee?._id === user?.id) {
            newTasks[task.section].push(task);
          }
        } else if (action === 'update') {
          for (const section of ['inbox', 'delegated', 'completed']) {
            newTasks[section] = newTasks[section].map(t =>
              t._id === task._id ? task : t
            );
          }
        } else if (action === 'delete') {
          for (const section of ['inbox', 'delegated', 'completed']) {
            newTasks[section] = newTasks[section].filter(t => t._id !== taskId);
          }
          if (selectedTask?._id === taskId) setSelectedTask(null);
        }
        return newTasks;
      });
      if (action === 'add' && task.delegatee?._id === user?.id) {
        setNotification(`New task assigned to you: ${task.description}`);
        setTimeout(() => setNotification(null), 5000);
      }
    });

    socketRef.current.on('designControlUpdate', ({ item, itemId, action }) => {
      if (item.projectId !== currentProject) return;
      setDesignControls(prev => {
        let newItems = [...prev];
        if (action === 'add') {
          if (item.userId === user?.id && item.projectId === currentProject) {
            newItems.push(item);
          }
        } else if (action === 'update') {
          newItems = newItems.map(i => i._id === item._id ? item : i);
        } else if (action === 'delete') {
          newItems = newItems.filter(i => i._id !== itemId);
        }
        return newItems;
      });
    });

    socketRef.current.on('projectUpdate', ({ project, action }) => {
      setProjects(prev => {
        if (action === 'add') {
          return [...prev, project];
        }
        return prev;
      });
    });

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      socketRef.current.disconnect();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user, currentPage, currentProject]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = themes[theme].body;
  }, [theme]);

  useEffect(() => {
    if (user && currentPage === 'mdrDesignControl' && currentProject) {
      fetchDesignControls(localStorage.getItem('token'), currentProject);
    }
  }, [currentProject]);

  const fetchTasks = async (token) => {
    try {
      const res = await axios.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const taskMap = { inbox: [], delegated: [], completed: [] };
      res.data.forEach(task => {
        taskMap[task.section].push(task);
      });
      setTasks(taskMap);
    } catch (err) {
      console.error('Fetch tasks error:', err);
      setErrorMessage('Failed to fetch tasks: ' + (err.response?.data?.error || 'Server error'));
    }
  };

  const fetchUsers = async (token) => {
    try {
      const res = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error('Fetch users error:', err);
      setErrorMessage('Failed to fetch users: ' + (err.response?.data?.error || 'Server error'));
    }
  };

  const fetchProjects = async (token) => {
    try {
      const res = await axios.get(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(res.data);
      if (res.data.length > 0 && !currentProject) {
        setCurrentProject(res.data[0]._id);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
      setErrorMessage('Failed to fetch projects: ' + (err.response?.data?.error || 'Server error'));
    }
  };

  const fetchDesignControls = async (token, projectId) => {
    try {
      const res = await axios.get(`${API_URL}/designControls/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDesignControls(res.data);
    } catch (err) {
      console.error('Fetch design controls error:', err);
      setErrorMessage('Failed to fetch design controls: ' + (err.response?.data?.error || 'Server error'));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.post(`${API_URL}/${isLogin ? 'login' : 'register'}`, isLogin ? loginData : registerData);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      setLoginData({ username: '', password: '' });
      setRegisterData({ username: '', email: '', password: '' });
      fetchTasks(res.data.token);
      fetchUsers(res.data.token);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Authentication failed';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setTasks({ inbox: [], delegated: [], completed: [] });
    setDesignControls([]); 
    setProjects([]);
    setCurrentProject(null);
    setSelectedTask(null);
    setCurrentPage('taskManager');
    setIsDropdownOpen(false);
    setErrorMessage(null);
  };

  const captureTask = async () => {
    if (!newTask.trim()) {
      setErrorMessage('Task description is required');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    const task = {
      description: newTask.trim(),
      expected_start_date: new Date().toISOString().split('T')[0],
      target_end_date: new Date().toISOString().split('T')[0],
      subtasks: [],
      tags: [],
      notes: ''
    };
    try {
      const res = await axios.post(`${API_URL}/tasks`, task, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => ({
        ...prev,
        inbox: [...prev.inbox, res.data]
      }));
      setNewTask('');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create task';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const completeTask = async () => {
    if (!selectedTask) return;
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.put(`${API_URL}/tasks/${selectedTask._id}`, {
        ...selectedTask,
        section: 'completed',
        date_completed: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks.inbox = newTasks.inbox.filter(t => t._id !== selectedTask._id);
        newTasks.completed.push(res.data);
        return newTasks;
      });
      setSelectedTask(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to complete task';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const delegateTask = async () => {
    if (!selectedTask) return;
    const delegateeUsername = prompt('Enter delegatee username:');
    const delegatee = users.find(u => u.username === delegateeUsername);
    if (!delegatee) {
      setErrorMessage('User not found');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.put(`${API_URL}/tasks/${selectedTask._id}`, {
        ...selectedTask,
        delegatee: delegatee._id,
        section: 'delegated'
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks.inbox = newTasks.inbox.filter(t => t._id !== selectedTask._id);
        newTasks.delegated.push(res.data);
        return newTasks;
      });
      setSelectedTask(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delegate task';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTask = async () => {
    if (!selectedTask) return;
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await axios.delete(`${API_URL}/tasks/${selectedTask._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks[currentTab] = newTasks[currentTab].filter(t => t._id !== selectedTask._id);
        return newTasks;
      });
      setSelectedTask(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete task';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = async () => {
    if (!selectedTask) return;
    const tag = prompt('Enter tag to add:');
    if (!tag || tag.trim() === '') {
      setErrorMessage('Tag cannot be empty');
      return;
    }
    if (selectedTask.tags.includes(tag.trim())) {
      setErrorMessage('Tag already exists');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.put(`${API_URL}/tasks/${selectedTask._id}`, {
        ...selectedTask,
        tags: [...selectedTask.tags, tag.trim()]
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks[currentTab] = newTasks[currentTab].map(t =>
          t._id === selectedTask._id ? res.data : t
        );
        return newTasks;
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to add tag';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addSubtask = async () => {
    if (!selectedTask) return;
    const subtaskDesc = prompt('Enter subtask description:');
    if (!subtaskDesc || subtaskDesc.trim() === '') {
      setErrorMessage('Subtask description cannot be empty');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    const subtaskId = `subtask-${selectedTask._id}-${selectedTask.subtasks.length}`;
    const newSubtasks = [...selectedTask.subtasks, { id: subtaskId, description: subtaskDesc.trim(), completed: false }];
    try {
      const res = await axios.put(`${API_URL}/tasks/${selectedTask._id}`, {
        ...selectedTask,
        subtasks: newSubtasks
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks[currentTab] = newTasks[currentTab].map(t =>
          t._id === selectedTask._id ? res.data : t
        );
        return newTasks;
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to add subtask';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSubtask = async (task, subtaskIndex) => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    const newSubtasks = [...task.subtasks];
    newSubtasks[subtaskIndex].completed = !newSubtasks[subtaskIndex].completed;
    try {
      const res = await axios.put(`${API_URL}/tasks/${task._id}`, {
        ...task,
        subtasks: newSubtasks
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks[currentTab] = newTasks[currentTab].map(t =>
          t._id === task._id ? res.data : t
        );
        return newTasks;
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to toggle subtask';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSubtask = async (task, subtaskIndex) => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    const newSubtasks = task.subtasks.filter((_, i) => i !== subtaskIndex);
    try {
      const res = await axios.put(`${API_URL}/tasks/${task._id}`, {
        ...task,
        subtasks: newSubtasks
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks[currentTab] = newTasks[currentTab].map(t =>
          t._id === task._id ? res.data : t
        );
        return newTasks;
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete subtask';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    setDragging(index);
    console.log('Drag started, index:', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetIndex, task) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex) return;
    console.log('Dropped, source:', sourceIndex, 'target:', targetIndex);
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    const newSubtasks = [...task.subtasks];
    const [draggedItem] = newSubtasks.splice(sourceIndex, 1);
    newSubtasks.splice(targetIndex, 0, draggedItem);
    try {
      const res = await axios.put(`${API_URL}/tasks/${task._id}`, {
        ...task,
        subtasks: newSubtasks
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks[currentTab] = newTasks[currentTab].map(t =>
          t._id === task._id ? res.data : t
        );
        return newTasks;
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to reorder subtasks';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
    setDragging(null);
  };

  const handleDragEnd = () => {
    setDragging(null);
    console.log('Drag ended');
  };

  const moveBack = async () => {
    if (!selectedTask) return;
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.put(`${API_URL}/tasks/${selectedTask._id}`, {
        ...selectedTask,
        section: 'inbox',
        delegatee: null,
        date_completed: null
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTasks(prev => {
        const newTasks = { ...prev };
        newTasks[currentTab] = newTasks[currentTab].filter(t => t._id !== selectedTask._id);
        newTasks.inbox.push(res.data);
        return newTasks;
      });
      setSelectedTask(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to move task back';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (item, mode, subtaskIndex = null) => {
    if (mode === 'task') {
      setEditingItem({ task: item, mode });
      setTempTaskData({
        description: item.description,
        expected_start_date: item.expected_start_date || '',
        target_end_date: item.target_end_date || '',
        notes: item.notes || '',
        tags: item.tags.join(', ')
      });
    } else if (mode === 'subtask') {
      setEditingItem({ task: item, mode, subtaskIndex });
      setTempTaskData({
        description: item.subtasks[subtaskIndex].description
      });
    } else if (mode === 'designControl') {
      setEditingItem({ item, mode });
      setTempDesignData({
        description: item.description || '',
        notes: item.notes || '',
        documents: item.documents || []
      });
    }
    setIsModalOpen(true);
    setErrorMessage(null);
  };

  const handleModalSubmit = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    if (editingItem.mode === 'task' || editingItem.mode === 'subtask') {
      const { task, mode, subtaskIndex } = editingItem;
      try {
        if (!tempTaskData.description?.trim()) {
          throw new Error('Description is required');
        }
        if (mode === 'task') {
          if (tempTaskData.expected_start_date && !/^\d{4}-\d{2}-\d{2}$/.test(tempTaskData.expected_start_date)) {
            throw new Error('Invalid start date (YYYY-MM-DD)');
          }
          if (tempTaskData.target_end_date && !/^\d{4}-\d{2}-\d{2}$/.test(tempTaskData.target_end_date)) {
            throw new Error('Invalid end date (YYYY-MM-DD)');
          }
          const res = await axios.put(`${API_URL}/tasks/${task._id}`, {
            ...task,
            description: tempTaskData.description.trim(),
            expected_start_date: tempTaskData.expected_start_date || null,
            target_end_date: tempTaskData.target_end_date || null,
            notes: tempTaskData.notes || '',
            tags: tempTaskData.tags.split(',').map(t => t.trim()).filter(t => t)
          }, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setTasks(prev => {
            const newTasks = { ...prev };
            newTasks[currentTab] = newTasks[currentTab].map(t =>
              t._id === task._id ? res.data : t
            );
            return newTasks;
          });
          if (selectedTask?._id === task._id) setSelectedTask(res.data);
        } else if (mode === 'subtask') {
          const newSubtasks = [...task.subtasks];
          newSubtasks[subtaskIndex].description = tempTaskData.description.trim();
          const res = await axios.put(`${API_URL}/tasks/${task._id}`, {
            ...task,
            subtasks: newSubtasks
          }, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setTasks(prev => {
            const newTasks = { ...prev };
            newTasks[currentTab] = newTasks[currentTab].map(t =>
              t._id === task._id ? res.data : t
            );
            return newTasks;
          });
          if (selectedTask?._id === task._id) setSelectedTask(res.data);
        }
        setIsModalOpen(false);
        setEditingItem(null);
        setTempTaskData({});
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.message || 'Failed to save changes';
        const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
        setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
      } finally {
        setIsLoading(false);
      }
    } else if (editingItem.mode === 'designControl') {
      const { item } = editingItem;
      try {
        if (!tempDesignData.description?.trim()) {
          throw new Error('Description is required');
        }
        const res = await axios.put(`${API_URL}/designControls/${item._id}`, {
          ...item,
          description: tempDesignData.description.trim(),
          notes: tempDesignData.notes,
          documents: tempDesignData.documents,
          projectId: currentProject
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setDesignControls(prev => prev.map(i => i._id === item._id ? res.data : i));
        setIsModalOpen(false);
        setEditingItem(null);
        setTempDesignData({});
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.message || 'Failed to save changes';
        const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
        setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      setErrorMessage('Project name is required');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.post(`${API_URL}/projects`, {
        name: newProjectName.trim(),
        userId: user.id
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProjects([...projects, res.data]);
      setCurrentProject(res.data._id);
      setNewProjectName('');
      setIsProjectModalOpen(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create project';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addDesignControl = async (category) => {
    if (!currentProject) {
      setErrorMessage('Please select or create a project first');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const newItem = {
        category,
        description: 'New Item',
        notes: '',
        documents: [],
        userId: user.id,
        projectId: currentProject
      };
      const res = await axios.post(`${API_URL}/designControls`, newItem, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDesignControls([...designControls, res.data]);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to add design control';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDesignControl = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await axios.delete(`${API_URL}/designControls/${itemId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDesignControls(designControls.filter(i => i._id !== itemId));
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete design control';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesignDragStart = (e, itemId) => {
    e.dataTransfer.setData('text/plain', itemId);
    setDragging(itemId);
    console.log('Design drag started, id:', itemId);
  };

  const handleDesignDrop = async (e, targetCategory) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    const item = designControls.find(i => i._id === itemId);
    if (!item || item.category === targetCategory) return;
    console.log('Design dropped, id:', itemId, 'target category:', targetCategory);
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.put(`${API_URL}/designControls/${itemId}`, {
        ...item,
        category: targetCategory,
        projectId: currentProject
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDesignControls(designControls.map(i => i._id === itemId ? res.data : i));
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to move design control';
      const details = err.response?.data?.details ? err.response.data.details.map(d => d.msg).join('; ') : '';
      setErrorMessage(`${errorMsg}${details ? ': ' + details : ''}`);
    } finally {
      setIsLoading(false);
    }
    setDragging(null);
  };

  const getAllTags = () => {
    const allTags = new Set();
    ['inbox', 'delegated', 'completed'].forEach(section => {
      tasks[section].forEach(task => {
        task.tags.forEach(tag => allTags.add(tag));
      });
    });
    return ['All', ...Array.from(allTags).sort()];
  };

  const showTooltip = (task, event) => {
    const content = `Notes: ${task.notes || 'No notes'}`;
    setTooltip({
      visible: true,
      content,
      x: event.clientX + 10,
      y: event.clientY + 10
    });
  };

  const hideTooltip = () => {
    setTooltip({ visible: false, content: '', x: 0, y: 0 });
  };

  const toggleExpandTask = (taskId) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const renderActionButtons = () => {
    const isTaskSelected = !!selectedTask;
    const isOwner = selectedTask && selectedTask.userId === user?.id;
    const buttons = [];

    if (currentTab === 'inbox') {
      buttons.push(
        <button
          key="doNow"
          onClick={completeTask}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.doNow : themes[theme].actionButtons.inactive}
        >
          Do Now
        </button>,
        <button
          key="delegate"
          onClick={delegateTask}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.delegate : themes[theme].actionButtons.inactive}
        >
          Delegate
        </button>,
        <button
          key="addTag"
          onClick={addTag}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.addTag : themes[theme].actionButtons.inactive}
        >
          Add Tag
        </button>,
        <button
          key="delete"
          onClick={deleteTask}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.delete : themes[theme].actionButtons.inactive}
        >
          Delete
        </button>,
        <button
          key="addSubtask"
          onClick={addSubtask}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.addSubtask : themes[theme].actionButtons.inactive}
        >
          Add Subtask
        </button>,
        <button
          key="edit"
          onClick={() => openEditModal(selectedTask, 'task')}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.edit : themes[theme].actionButtons.inactive}
        >
          Edit
        </button>
      );
      if (selectedTask?.subtasks.length > 0) {
        buttons.push(
          <button
            key="expand"
            onClick={() => toggleExpandTask(selectedTask._id)}
            disabled={!isTaskSelected || isLoading}
            className={isTaskSelected && !isLoading ? themes[theme].actionButtons.expand : themes[theme].actionButtons.inactive}
          >
            {expandedTasks.has(selectedTask._id) ? 'Collapse' : 'Expand'}
          </button>
        );
      }
    } else if (currentTab === 'delegated') {
      buttons.push(
        <button
          key="moveBack"
          onClick={moveBack}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.doNow : themes[theme].actionButtons.inactive}
        >
          Move Back
        </button>,
        <button
          key="addTag"
          onClick={addTag}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.addTag : themes[theme].actionButtons.inactive}
        >
          Add Tag
        </button>,
        <button
          key="delete"
          onClick={deleteTask}
          disabled={!isTaskSelected || !isOwner || isLoading}
          className={isTaskSelected && isOwner && !isLoading ? themes[theme].actionButtons.delete : themes[theme].actionButtons.inactive}
        >
          Delete
        </button>,
        <button
          key="edit"
          onClick={() => openEditModal(selectedTask, 'task')}
          disabled={!isTaskSelected || isLoading}
          className={isTaskSelected && !isLoading ? themes[theme].actionButtons.edit : themes[theme].actionButtons.inactive}
        >
          Edit
        </button>
      );
    }

    return (
      <div className="flex space-x-2 mb-4">
        {buttons}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'inbox':
        return (
          <div>
            <div className="flex items-center mb-4">
              <label className="mr-2">Filter by tag:</label>
              <select
                value={inboxTagFilter}
                onChange={e => setInboxTagFilter(e.target.value)}
                className={themes[theme].input}
              >
                {getAllTags().map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            <div className="flex mb-4">
              <input
                type="text"
                value={newTask}
                onChange={e => handleInputChange(newTaskInputRef, setNewTask, {}, '', e.target.value)}
                placeholder="New Task"
                className={`flex-1 ${themes[theme].input} mr-2`}
                ref={newTaskInputRef}
                disabled={isLoading}
                autoFocus
              />
              <button
                onClick={captureTask}
                className={isLoading ? themes[theme].actionButtons.inactive : themes[theme].button}
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
            {errorMessage && (
              <div className={`${themes[theme].error} mb-4`}>
                {errorMessage}
              </div>
            )}
            {renderActionButtons()}
            <table className="w-full text-left relative">
              <thead>
                <tr className={themes[theme].tableHeader}>
                  <th className="p-2">Description</th>
                  <th className="p-2">Subtasks</th>
                  <th className="p-2">Tags</th>
                  <th className="p-2">Start Date</th>
                  <th className="p-2">End Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.inbox
                  .filter(task => inboxTagFilter === 'All' || task.tags.includes(inboxTagFilter))
                  .sort((a, b) => (a.tags[0] || 'zzz').localeCompare(b.tags[0] || 'zzz'))
                  .map(task => (
                    <React.Fragment key={task._id}>
                      <tr
                        className={`${themes[theme].tableRow} cursor-pointer ${selectedTask?._id === task._id ? themes[theme].selectedRow : ''}`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <td className="p-2">
                          <span
                            onMouseEnter={e => showTooltip(task, e)}
                            onMouseLeave={hideTooltip}
                            className="cursor-pointer"
                          >
                            {task.description}
                          </span>
                        </td>
                        <td className="p-2">
                          {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                        </td>
                        <td className="p-2">{task.tags.join(', ')}</td>
                        <td className="p-2">{task.expected_start_date || '-'}</td>
                        <td className="p-2">{task.target_end_date || '-'}</td>
                      </tr>
                      {expandedTasks.has(task._id) && (
                        <tr>
                          <td colSpan="5" className="p-2">
                            <div className="ml-4">
                              <p className="text-sm text-gray-400 mb-2">
                                Drag and drop to reorder subtasks
                              </p>
                              {task.subtasks.map((subtask, index) => (
                                <div
                                  key={subtask.id}
                                  draggable="true"
                                  onDragStart={e => handleDragStart(e, index)}
                                  onDragOver={handleDragOver}
                                  onDrop={e => handleDrop(e, index, task)}
                                  onDragEnd={handleDragEnd}
                                  className={`flex items-center mb-2 p-2 rounded-lg ${dragging === index ? 'opacity-50' : ''} ${themes[theme].kanban.card} ${themes[theme].kanban.cardHover}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={subtask.completed}
                                    onChange={() => toggleSubtask(task, index)}
                                    className="mr-2"
                                    disabled={isLoading}
                                  />
                                  <span className={subtask.completed ? 'line-through text-gray-500' : ''}>
                                    {subtask.description}
                                  </span>
                                  <div className="ml-auto flex space-x-2">
                                    <button
                                      onClick={() => openEditModal(task, 'subtask', index)}
                                      className={themes[theme].actionButtons.edit}
                                      disabled={isLoading}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteSubtask(task, index)}
                                      className={themes[theme].actionButtons.delete}
                                      disabled={isLoading}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        );
      case 'delegated':
        return (
          <div>
            <div className="flex items-center mb-4">
              <label className="mr-2">Filter by tag:</label>
              <select
                value={delegatedTagFilter}
                onChange={e => setDelegatedTagFilter(e.target.value)}
                className={themes[theme].input}
              >
                {getAllTags().map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            {errorMessage && (
              <div className={`${themes[theme].error} mb-4`}>
                {errorMessage}
              </div>
            )}
            {renderActionButtons()}
            <table className="w-full text-left">
              <thead>
                <tr className={themes[theme].tableHeader}>
                  <th className="p-2">Description</th>
                  <th className="p-2">Subtasks</th>
                  <th className="p-2">Tags</th>
                  <th className="p-2">Delegatee</th>
                  <th className="p-2">Start Date</th>
                  <th className="p-2">End Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.delegated
                  .filter(task => delegatedTagFilter === 'All' || task.tags.includes(delegatedTagFilter))
                  .sort((a, b) => (a.tags[0] || 'zzz').localeCompare(b.tags[0] || 'zzz'))
                  .map(task => (
                    <React.Fragment key={task._id}>
                      <tr
                        className={`${themes[theme].tableRow} cursor-pointer ${selectedTask?._id === task._id ? themes[theme].selectedRow : ''}`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <td className="p-2">
                          <span
                            onMouseEnter={e => showTooltip(task, e)}
                            onMouseLeave={hideTooltip}
                            className="cursor-pointer"
                          >
                            {task.description}
                          </span>
                        </td>
                        <td className="p-2">
                          {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                        </td>
                        <td className="p-2">{task.tags.join(', ')}</td>
                        <td className="p-2">{task.delegatee?.username || '-'}</td>
                        <td className="p-2">{task.expected_start_date || '-'}</td>
                        <td className="p-2">{task.target_end_date || '-'}</td>
                      </tr>
                      {expandedTasks.has(task._id) && (
                        <tr>
                          <td colSpan="6" className="p-2">
                            <div className="ml-4">
                              <p className="text-sm text-gray-400 mb-2">
                                Drag and drop to reorder subtasks
                              </p>
                              {task.subtasks.map((subtask, index) => (
                                <div
                                  key={subtask.id}
                                  draggable="true"
                                  onDragStart={e => handleDragStart(e, index)}
                                  onDragOver={handleDragOver}
                                  onDrop={e => handleDrop(e, index, task)}
                                  onDragEnd={handleDragEnd}
                                  className={`flex items-center mb-2 p-2 rounded-lg ${dragging === index ? 'opacity-50' : ''} ${themes[theme].kanban.card} ${themes[theme].kanban.cardHover}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={subtask.completed}
                                    onChange={() => toggleSubtask(task, index)}
                                    className="mr-2"
                                    disabled={isLoading}
                                  />
                                  <span className={subtask.completed ? 'line-through text-gray-500' : ''}>
                                    {subtask.description}
                                  </span>
                                  <div className="ml-auto flex space-x-2">
                                    <button
                                      onClick={() => openEditModal(task, 'subtask', index)}
                                      className={themes[theme].actionButtons.edit}
                                      disabled={isLoading}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteSubtask(task, index)}
                                      className={themes[theme].actionButtons.delete}
                                      disabled={isLoading}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        );
      case 'completed':
        return (
          <div>
            <div className="flex items-center mb-4">
              <label className="mr-2">Filter by tag:</label>
              <select
                value={completedTagFilter}
                onChange={e => setCompletedTagFilter(e.target.value)}
                className={themes[theme].input}
              >
                {getAllTags().map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            {errorMessage && (
              <div className={`${themes[theme].error} mb-4`}>
                {errorMessage}
              </div>
            )}
            <table className="w-full text-left">
              <thead>
                <tr className={themes[theme].tableHeader}>
                  <th className="p-2">Description</th>
                  <th className="p-2">Subtasks</th>
                  <th className="p-2">Tags</th>
                  <th className="p-2">Completed Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.completed
                  .filter(task => completedTagFilter === 'All' || task.tags.includes(completedTagFilter))
                  .sort((a, b) => (a.tags[0] || 'zzz').localeCompare(b.tags[0] || 'zzz'))
                  .map(task => (
                    <React.Fragment key={task._id}>
                      <tr
                        className={`${themes[theme].tableRow} cursor-pointer ${selectedTask?._id === task._id ? themes[theme].selectedRow : ''}`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <td className="p-2">
                          <span
                            onMouseEnter={e => showTooltip(task, e)}
                            onMouseLeave={hideTooltip}
                            className="cursor-pointer"
                          >
                            {task.description}
                          </span>
                        </td>
                        <td className="p-2">
                          {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                        </td>
                        <td className="p-2">{task.tags.join(', ')}</td>
                        <td className="p-2">{task.date_completed ? new Date(task.date_completed).toLocaleDateString() : '-'}</td>
                      </tr>
                      {expandedTasks.has(task._id) && (
                        <tr>
                          <td colSpan="4" className="p-2">
                            <div className="ml-4">
                              <p className="text-sm text-gray-400 mb-2">
                                Subtasks
                              </p>
                              {task.subtasks.map((subtask, index) => (
                                <div
                                  key={subtask.id}
                                  className={`flex items-center mb-2 p-2 rounded-lg ${themes[theme].kanban.card}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={subtask.completed}
                                    onChange={() => toggleSubtask(task, index)}
                                    className="mr-2"
                                    disabled={isLoading}
                                  />
                                  <span className={subtask.completed ? 'line-through text-gray-500' : ''}>
                                    {subtask.description}
                                  </span>
                                  <div className="ml-auto flex space-x-2">
                                    <button
                                      onClick={() => openEditModal(task, 'subtask', index)}
                                      className={themes[theme].actionButtons.edit}
                                      disabled={isLoading}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteSubtask(task, index)}
                                      className={themes[theme].actionButtons.delete}
                                      disabled={isLoading}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return null;
    }
  };

  const renderMDRDesignControl = () => {
    const categories = [
      { id: 'userNeeds', title: 'User Needs' },
      { id: 'designInputs', title: 'Design Inputs' },
      { id: 'designOutputs', title: 'Design Outputs' },
      { id: 'designVerifications', title: 'Design Verifications' },
      { id: 'designValidations', title: 'Design Validations' }
    ];

    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">MDR Design Control</h2>
        <div className="flex items-center mb-4">
          <select
            value={currentProject || ''}
            onChange={e => setCurrentProject(e.target.value)}
            className={`${themes[theme].input} mr-2`}
          >
            {projects.map(project => (
              <option key={project._id} value={project._id}>{project.name}</option>
            ))}
          </select>
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className={themes[theme].button}
          >
            New Project
          </button>
        </div>
        {errorMessage && (
          <div className={`${themes[theme].error} mb-4`}>
            {errorMessage}
          </div>
        )}
        <div className="grid grid-cols-5 md:grid-cols-5 gap-4">
          {categories.map(category => (
            <div
              key={category.id}
              className={`${themes[theme].kanban.column}`}
              onDragOver={handleDragOver}
              onDrop={e => handleDesignDrop(e, category.id)}
            >
              <h3 className="text-lg font-semibold mb-2">{category.title}</h3>
              <button
                onClick={() => addDesignControl(category.id)}
                className={`${themes[theme].button} mb-2 w-full`}
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Item'}
              </button>
              {designControls
                .filter(item => item.category === category.id)
                .map(item => (
                  <div
                    key={item._id}
                    draggable="true"
                    onDragStart={e => handleDesignDragStart(e, item._id)}
                    className={`${themes[theme].kanban.card} ${themes[theme].kanban.cardHover} ${dragging === item._id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{item.description}</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(item, 'designControl')}
                          className={themes[theme].actionButtons.edit}
                          disabled={isLoading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteDesignControl(item._id)}
                          className={themes[theme].actionButtons.delete}
                          disabled={isLoading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">Number: {item.number}</p>
                    <p className="text-sm text-gray-400">Notes: {item.notes || 'None'}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className={`${themes[theme].container} p-6 rounded-lg shadow-lg w-full max-w-md`}>
        <h2 className="text-2xl font-bold mb-4">{isLogin ? 'Login' : 'Register'}</h2>
        {errorMessage && (
          <div className={`${themes[theme].error} mb-4`}>
            {errorMessage}
          </div>
        )}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block mb-1">Username</label>
            <input
              type="text"
              value={isLogin ? loginData.username : registerData.username}
              onChange={e => handleInputChange(
                isLogin ? loginUsernameInputRef : registerUsernameInputRef,
                isLogin ? setLoginData : setRegisterData,
                isLogin ? loginData : registerData,
                'username',
                e.target.value
              )}
              className={themes[theme].input}
              ref={isLogin ? loginUsernameInputRef : registerUsernameInputRef}
              disabled={isLoading}
              autoFocus
            />
          </div>
          {!isLogin && (
            <div className="mb-4">
              <label className="block mb-1">Email</label>
              <input
                type="email"
                value={registerData.email}
                onChange={e => handleInputChange(
                  registerEmailInputRef,
                  setRegisterData,
                  registerData,
                  'email',
                  e.target.value
                )}
                className={themes[theme].input}
                ref={registerEmailInputRef}
                disabled={isLoading}
              />
            </div>
          )}
          <div className="mb-4">
            <label className="block mb-1">Password</label>
            <input
              type="password"
              value={isLogin ? loginData.password : registerData.password}
              onChange={e => handleInputChange(
                isLogin ? loginPasswordInputRef : registerPasswordInputRef,
                isLogin ? setLoginData : setRegisterData,
                isLogin ? loginData : registerData,
                'password',
                e.target.value
              )}
              className={themes[theme].input}
              ref={isLogin ? loginPasswordInputRef : registerPasswordInputRef}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className={isLoading ? themes[theme].actionButtons.inactive : themes[theme].button}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className={`${themes[theme].button} mt-4 w-full`}
          disabled={isLoading}
        >
          {isLogin ? 'Switch to Register' : 'Switch to Login'}
        </button>
      </div>
    </div>
  );

  const renderModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className={`fixed inset-0 ${themes[theme].modalBackdrop} flex items-center justify-center z-50`}>
        <div className={`${themes[theme].modal} p-6 rounded-lg shadow-lg w-full max-w-md`}>
          <h2 className="text-xl font-bold mb-4">
            {editingItem.mode === 'task' ? 'Edit Task' : editingItem.mode === 'subtask' ? 'Edit Subtask' : 'Edit Design Control'}
          </h2>
          {errorMessage && (
            <div className={`${themes[theme].error} mb-4`}>
              {errorMessage}
            </div>
          )}
          {editingItem.mode === 'task' && (
            <>
              <div className="mb-4">
                <label className="block mb-1">Description</label>
                <input
                  type="text"
                  value={tempTaskData.description || ''}
                  onChange={e => handleInputChange(
                    taskInputRef,
                    setTempTaskData,
                    tempTaskData,
                    'description',
                    e.target.value
                  )}
                  className={themes[theme].input}
                  ref={taskInputRef}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Start Date</label>
                <input
                  type="date"
                  value={tempTaskData.expected_start_date || ''}
                  onChange={e => setTempTaskData({ ...tempTaskData, expected_start_date: e.target.value })}
                  className={themes[theme].input}
                  disabled={isLoading}
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">End Date</label>
                <input
                  type="date"
                  value={tempTaskData.target_end_date || ''}
                  onChange={e => setTempTaskData({ ...tempTaskData, target_end_date: e.target.value })}
                  className={themes[theme].input}
                  disabled={isLoading}
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Notes</label>
                <textarea
                  value={tempTaskData.notes || ''}
                  onChange={e => setTempTaskData({ ...tempTaskData, notes: e.target.value })}
                  className={themes[theme].input}
                  disabled={isLoading}
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tempTaskData.tags || ''}
                  onChange={e => handleInputChange(
                    taskInputRef,
                    setTempTaskData,
                    tempTaskData,
                    'tags',
                    e.target.value
                  )}
                  className={themes[theme].input}
                  ref={taskInputRef}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
          {editingItem.mode === 'subtask' && (
            <div className="mb-4">
              <label className="block mb-1">Description</label>
              <input
                type="text"
                value={tempTaskData.description || ''}
                onChange={e => handleInputChange(
                  subtaskInputRef,
                  setTempTaskData,
                  tempTaskData,
                  'description',
                  e.target.value
                )}
                className={themes[theme].input}
                ref={subtaskInputRef}
                disabled={isLoading}
                autoFocus
              />
            </div>
          )}
          {editingItem.mode === 'designControl' && (
            <>
              <div className="mb-4">
                <label className="block mb-1">Description</label>
                <input
                  type="text"
                  value={tempDesignData.description || ''}
                  onChange={e => handleInputChange(
                    designControlInputRef,
                    setTempDesignData,
                    tempDesignData,
                    'description',
                    e.target.value
                  )}
                  className={themes[theme].input}
                  ref={designControlInputRef}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Notes</label>
                <textarea
                  value={tempDesignData.notes || ''}
                  onChange={e => setTempDesignData({ ...tempDesignData, notes: e.target.value })}
                  className={themes[theme].input}
                  disabled={isLoading}
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Documents</label>
                <input
                  type="text"
                  value={tempDesignData.documents?.join(', ') || ''}
                  onChange={e => handleInputChange(
                    designControlInputRef,
                    setTempDesignData,
                    tempDesignData,
                    'documents',
                    e.target.value.split(',').map(d => d.trim()).filter(d => d)
                  )}
                  className={themes[theme].input}
                  ref={designControlInputRef}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsModalOpen(false);
                setEditingItem(null);
                setTempTaskData({});
                setTempDesignData({});
                setErrorMessage(null);
              }}
              className={themes[theme].button}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleModalSubmit}
              className={isLoading ? themes[theme].actionButtons.inactive : themes[theme].button}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProjectModal = () => {
    if (!isProjectModalOpen) return null;

    return (
      <div className={`fixed inset-0 ${themes[theme].modalBackdrop} flex items-center justify-center z-50`}>
        <div className={`${themes[theme].modal} p-6 rounded-lg shadow-lg w-full max-w-md`}>
          <h2 className="text-xl font-bold mb-4">Create New Project</h2>
          {errorMessage && (
            <div className={`${themes[theme].error} mb-4`}>
              {errorMessage}
            </div>
          )}
          <div className="mb-4">
            <label className="block mb-1">Project Name</label>
            <input
              type="text"
              value={newProjectName}
              onChange={e => handleInputChange(
                projectNameInputRef,
                setNewProjectName,
                {},
                '',
                e.target.value
              )}
              className={themes[theme].input}
              ref={projectNameInputRef}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsProjectModalOpen(false);
                setNewProjectName('');
                setErrorMessage(null);
              }}
              className={themes[theme].button}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={createProject}
              className={isLoading ? themes[theme].actionButtons.inactive : themes[theme].button}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTooltip = () => {
    if (!tooltip.visible) return null;
    return (
      <div
        className={`absolute p-2 rounded-lg shadow-lg ${themes[theme].tooltip}`}
        style={{ top: tooltip.y, left: tooltip.x }}
      >
        {tooltip.content}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {notification && (
        <div className={`${themes[theme].loading} fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50`}>
          {notification}
        </div>
      )}
      {!user ? (
        renderLogin()
      ) : (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">
              {currentPage === 'taskManager' ? 'Task Manager' : 'MDR Design Control'}
            </h1>
            <div className="flex items-center space-x-2">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={themes[theme].button}
                >
                  {user.username} ▼
                </button>
                {isDropdownOpen && (
                  <div className={`absolute right-0 mt-2 w-48 ${themes[theme].container} rounded-lg shadow-lg z-10`}>
                    <button
                      onClick={() => {
                        setCurrentPage('taskManager');
                        setIsDropdownOpen(false);
                        fetchTasks(localStorage.getItem('token'));
                        fetchUsers(localStorage.getItem('token'));
                      }}
                      className={`block w-full text-left px-4 py-2 ${themes[theme].tableRow}`}
                    >
                      Task Manager
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPage('mdrDesignControl');
                        setIsDropdownOpen(false);
                        fetchProjects(localStorage.getItem('token'));
                      }}
                      className={`block w-full text-left px-4 py-2 ${themes[theme].tableRow}`}
                    >
                      MDR Design Control
                    </button>
                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={`block w-full text-left px-4 py-2 ${themes[theme].tableRow}`}
                    >
                      Toggle {theme === 'dark' ? 'Light' : 'Dark'} Theme
                    </button>
                    <button
                      onClick={handleLogout}
                      className={`block w-full text-left px-4 py-2 ${themes[theme].tableRow}`}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {currentPage === 'taskManager' ? (
            <div>
              <div className="flex mb-4">
                <button
                  onClick={() => setCurrentTab('inbox')}
                  className={`px-4 py-2 ${currentTab === 'inbox' ? themes[theme].button : themes[theme].tableRow}`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => setCurrentTab('delegated')}
                  className={`px-4 py-2 ${currentTab === 'delegated' ? themes[theme].button : themes[theme].tableRow}`}
                >
                  Delegated
                </button>
                <button
                  onClick={() => setCurrentTab('completed')}
                  className={`px-4 py-2 ${currentTab === 'completed' ? themes[theme].button : themes[theme].tableRow}`}
                >
                  Completed
                </button>
              </div>
              {renderTabContent()}
            </div>
          ) : (
            renderMDRDesignControl()
          )}
          {renderModal()}
          {renderProjectModal()}
          {renderTooltip()}
        </div>
      )}
    </div>
  );
};

// Mount the component
ReactDOM.render(<GTDApp />, document.getElementById('root'));