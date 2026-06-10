const { io } = require('socket.io-client');
const socket = io('http://localhost:3000', {
  auth: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZmM1MmVjNi0yYTZlLTRhM2EtYjVkNS05ZGYzNDgyZDgwMTIiLCJ0ZW5hbnRJZCI6IjUzN2NhNjUxLTJkMDEtNDZiMS1hM2ExLTYzNWVhMzdmMzg4NCIsInJvbGUiOiJURU5BTlRfQURNSU4iLCJpYXQiOjE3ODAxMjI0NDQsImV4cCI6MTc4MDEyMzM0NH0.IgTpTApXq4R7wmm4ijDdhr2ORqZfm0lN1EHLIxE5Q3E' },
  transports: ['websocket'],
});
socket.on('connect', () => console.log('✅ WebSocket Connected'));
socket.on('session:status', (d) => console.log('📡 Session Status:', JSON.stringify(d)));
socket.on('message:received', (d) => console.log('💬 New Message:', JSON.stringify(d)));
