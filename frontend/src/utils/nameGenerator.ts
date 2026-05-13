const adjectives = [
  'Fluffy', 'Grumpy', 'Silly', 'Giggly', 'Zesty', 
  'Clumsy', 'Bouncy', 'Sleepy', 'Hungry', 'Funky',
  'Speedy', 'Tiny', 'Chubby', 'Spotty', 'Wiggly'
];

const dinosaurs = [
  'T-Rex', 'Raptor', 'Triceratops', 'Stego', 'Bronto',
  'Ptero', 'Dino', 'Ankylo', 'Spino', 'Iguanodon'
];

export function generateFunnyName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const dino = dinosaurs[Math.floor(Math.random() * dinosaurs.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${adj} ${dino} ${num}`;
}
