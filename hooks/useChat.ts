import { useEffect, useState } from 'react';
import { io } from "socket.io-client";

// Replace with your server's IP address (e.g., http://192.168.1.10:3000)
const SOCKET_URL = 'http://192.168.1.3:3000';

export default function ChatScreen() {
  const [socket, setSocket] = useState(null);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    // Initialize connection
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'], // Faster and more reliable for mobile
    });

    setSocket(newSocket);

    // Listen for incoming messages
    newSocket.on("receive_message", (data) => {
      setChatMessages((prev) => [...prev, data]);
    });

    return () => newSocket.disconnect();
  }, []);

  const sendMessage = () => {
    if (socket && message.trim()) {
      socket.emit("send_message", { text: message, time: new Date() });
      setMessage("");
    }
  };

  // ... Render your UI (FlatList for messages, TextInput for typing)
}
