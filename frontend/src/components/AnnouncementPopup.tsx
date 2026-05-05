import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
}

interface Props {
  announcement: Announcement | null;
  onDismiss: () => void;
}

export function AnnouncementPopup({ announcement, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white rounded-3xl shadow-2xl border-2 border-green-100 max-w-md w-full p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center rotate-3 shadow-md">
                <Sparkles size={20} className="text-yellow-900" />
              </div>
              <h2 className="text-2xl font-black text-green-900">{announcement.title}</h2>
            </div>
            <p className="text-gray-700 font-medium mb-8 leading-relaxed">{announcement.message}</p>
            <button
              onClick={onDismiss}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-lg shadow-lg transition-all hover:scale-[1.02]"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
