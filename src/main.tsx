import React from 'react'
import ReactDOM from 'react-dom/client'
import 'virtual:uno.css'

import App from './App'

ReactDOM.createRoot(
  (() => {
    const app = document.createElement('div')
    app.id = 'root'
    document.body.append(app)
    return app
  })(),
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
