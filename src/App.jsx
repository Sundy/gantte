import { useState, useEffect, useMemo, useRef } from 'react'

const DEFAULT_TASKS = [
  { id: 1, title: '学习智推时代的系统、运营和商业模式', start: 0, duration: 2, color: '#FFE0B2', parentId: null, collapsed: false },
  { id: 2, title: '出Demo和张总确认', start: 2, duration: 2, color: '#FFF3E0', parentId: null, collapsed: false },
  { id: 3, title: '培训及寻找种子客户验证', start: 4, duration: 2, color: '#FFCC80', parentId: null, collapsed: false },
  { id: 4, title: '产品开发及上线', start: 6, duration: 2, color: '#FFB74D', parentId: null, collapsed: false },
  { id: 5, title: '复盘复制', start: 8, duration: 2, color: '#FF9800', parentId: null, collapsed: false },
  { id: 6, title: '核心团队组建', start: 10, duration: 2, color: '#FFA726', parentId: null, collapsed: false }
]

const STORAGE_KEY = 'geo_gantt_data_v2'

function App() {
  // --- State ---
  const [tasks, setTasks] = useState(DEFAULT_TASKS)
  const [projectStartDate, setProjectStartDate] = useState('2025-12-08')
  const [projectDurationWeeks, setProjectDurationWeeks] = useState(12)

  // Initialize state from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setTasks(parsed)
        } else {
          if (parsed.tasks) setTasks(parsed.tasks)
          if (parsed.projectStartDate) setProjectStartDate(parsed.projectStartDate)
          if (parsed.projectDurationWeeks) setProjectDurationWeeks(parsed.projectDurationWeeks)
        }
      }
    } catch (e) {
      console.error("Failed to parse local storage", e)
    }
  }, [])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const fileInputRef = useRef(null)

  // Default form state
  const [formData, setFormData] = useState({
    title: '',
    start: 0,
    duration: 1,
    color: '#FFCC80',
    parentId: '' // empty string for root
  })
  
  const isFirstRender = useRef(true)

  // Load from file on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/tasks', { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          if (data.length > 0) setTasks(data)
        } else if (data) {
          if (data.tasks) setTasks(data.tasks)
          if (data.projectStartDate) setProjectStartDate(data.projectStartDate)
          if (data.projectDurationWeeks) setProjectDurationWeeks(data.projectDurationWeeks)
        }
      })
      .catch(err => console.error('Failed to load tasks from file:', err))
  }, [])

  // Auto-persistence
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // Save full state to local storage
    const payload = {
      tasks,
      projectStartDate,
      projectDurationWeeks
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    
    fetch('http://localhost:3001/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.error('Auto-save failed:', err))
  }, [tasks, projectStartDate, projectDurationWeeks])

  // --- Dynamic Weeks Calculation ---
  const totalWeeks = useMemo(() => {
    if (tasks.length === 0) return 4
    const maxEnd = Math.max(...tasks.map(t => t.start + t.duration))
    // Minimum 4, add a buffer of 0.5 week
    return Math.max(4, Math.ceil(maxEnd + 0.5))
  }, [tasks])

  // --- Helpers ---
  const formatDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const formatMonthDay = (d) => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${m}/${day}`
  }

  const addDays = (date, days) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    d.setDate(d.getDate() + Math.round(days))
    return d
  }

  const addWeeks = (date, weeks) => addDays(date, weeks * 7)

  const projectEndDate = useMemo(() => {
    if (!projectStartDate || projectDurationWeeks <= 0) return ''
    const start = new Date(projectStartDate)
    const end = addWeeks(start, projectDurationWeeks)
    return formatDate(end)
  }, [projectStartDate, projectDurationWeeks])
  const getBarStyle = (start, duration, color) => {
    const startPercent = (start / totalWeeks) * 100
    const widthPercent = (duration / totalWeeks) * 100
    return {
      left: `${startPercent}%`,
      width: `${widthPercent}%`,
      backgroundColor: color
    }
  }

  // --- CRUD Operations ---
  const handleAddTask = () => {
    setEditingTask(null)
    setFormData({ title: 'New Task', start: 0, duration: 1, color: '#FFCC80', parentId: '' })
    setIsModalOpen(true)
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setFormData({ ...task, parentId: task.parentId || '' })
    setIsModalOpen(true)
  }

  const handleSave = () => {
    const payload = {
      ...formData,
      parentId: formData.parentId === '' ? null : Number(formData.parentId)
    }

    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...payload } : t))
    } else {
      const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1
      setTasks([...tasks, { ...payload, id: newId, collapsed: false }])
    }
    setIsModalOpen(false)
  }

  const handleDeleteTask = () => {
    if (!editingTask) return
    // Logic: Delete task and all its recursive children
    const idsToDelete = [editingTask.id]
    // Find all children
    const findChildren = (pid) => tasks.filter(t => t.parentId === pid).forEach(c => {
      idsToDelete.push(c.id)
      findChildren(c.id) // recurse
    })
    findChildren(editingTask.id)

    setTasks(tasks.filter(t => !idsToDelete.includes(t.id)))
    setIsModalOpen(false)
  }

  const toggleCollapse = (taskId) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, collapsed: !t.collapsed } : t))
  }

  // --- File I/O ---
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", "geo_project_plan.json")
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  // --- Rendering Tree Logic ---
  // Flatten the tree for rendering
  const renderRows = () => {
    const rootTasks = tasks.filter(t => !t.parentId)
    // Optional: Sort by start time
    // rootTasks.sort((a, b) => a.start - b.start) 

    // Recursive render helper
    const buildList = (list, prefix = '') => {
      let result = []
      list.forEach((task, index) => {
        const currentNumber = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
        // Attach the calculated number to the task object for rendering
        const taskWithNumber = { ...task, _number: currentNumber }
        
        result.push(taskWithNumber)
        if (!task.collapsed) {
          const children = tasks.filter(t => t.parentId === task.id)
          // children.sort((a,b) => a.start - b.start)
          if (children.length > 0) {
            result = [...result, ...buildList(children, currentNumber)]
          }
        }
      })
      return result
    }

    return buildList(rootTasks)
  }

  const visibleTasks = renderRows()

  // Dynamic grid columns style
  const WEEK_MIN_WIDTH = 86
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `300px repeat(${totalWeeks}, ${WEEK_MIN_WIDTH}px)`,
    // Ensure min-width for usability if weeks get too many
    minWidth: `${300 + totalWeeks * WEEK_MIN_WIDTH}px` 
  }

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="header-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17 2H20C21.6569 2 23 3.34315 23 5C23 6.65685 21.6569 8 20 8V16C21.6569 16 23 17.3431 23 19C23 20.6569 21.6569 22 20 22H17C15.3431 22 14 20.6569 14 19V5C14 3.34315 15.3431 2 17 2Z" /><path d="M7 2H4C2.34315 2 1 3.34315 1 5C1 6.65685 2.34315 8 4 8V16C2.34315 16 1 17.3431 1 19C1 20.6569 2.34315 22 4 22H7C8.65685 22 10 20.6569 10 19V5C10 3.34315 8.65685 2 7 2Z" /></svg>
          </div>
          <h1 className="header-title">GEO项目计划</h1>
        </div>
        <div className="header-curve"></div>
      </header>

      <main className="gantt-container">
        <div className="toolbar">
          <div className="toolbar-left" style={{ marginRight: 'auto', display: 'flex', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#555' }}>开始日期</span>
              <input type="date" value={projectStartDate} onChange={e => setProjectStartDate(e.target.value)} />
              <span style={{ color: '#555' }}>持续周数</span>
              <input type="number" min={1} step={1} value={projectDurationWeeks} onChange={e => setProjectDurationWeeks(parseInt(e.target.value || '0'))} style={{ width: '80px' }} />
              <span style={{ color: '#555' }}>结束日期：{projectEndDate || '-'}</span>
            </div>
          </div>
          <button className="btn-add" onClick={handleAddTask}>+ 添加新任务</button>
        </div>

        <div className="gantt-scroll-wrapper" style={{ overflowX: 'auto', paddingBottom: '20px' }}>
          <div className="gantt-grid" style={{ ...gridStyle, alignItems: 'center' }}>

            {/* --- Table Header --- */}
            {/* Cell 1: Task Title */}
            <div className="col-task-header">任务 ({tasks.length})</div>

            {/* Dynamic Week Headers */}
            <div className="header-weeks-container" style={{
              gridColumn: `2 / span ${totalWeeks}`,
              display: 'grid',
              gridTemplateColumns: `repeat(${totalWeeks}, 86px)`
            }}>
              {Array.from({ length: totalWeeks }).map((_, i) => (
                <div
                  key={i}
                  className={`col-week-header ${i < 4 ? `week-${i + 1}` : ''}`}
                  style={{
                    background: i >= 4 ? `rgba(255, 140, 0, ${0.4 + ((i - 4) % 3) * 0.1})` : undefined, // Fallback colors for extra weeks
                    borderRight: '1px solid #fff'
                  }}
                >
                  <div>第 {i + 1} 周</div>
                  {projectStartDate && <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>{formatMonthDay(addWeeks(new Date(projectStartDate), i))}</div>}
                </div>
              ))}
            </div>

            {/* --- Rows --- */}
            {visibleTasks.map(task => {
              const hasChildren = tasks.some(t => t.parentId === task.id)
              // Calculate depth levels (simple rendering approach: just indent)
              const getLevel = (id, lvl = 0) => {
                const t = tasks.find(x => x.id === id);
                if (!t || !t.parentId) return lvl;
                return getLevel(t.parentId, lvl + 1);
              }
              const level = getLevel(task.id);

              return (
                <div key={task.id} style={{ display: 'contents' }}>
                  {/* Column 1: Task Name */}
                  <div
                    className="task-name-cell"
                    style={{
                      paddingLeft: '10px',
                      paddingRight: '10px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      minHeight: '50px',
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #eee',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Expand Toggle */}
                    <span
                      onClick={() => toggleCollapse(task.id)}
                      style={{
                        width: '24px',
                        cursor: 'pointer',
                        visibility: hasChildren ? 'visible' : 'hidden',
                        marginRight: '5px',
                        fontWeight: 'bold',
                        color: '#666',
                        display: 'inline-flex', 
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      {task.collapsed ? '▶' : '▼'}
                    </span>

                    <div 
                      onClick={() => handleEditTask(task)}
                      className="task-label-container"
                      style={{
                        display: 'flex',
                        flex: 1,
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ 
                        marginRight: '8px', 
                        color: '#666', 
                        fontSize: '0.9em',
                        minWidth: '35px', // Ensure alignment for numbers
                        flexShrink: 0
                      }}>{task._number}</span>
                      <span 
                        className="task-label-text"
                        style={{
                          fontWeight: hasChildren ? 700 : 400,
                          color: level === 0 ? 'red' : (hasChildren ? '#E65100' : '#333'),
                          wordBreak: 'break-word',
                          lineHeight: '1.4'
                        }}
                      >
                        {task.title}
                      </span>
                    </div>
                  </div>

                  {/* Column 2: The Timeline Track (Spanning all weeks) */}
                  <div className="timeline-response-cell" style={{
                    gridColumn: `2 / span ${totalWeeks}`,
                    position: 'relative',
                    minHeight: '50px',
                    borderBottom: '1px solid #eee'
                  }}>
                    {/* Vertical Grid Lines (Background) */}
                    <div className="grid-lines-bg-dynamic" style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${totalWeeks}, 1fr)`,
                      pointerEvents: 'none'
                    }}>
                      {Array.from({ length: totalWeeks }).map((_, i) => (
                        <div key={i} style={{ borderRight: '1px dashed #eee', height: '100%' }}></div>
                      ))}
                    </div>

                    {/* The Bar */}
                    <div
                      className="task-bar"
                      style={{
                        ...getBarStyle(task.start, task.duration, task.color),
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                      onClick={() => handleEditTask(task)}
                      title={projectStartDate
                        ? `${formatDate(addDays(new Date(projectStartDate), task.start * 7))} - ${formatDate(addDays(new Date(projectStartDate), (task.start + task.duration) * 7))}`
                        : `Week ${task.start} - ${task.start + task.duration}`}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingTask ? '编辑任务' : '新任务'}</h2>

            <div className="form-group">
              <label>任务名称</label>
              <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>开始周 (当前总 {totalWeeks}周)</label>
                <input type="number" step="0.5" value={formData.start} onChange={e => setFormData({ ...formData, start: parseFloat(e.target.value) })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>持续周数</label>
                <input type="number" step="0.5" min="0.1" value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseFloat(e.target.value) })} />
              </div>
            </div>

            <div className="form-group">
              <label>所属父任务</label>
              <select value={formData.parentId} onChange={e => setFormData({ ...formData, parentId: e.target.value })}>
                <option value="">(无 - 根任务)</option>
                {tasks.filter(t => t.id !== editingTask?.id).map(t => (
                  <option key={t.id} value={t.id}>
                    #{t.id} - {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>颜色</label>
              <input type="color" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} style={{ width: '100%', height: '40px' }} />
            </div>

            <div className="modal-actions">
              {editingTask && <button className="btn-delete" onClick={handleDeleteTask}>删除任务</button>}
              <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>取消</button>
              <button className="btn-save" onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
