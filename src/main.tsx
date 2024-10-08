import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'

import 'virtual:uno.css'

ReactDOM.createRoot(
  (() => {
    const app = document.createElement('div')
    app.id = 'starter-monkey-root'
    document.body.append(app)
    return app
  })(),
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
