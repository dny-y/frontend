import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// 关键：必须引入 Tailwind 的样式文件
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)