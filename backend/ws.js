const { io } = require('socket.io-client');
const socket = io('http://localhost:3000', {
  auth: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZmM1MmVjNi0yYTZlLTRhM2EtYjVkNS05ZGYzNDgyZDgwMTIiLCJ0ZW5hbnRJZCI6IjUzN2NhNjUxLTJkMDEtNDZiMS1hM2ExLTYzNWVhMzdmMzg4NCIsInJvbGUiOiJURU5BTlRfQURNSU4iLCJpYXQiOjE3ODAxMjIyNzgsImV4cCI6MTc4MDEyMzE3OH0.4qUj-9qTaaebjGQwRmkGBJmOLkeKsB1UsXSixeY32w4' },
  transports: ['websocket'],
});
socket.on('connect', () => console.log('✅ WebSocket Connected'));
socket.on('session:status', (d) => console.log('📡 Session Status:', JSON.stringify(d)));
socket.on('message:received', (d) => console.log('💬 New Message:', JSON.stringify(d)));
