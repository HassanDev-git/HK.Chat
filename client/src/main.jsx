import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import './styles/App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
);
