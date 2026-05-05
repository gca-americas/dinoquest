import React from 'react';
import { motion } from 'motion/react';
import { Zap, Shield, ArrowUpCircle } from 'lucide-react';

interface DinoCardProps {
  dino: {
    name: string;
    habitat: string;
    diet: string;
    type: string;
    imageUrl: string;
    stats: {
      speed: number;
      health: number;
      jump: number;
    };
  };
}

export const DinoCard: React.FC<DinoCardProps> = ({ dino }) => {
  const typeColors: Record<string, string> = {
    Speedy: 'from-yellow-400 to-orange-500',
    Tank: 'from-red-600 to-red-800',
    Balanced: 'from-green-400 to-blue-500',
    Agile: 'from-purple-400 to-pink-500',
  };

  const habitatBackgrounds: Record<string, string> = {
    'Forest': '/imgs/cardbg/forrest.png',
    'Desert': '/imgs/cardbg/desert.png',
    'Swamp': '/imgs/cardbg/swamp.png',
    'Ocean Edge': '/imgs/cardbg/beach.png',
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`w-72 p-4 rounded-3xl bg-gradient-to-br ${typeColors[dino.type] || 'from-gray-400 to-gray-600'} shadow-2xl border-8 border-yellow-200 relative overflow-hidden`}
    >
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-white/10 pointer-events-none" />

      <div className="bg-white/90 rounded-2xl p-3 mb-3 shadow-inner">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-black text-xl text-gray-800 uppercase tracking-tighter">{dino.name}</h3>
          <span className="text-xs font-bold bg-gray-800 text-white px-2 py-0.5 rounded-full">{dino.type}</span>
        </div>
        <div
          className="aspect-square rounded-xl overflow-hidden bg-transparent border-2 border-gray-200 relative bg-cover bg-center"
          style={{ backgroundImage: `url(${habitatBackgrounds[dino.habitat] || habitatBackgrounds['Forest']})` }}
        >
          <img
            src={dino.imageUrl}
            alt={dino.name}
            className="w-full h-full object-contain relative z-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <div className="bg-black/20 rounded-xl p-3 text-white backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-2 text-xs font-bold mb-3">
          <div className="flex flex-col">
            <span className="opacity-70 uppercase">Habitat</span>
            <span>{dino.habitat}</span>
          </div>
          <div className="flex flex-col">
            <span className="opacity-70 uppercase">Diet</span>
            <span>{dino.diet}</span>
          </div>
        </div>

        <div className="space-y-2">
          <StatBar icon={<Zap size={14} />} label="Speed" value={dino.stats.speed} max={10} color="bg-yellow-400" />
          <StatBar icon={<Shield size={14} />} label="Health" value={dino.stats.health} max={10} color="bg-red-400" />
          <StatBar icon={<ArrowUpCircle size={14} />} label="Jump" value={dino.stats.jump} max={10} color="bg-blue-400" />
        </div>
      </div>
    </motion.div>
  );
};

const StatBar = ({ icon, label, value, max, color }: { icon: any, label: string, value: number, max: number, color: string }) => (
  <div className="flex items-center gap-2">
    <div className="w-4">{icon}</div>
    <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        className={`h-full ${color}`}
      />
    </div>
    <span className="text-[10px] w-4">{value}</span>
  </div>
);
