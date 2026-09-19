import express, { type Request, type Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;
const errorHandler = require('./middleware/errorHandler');

app.use(cors());
app.use(express.json());
app.use(errorHandler);

/*
interface User {
  id: number;
  name: string;
  email: string;
}

let users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];

let nextId = 3;

// Get all users
app.get('/api/users', async (req: Request, res: Response): Promise<User[]> => {
  return res.json(users);
});

// Get single user
app.get('/api/users/:id', (req: Request, res: Response): Response => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  return res.json(user);
});

// Create user
app.post('/api/users', async (req: Request, res: Response): Promise<Response> => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const newUser: User = {
    id: nextId++,
    name,
    email
  };
  
  users.push(newUser);
  return res.status(201).json(newUser);
});

// Update user
app.put('/api/users/:id', (req: Request, res: Response): Response => {
  const { name, email } = req.body;
  const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));
  
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  
  users[userIndex] = { ...users[userIndex], name, email };
  return res.json(users[userIndex]);
});

// Delete user
app.delete('/api/users/:id', (req: Request, res: Response): Response => {
  const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));
  
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  
  const deletedUser = users.splice(userIndex, 1)[0];
  return res.json(deletedUser);
});
*/

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
