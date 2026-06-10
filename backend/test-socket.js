const { io } = require('socket.io-client');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZmM1MmVjNi0yYTZlLTRhM2EtYjVkNS05ZGYzNDgyZDgwMTIiLCJ0ZW5hbnRJZCI6IjUzN2NhNjUxLTJkMDEtNDZiMS1hM2ExLTYzNWVhMzdmMzg4NCIsInJvbGUiOiJURU5BTlRfQURNSU4iLCJpYXQiOjE3ODAwOTc5MTAsImV4cCI6MTc4MDA5ODgxMH0.FMFpSk7_le-v8_yCjtOBOU9VXCFWoLImC8Cc7PBhfWE';

const socket = io('http://localhost:3000', {
  auth: { token },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('connect_error', (err) => {
  console.log('Connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('message:received', (data) => {
  console.log('message:received event:', JSON.stringify(data));
});

socket.on('session:status', (data) => {
  console.log('session:status event:', JSON.stringify(data));
});
