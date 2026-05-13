import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signIn, signInWithGoogle, signOut, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { collection, addDoc, setDoc, doc, getDoc, getDocs, query, orderBy, limit, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { LogIn, LogOut, Play, Sparkles, Trophy, History, RefreshCw, Info, ShieldCheck } from 'lucide-react';
import { generateDinoPayload, compressImage, DinoGenerationResult } from './services/geminiService';
import { RunnerGame } from './components/RunnerGame';
import { DinoCard } from './components/DinoCard';
import { AnnouncementPopup } from './components/AnnouncementPopup';
import { generateFunnyName } from './utils/nameGenerator';

type AppState = 'AUTH' | 'QUESTIONS' | 'GENERATING' | 'CARD_PREVIEW' | 'GAME' | 'RESULTS' | 'HISTORY' | 'COLLECTION' | 'LEADERBOARD' | 'ADMIN';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appState, setAppState] = useState<AppState>('AUTH');
  const [loading, setLoading] = useState(true);
  const isAdminPath = window.location.pathname === '/admin';

  // Creation state
  const [habitat, setHabitat] = useState('');
  const [diet, setDiet] = useState('');
  const [preferences, setPreferences] = useState('');
  const [generatedDino, setGeneratedDino] = useState<DinoGenerationResult & { imageUrl: string } | null>(null);

  // Game state
  const [lastScore, setLastScore] = useState({ score: 0, coins: 0, won: false });
  const [history, setHistory] = useState<any[]>([]);
  const [myDinos, setMyDinos] = useState<any[]>([]);
  const [isReuse, setIsReuse] = useState(false);

  // Announcement state
  const [announcement, setAnnouncement] = useState<{ id: string; title: string; message: string } | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardError, setLeaderboardError] = useState('');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardStatus, setLeaderboardStatus] = useState({ enabled: false, isAdmin: false });


  // Play result sound effect when arriving at the Results screen
  useEffect(() => {
    if (appState === 'RESULTS') {
      const audio = new Audio(lastScore.won ? 'win.wav' : 'lose.wav');
      audio.volume = 0.5;
      audio.play().catch(() => { });
    }
  }, [appState, lastScore.won]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        if (isAdminPath) {
          setAppState('ADMIN');
        } else {
          setAppState('QUESTIONS');
        }
        await syncUser(u);
        fetchHistory(u.uid);
        fetchDinos(u.uid);
        fetchAnnouncement(u.uid);
      } else {
        if (isAdminPath) {
          setAppState('ADMIN');
        } else {
          setAppState('AUTH');
        }
        setLeaderboardStatus({ enabled: false, isAdmin: false });
      }
    });

    return unsubscribe;
  }, [isAdminPath]);

  useEffect(() => {
    if (user) {
      user.getIdToken().then(token => {
        fetch('/api/leaderboard/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setLeaderboardStatus(data))
        .catch(console.error);
      });
    }
  }, [user]);


  const syncUser = async (u: User) => {
    const userRef = doc(db, 'users', u.uid);
    try {
      const snap = await getDoc(userRef);
      let displayName = u.displayName;

      if (!displayName) {
        displayName = generateFunnyName();
        try {
          await updateProfile(u, { displayName });
        } catch (e) {
          console.error("Failed to update profile name:", e);
        }
      }

      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: u.uid,
          email: u.email,
          displayName: displayName,
          highScore: 0,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
    }
  };

  const fetchAnnouncement = async (uid: string) => {
    try {
      const [announcementsSnap, seenSnap] = await Promise.all([
        getDocs(query(collection(db, 'announcements'), where('active', '==', true))),
        getDocs(collection(db, `users/${uid}/seenAnnouncements`)),
      ]);
      const seenIds = new Set(seenSnap.docs.map(d => d.id));
      const unseen = announcementsSnap.docs.find(d => !seenIds.has(d.id));
      if (unseen) {
        const data = unseen.data();
        setAnnouncement({ id: unseen.id, title: data.title, message: data.message });
      }
    } catch (error) {
      console.error('[announcement] fetch failed:', error);
    }
  };

  const dismissAnnouncement = async () => {
    if (!announcement || !user) return;
    const path = `users/${user.uid}/seenAnnouncements`;
    try {
      await setDoc(doc(db, path, announcement.id), { seenAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${announcement.id}`);
    }
    setAnnouncement(null);
  };

  const fetchHistory = (uid: string) => {
    const path = `users/${uid}/games`;
    const q = query(collection(db, path), orderBy('playedAt', 'desc'), limit(10));
    onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  };

  const fetchDinos = (uid: string) => {
    const path = `users/${uid}/dinosaurs`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snap) => {
      setMyDinos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  };

  const fetchLeaderboard = async () => {
    setAppState('LEADERBOARD');
    setLoadingLeaderboard(true);
    setLeaderboardError('');
    try {
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const response = await fetch('/api/leaderboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 403) {
        setLeaderboardError('Leaderboard is currently disabled.');
        setLoadingLeaderboard(false);
        return;
      }
      if (response.status === 502) {
        setLeaderboardError('502 Bad Gateway: The server crashed! (OOM: Container Memory Limit Exceeded)');
        setLoadingLeaderboard(false);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (e: any) {
      setLeaderboardError(`Error loading leaderboard: ${e.message}`);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleGameStart = () => {
    if (!generatedDino) return;
    fetch("/api/log/game_start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user?.uid || null,
        dino_type: generatedDino.type,
        dino_name: generatedDino.name,
        is_reuse: isReuse,
      })
    }).catch(err => console.error("Telemetry err:", err));
    setAppState('GAME');
  };

  const handleGenerate = async () => {
    setIsReuse(false);
    setAppState('GENERATING');
    try {
      const { details, rawImageUrl } = await generateDinoPayload(habitat, diet, preferences);
      const imageUrl = await compressImage(rawImageUrl);

      const dinoData = { ...details, imageUrl, userId: user?.uid, createdAt: new Date().toISOString() };
      setGeneratedDino(dinoData);

      // Save dino to firestore
      if (user) {
        const path = `users/${user.uid}/dinosaurs`;
        try {
          await addDoc(collection(db, path), dinoData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
      }

      setAppState('CARD_PREVIEW');
    } catch (error) {
      console.error("Generation failed", error);
      alert(`Oops! The dinosaur escaped. Try again!`);
      console.error("Generation failed", String(error));
      setAppState('QUESTIONS');
    }
  };

  const handleGameEnd = async (score: number, coins: number, won: boolean = false, speed: number = 0) => {
    setLastScore({ score, coins, won });
    setAppState('RESULTS');

    // Send telemetry to backend for analytics
    if (generatedDino) {
      fetch("/api/log/game_end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid || null,
          dino_type: generatedDino.type,
          dino_name: generatedDino.name,
          score,
          coins,
          won,
          speed
        })
      }).catch(err => console.error("Telemetry err:", err));
    }

    if (user) {
      const path = `users/${user.uid}/games`;
      try {
        // Save game session to targeted user history
        await addDoc(collection(db, path), {
          userId: user.uid,
          score,
          coinsCollected: coins,
          playedAt: serverTimestamp(),
        });

        // Add to the global leaderboard so the Day-2 scenario is populated with some real organic data first
        await addDoc(collection(db, 'scores'), {
          userId: user.displayName || user.email || user.uid,
          score,
          coins,
          dino_type: generatedDino?.type || 'Unknown',
          dino_name: generatedDino?.name || 'Unknown',
          playedAt: serverTimestamp(),
        });

        // Update high score
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && (snap.data().highScore || 0) < score) {
          await setDoc(userRef, { highScore: score }, { merge: true });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center">
      <div className="animate-bounce text-green-600 font-black text-4xl">DinoQuest...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fdfcf0] text-gray-900 font-sans selection:bg-yellow-200">
      {/* Header */}
      <header className="p-4 flex justify-between items-center max-w-6xl mx-auto">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg rotate-3">
            <Sparkles size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-green-800 uppercase italic">DinoQuest</h1>
        </a>
        {user && (
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setAppState('COLLECTION')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-green-600"
              title="My Dinosaurs"
            >
              <Sparkles size={20} />
            </button>
            <button
              onClick={() => setAppState('HISTORY')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-blue-600"
              title="History"
            >
              <History size={20} />
            </button>
            { (leaderboardStatus.enabled || leaderboardStatus.isAdmin) && (
              <button
                onClick={fetchLeaderboard}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-yellow-600"
                title="Global Leaderboard"
              >
                <Trophy size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
              <span className="text-xs font-bold hidden sm:block">{user.displayName}</span>
              <button onClick={signOut} className="text-red-500 hover:text-red-700">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {appState === 'ADMIN' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-3xl shadow-xl border-2 border-red-100 text-center max-w-lg mx-auto"
            >
              <div className="w-20 h-20 bg-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-6 rotate-3">
                <ShieldCheck size={40} />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-4">Admin Dashboard</h2>
              <p className="text-gray-600 mb-8 font-medium">
                Log in with an authorized Google account to view internal tools and global leaderboard.
              </p>
              
              {!user || user.isAnonymous ? (
                <button
                  onClick={signInWithGoogle}
                  className="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-xl transition-all flex items-center gap-3 mx-auto group"
                >
                  <LogIn className="group-hover:translate-x-1 transition-transform" />
                  Admin Login (Google)
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4 text-left">
                    <img src={user.photoURL || ''} alt="" className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                    <div>
                      <div className="font-black text-gray-900">{user.displayName}</div>
                      <div className="text-sm text-gray-500 font-bold">{user.email}</div>
                    </div>
                  </div>
                  
                  {leaderboardStatus.isAdmin ? (
                    <button
                      onClick={fetchLeaderboard}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white p-4 rounded-2xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-3"
                    >
                      <Trophy /> View Leaderboard
                    </button>
                  ) : (
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200 text-orange-700 font-bold text-sm">
                      Access Denied: This account is not in the authorized admin list.
                    </div>
                  )}
                  
                  <button
                    onClick={signOut}
                    className="w-full border-2 border-gray-100 hover:bg-gray-50 text-gray-500 p-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3"
                  >
                    <LogOut size={20} /> Sign Out
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {appState === 'AUTH' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-10 sm:py-20"
            >
              <h2 className="text-4xl sm:text-6xl font-black text-green-900 mb-6 leading-none">
                CREATE YOUR OWN<br />DINOSAUR HERO!
              </h2>
              <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-lg mx-auto px-4">
                Build a super cool dinosaur and race through the jungle! See how long you can survive and collect the most treats!
              </p>
              <button
                onClick={signIn}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 mx-auto group"
              >
                <LogIn className="group-hover:rotate-12 transition-transform" />
                Start Your Adventure
              </button>
            </motion.div>
          )}

          {appState === 'QUESTIONS' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-5 sm:p-8 rounded-3xl shadow-xl border-2 border-green-100"
            >
              <h2 className="text-2xl sm:text-3xl font-black text-green-800 mb-8 flex items-center gap-3">
                <Info className="text-blue-500" /> Let's Build Your Dino!
              </h2>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-black uppercase text-gray-500 mb-3 tracking-widest">Where does it live?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['Forest', 'Desert', 'Swamp', 'Ocean Edge'].map(h => (
                      <button
                        key={h}
                        onClick={() => setHabitat(h)}
                        className={`p-4 rounded-2xl font-bold border-2 transition-all ${habitat === h ? 'bg-green-500 border-green-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 hover:border-green-200'}`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black uppercase text-gray-500 mb-3 tracking-widest">What does it eat?</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Herbivore (Plants)', 'Carnivore (Meat)'].map(d => (
                      <button
                        key={d}
                        onClick={() => setDiet(d)}
                        className={`p-4 rounded-2xl font-bold border-2 transition-all ${diet === d ? 'bg-orange-500 border-orange-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 hover:border-orange-200'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black uppercase text-gray-500 mb-3 tracking-widest">Any special colors or styles?</label>
                  <input
                    type="text"
                    placeholder="e.g. Blue with yellow spots, very fluffy..."
                    className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-green-400 outline-none font-medium"
                    value={preferences}
                    onChange={(e) => setPreferences(e.target.value)}
                  />
                </div>

                <button
                  disabled={!habitat || !diet}
                  onClick={handleGenerate}
                  className="w-full bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 text-white p-5 rounded-2xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-3"
                >
                  <Sparkles /> Generate My Dinosaur
                </button>
              </div>
            </motion.div>
          )}

          {appState === 'GENERATING' && (
            <motion.div
              key="generating"
              className="text-center py-20"
            >
              <div className="w-24 h-24 border-8 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-8" />
              <h2 className="text-3xl font-black text-green-900 mb-4 animate-pulse">Hatching your dinosaur...</h2>
              <p className="text-gray-500 font-medium">Gemini AI is painting your prehistoric friend!</p>
            </motion.div>
          )}

          {appState === 'CARD_PREVIEW' && generatedDino && (
            <motion.div
              key="preview"
              className="flex flex-col items-center gap-8"
            >
              <h2 className="text-4xl font-black text-green-900 text-center">MEET YOUR HERO!</h2>
              <DinoCard dino={generatedDino} />
              <div className="max-w-md text-center">
                <p className="text-gray-600 italic mb-6">"{generatedDino.description}"</p>
                <button
                  onClick={handleGameStart}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black px-10 py-5 rounded-2xl font-black text-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-3 mx-auto"
                >
                  <Play fill="black" /> ENTER THE JUNGLE
                </button>
              </div>
            </motion.div>
          )}

          {appState === 'GAME' && generatedDino && (
            <motion.div key="game">
              <RunnerGame
                dinoType={generatedDino.type}
                dinoImage={generatedDino.imageUrl}
                dinoDiet={generatedDino.diet}
                onGameEnd={handleGameEnd}
              />
            </motion.div>
          )}

          {appState === 'RESULTS' && (
            <motion.div
              key="results"
              className="text-center py-6 sm:py-10"
            >
              <div className={`inline-block p-6 sm:p-8 rounded-full mb-6 sm:mb-8 shadow-2xl rotate-3 ${lastScore.won ? 'bg-yellow-400' : 'bg-red-400'}`}>
                <Trophy size={48} className={`${lastScore.won ? 'text-yellow-900' : 'text-red-900'} sm:w-16 sm:h-16`} />
              </div>
              <h2 className={`text-4xl sm:text-5xl font-black mb-2 ${lastScore.won ? 'text-green-900' : 'text-red-900'}`}>
                {lastScore.won ? 'YOU SURVIVED!' : 'GAME OVER'}
              </h2>
              <p className="text-gray-500 font-bold mb-6">
                {lastScore.won ? 'You successfully raced through the habitat!' : 'The dinosaur bumped into an obstacle or fell in a bottomless pit!'}
              </p>
              <div className="flex justify-center gap-4 sm:gap-8 mb-10">
                <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-lg border-2 border-green-100 flex-1 max-w-[140px]">
                  <span className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">Score</span>
                  <span className="text-2xl sm:text-4xl font-black text-green-600">{lastScore.score}</span>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-lg border-2 border-yellow-100 flex-1 max-w-[140px]">
                  <span className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">Treats</span>
                  <span className="text-2xl sm:text-4xl font-black text-yellow-600">{lastScore.coins}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setAppState('QUESTIONS')}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 justify-center"
                >
                  <RefreshCw size={20} /> Create New Dino
                </button>
                <button
                  onClick={() => { setIsReuse(true); setAppState('CARD_PREVIEW'); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 justify-center"
                >
                  <Sparkles size={20} /> Play Again
                </button>
              </div>
            </motion.div>
          )}

          {appState === 'HISTORY' && (
            <motion.div
              key="history"
              className="bg-white p-5 sm:p-8 rounded-3xl shadow-xl border-2 border-blue-100"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-blue-800 flex items-center gap-3">
                  <History /> Adventure Log
                </h2>
                <button
                  onClick={() => setAppState('QUESTIONS')}
                  className="text-sm font-bold text-gray-500 hover:text-gray-800"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                {history.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 font-bold">No adventures yet! Go hatch a dino!</p>
                ) : (
                  history.map((game, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div>
                        <span className="block text-[10px] font-black text-gray-400 uppercase">Date</span>
                        <span className="font-bold text-sm">{game.playedAt?.toDate().toLocaleDateString()}</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-[10px] font-black text-gray-400 uppercase">Score</span>
                        <span className="font-black text-green-600 text-lg">{game.score}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-black text-gray-400 uppercase">Treats</span>
                        <span className="font-black text-yellow-600 text-lg">{game.coinsCollected}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {appState === 'LEADERBOARD' && (
            <motion.div
              key="leaderboard"
              className="bg-white p-5 sm:p-8 rounded-3xl shadow-xl border-2 border-yellow-100"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-yellow-600 flex items-center gap-3">
                  <Trophy /> Global Leaderboard
                </h2>
                <button
                  onClick={() => setAppState('QUESTIONS')}
                  className="text-sm font-bold text-gray-500 hover:text-gray-800"
                >
                  Close
                </button>
              </div>

              {loadingLeaderboard ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-500 font-bold">Loading massive amounts of data...</p>
                </div>
              ) : leaderboardError ? (
                <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 text-center">
                  <div className="text-red-500 font-black text-2xl mb-2">SYSTEM CRASH DETECTED!</div>
                  <p className="text-red-700 font-bold mb-4">{leaderboardError}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboard.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 font-bold">No scores on the leaderboard yet!</p>
                  ) : (
                    leaderboard.slice(0, 50).map((scoreEntry, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-4">
                          <span className="font-black text-yellow-500 w-8 text-center text-xl">#{i + 1}</span>
                          <div>
                            <span className="block font-bold text-gray-800">{scoreEntry.dino_name || 'Unknown Dino'}</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase">{scoreEntry.dino_type || 'Unknown'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-green-600 text-xl">{scoreEntry.score}</span>
                          <span className="block text-[10px] font-black text-gray-400 uppercase">Score</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}

          {appState === 'COLLECTION' && (
            <motion.div
              key="collection"
              className="bg-white p-5 sm:p-8 rounded-3xl shadow-xl border-2 border-green-100"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-green-800 flex items-center gap-3">
                  <Sparkles className="text-yellow-500" /> My Dinosaurs
                </h2>
                <button
                  onClick={() => setAppState('QUESTIONS')}
                  className="text-sm font-bold text-gray-500 hover:text-gray-800"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {myDinos.length === 0 ? (
                  <p className="col-span-full text-center py-10 text-gray-400 font-bold">No dinosaurs yet! Go to the hatchery!</p>
                ) : (
                  myDinos.map((dino, i) => (
                    <div
                      key={i}
                      className="bg-gray-50 p-4 rounded-3xl border-2 border-gray-100 hover:border-green-300 transition-all cursor-pointer group"
                      onClick={() => {
                        setIsReuse(true);
                        setGeneratedDino(dino);
                        setAppState('CARD_PREVIEW');
                      }}
                    >
                      <div className="flex gap-4 items-center">
                        <div className="w-20 h-20 bg-white rounded-2xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                          <img src={dino.imageUrl} alt="" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-green-800 truncate">{dino.name}</h3>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{dino.type}</p>
                          <div className="flex gap-2 mt-2">
                            <div className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full">SPD {dino.stats.speed}</div>
                            <div className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full">HP {dino.stats.health}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="py-10 text-center text-gray-400 text-sm font-medium">
      </footer>

      <AnnouncementPopup announcement={announcement} onDismiss={dismissAnnouncement} />
    </div>
  );
}
