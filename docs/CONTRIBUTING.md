# Contributing to MotoGP Project

Welcome to the MotoGP project! This guide will help you understand how to set up your development environment and contribute to this project.

## Development Environment Setup

### Prerequisites

- Node.js and npm installed ([Install Node.js](https://nodejs.org/))
- Python 3.10 or higher installed ([Install Python](https://www.python.org/))
- Git for version control

### Installation Steps

1. Clone the repository:
   ```sh
   git clone <YOUR_GIT_URL>
   ```

2. Navigate to the project directory:
   ```sh
   cd MotoGP
   ```

3. Install frontend dependencies:
   ```sh
   npm install
   ```

4. Install backend dependencies:
   ```sh
   cd backend
   pip install -r requirements.txt
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build with type checking |
| `npm run lint` | Run ESLint for code quality checks |
| `npm run preview` | Preview production build locally |

## Testing

```sh
npm test                          # frontend helpers (Vitest)
cd backend && python -m pytest    # analytics, dataset builder, PDF parser, weather, predictions, API
```

New backend logic is written test-first: add a failing test in `backend/tests/`, then the code.

## Code Style and Quality

- TypeScript is used for type safety
- Tailwind CSS for styling
- ESLint with TypeScript support for code linting
- Prettier for code formatting

## Contributing Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Commit with clear, descriptive messages
5. Push to your fork
6. Submit a pull request

## Code Review Checklist

- [ ] All tests pass
- [ ] Code follows existing style conventions
- [ ] Documentation is updated for new features
- [ ] Changes are well-commented
- [ ] No unnecessary changes included

## Deployment

### Frontend Deployment

The frontend can be built for production:
```sh
npm run build
```

### Backend Deployment

The backend is designed to run in a Docker container. Build and run with:
```sh
cd backend
docker build -t motogp-backend .
docker run -p 8000:8000 motogp-backend
```