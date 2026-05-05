import fs from 'fs';
const code = fs.readFileSync('src/components/RunnerGame.tsx', 'utf-8');
console.log("File loaded. Contains trueMaxJumpHeight?", code.includes('trueMaxJumpHeight'));
