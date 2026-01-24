
import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Zap, 
  Search, 
  MessageSquare, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Code, 
  Briefcase, 
  User, 
  GraduationCap, 
  Globe, 
  ShoppingCart, 
  ArrowRight,
  ChevronDown,
  Sparkles,
  Trophy,
  Star
} from 'lucide-react';

// --- Types ---
type Profile = 'Créateur contenu' | 'Community manager' | 'Entrepreneur' | 'E-commerce' | 'Prof' | 'Dev';
type Level = 'Débutant' | 'Intermédiaire' | 'Avancé';
type Need = 'Texte/scripts' | 'Images/thumbnails' | 'Vidéos/Reels' | 'Audio/musique' | 'Code';

interface IA {
  name: string;
  description: string;
  categories: Need[];
  targetProfiles: Profile[];
  targetLevels: Level[];
  minPrice: number; // monthly in CHF approx
  url: string;
  highlight: string;
  rating: number; // Note sur 5
}

// --- Base de données (21 modèles IA avec Nano Banana Pro) ---
const AI_DATABASE: IA[] = [
  { name: 'Nano Banana Pro', description: 'Le nouveau standard pour la génération d\'images 4K et l\'édition créative avancée.', categories: ['Images/thumbnails'], targetProfiles: ['Créateur contenu', 'Community manager', 'E-commerce', 'Dev'], targetLevels: ['Intermédiaire', 'Avancé'], minPrice: 0, url: 'https://deepmind.google/technologies/gemini/', highlight: 'Images 4K Ultra', rating: 5 },
  { name: 'ChatGPT', description: 'Le couteau suisse de l\'IA, idéal pour tout type de texte et raisonnement.', categories: ['Texte/scripts', 'Code'], targetProfiles: ['Entrepreneur', 'Prof', 'Créateur contenu', 'Community manager'], targetLevels: ['Débutant', 'Intermédiaire', 'Avancé'], minPrice: 0, url: 'https://chat.openai.com', highlight: 'Polyvalence absolue', rating: 5 },
  { name: 'Claude 3.5 Sonnet', description: 'Une écriture plus humaine et des capacités de code exceptionnelles.', categories: ['Texte/scripts', 'Code'], targetProfiles: ['Dev', 'Entrepreneur', 'Prof'], targetLevels: ['Intermédiaire', 'Avancé'], minPrice: 0, url: 'https://claude.ai', highlight: 'Qualité d\'écriture', rating: 5 },
  { name: 'Midjourney', description: 'L\'IA de génération d\'images la plus artistique et puissante.', categories: ['Images/thumbnails'], targetProfiles: ['Créateur contenu', 'Community manager'], targetLevels: ['Intermédiaire', 'Avancé'], minPrice: 10, url: 'https://midjourney.com', highlight: 'Esthétique pro', rating: 5 },
  { name: 'Canva Magic Studio', description: 'Idéal pour les CM qui veulent créer des visuels rapidement sans être graphiste.', categories: ['Images/thumbnails', 'Vidéos/Reels'], targetProfiles: ['Community manager', 'Entrepreneur'], targetLevels: ['Débutant'], minPrice: 0, url: 'https://canva.com', highlight: 'Simplicité extrême', rating: 4 },
  { name: 'Jasper', description: 'Optimisé pour le marketing et le SEO de contenu long format.', categories: ['Texte/scripts'], targetProfiles: ['Entrepreneur', 'Créateur contenu'], targetLevels: ['Intermédiaire'], minPrice: 39, url: 'https://jasper.ai', highlight: 'Marketing ROI', rating: 4 },
  { name: 'ElevenLabs', description: 'La meilleure synthèse vocale pour des voix ultra-réalistes.', categories: ['Audio/musique'], targetProfiles: ['Créateur contenu', 'Community manager'], targetLevels: ['Débutant', 'Intermédiaire'], minPrice: 0, url: 'https://elevenlabs.io', highlight: 'Voix parfaites', rating: 5 },
  { name: 'Runway Gen-3', description: 'Génération de vidéos cinématiques à partir de texte ou d\'images.', categories: ['Vidéos/Reels'], targetProfiles: ['Créateur contenu'], targetLevels: ['Avancé'], minPrice: 12, url: 'https://runwayml.com', highlight: 'Cinéma IA', rating: 5 },
  { name: 'GitHub Copilot', description: 'L\'assistant indispensable pour coder 2x plus vite.', categories: ['Code'], targetProfiles: ['Dev'], targetLevels: ['Intermédiaire', 'Avancé'], minPrice: 10, url: 'https://github.com/features/copilot', highlight: 'Standard Dev', rating: 5 },
  { name: 'Perplexity', description: 'Un moteur de recherche boosté à l\'IA qui cite ses sources.', categories: ['Texte/scripts'], targetProfiles: ['Entrepreneur', 'Prof', 'Dev'], targetLevels: ['Débutant', 'Intermédiaire'], minPrice: 0, url: 'https://perplexity.ai', highlight: 'Recherche fiable', rating: 4 },
  { name: 'HeyGen', description: 'Créez des avatars vidéo qui parlent parfaitement à votre place.', categories: ['Vidéos/Reels'], targetProfiles: ['Entrepreneur', 'E-commerce'], targetLevels: ['Intermédiaire'], minPrice: 24, url: 'https://heygen.com', highlight: 'Vente & Formations', rating: 4 },
  { name: 'Notion AI', description: 'L\'IA directement intégrée dans vos notes et votre organisation.', categories: ['Texte/scripts'], targetProfiles: ['Prof', 'Entrepreneur', 'Dev'], targetLevels: ['Débutant'], minPrice: 10, url: 'https://notion.so', highlight: 'Productivité', rating: 4 },
  { name: 'Suno', description: 'Générez des chansons complètes avec paroles et musique en 10 secondes.', categories: ['Audio/musique'], targetProfiles: ['Créateur contenu'], targetLevels: ['Débutant'], minPrice: 0, url: 'https://suno.com', highlight: 'Magie musicale', rating: 5 },
  { name: 'Cursor', description: 'L\'éditeur de code qui comprend tout votre projet.', categories: ['Code'], targetProfiles: ['Dev'], targetLevels: ['Avancé'], minPrice: 0, url: 'https://cursor.com', highlight: 'Futur du Code', rating: 5 },
  { name: 'Copy.ai', description: 'Spécialisé dans les textes courts, ads et emails de vente.', categories: ['Texte/scripts'], targetProfiles: ['E-commerce', 'Entrepreneur'], targetLevels: ['Débutant'], minPrice: 0, url: 'https://copy.ai', highlight: 'Sales Copy', rating: 3 },
  { name: 'Leonardo.ai', description: 'Alternative à Midjourney avec plus de contrôle sur le style.', categories: ['Images/thumbnails'], targetProfiles: ['Créateur contenu', 'Dev'], targetLevels: ['Intermédiaire'], minPrice: 0, url: 'https://leonardo.ai', highlight: 'Liberté créative', rating: 4 },
  { name: 'Gamma', description: 'Créez des présentations et mini-sites web juste avec du texte.', categories: ['Texte/scripts', 'Images/thumbnails'], targetProfiles: ['Prof', 'Entrepreneur'], targetLevels: ['Débutant'], minPrice: 0, url: 'https://gamma.app', highlight: 'Prez express', rating: 4 },
  { name: 'Descript', description: 'L\'outil ultime pour éditer audio et vidéo comme un texte.', categories: ['Audio/musique', 'Vidéos/Reels'], targetProfiles: ['Créateur contenu', 'Community manager'], targetLevels: ['Intermédiaire'], minPrice: 0, url: 'https://descript.com', highlight: 'Montage facile', rating: 4 },
  { name: 'Luma Dream Machine', description: 'Génération vidéo haute fidélité avec mouvements physiques réalistes.', categories: ['Vidéos/Reels'], targetProfiles: ['Créateur contenu'], targetLevels: ['Intermédiaire'], minPrice: 0, url: 'https://lumalabs.ai', highlight: 'Vidéo réaliste', rating: 5 },
  { name: 'Poe', description: 'Accédez à tous les modèles (GPT-4, Claude 3, Gemini) au même endroit.', categories: ['Texte/scripts'], targetProfiles: ['Entrepreneur', 'Prof'], targetLevels: ['Débutant'], minPrice: 0, url: 'https://poe.com', highlight: 'Tout-en-un', rating: 4 },
  { name: 'Murf.ai', description: 'Voix off professionnelles pour présentations et e-learning.', categories: ['Audio/musique'], targetProfiles: ['Prof', 'E-commerce'], targetLevels: ['Débutant'], minPrice: 19, url: 'https://murf.ai', highlight: 'E-learning', rating: 3 },
];

const App: React.FC = () => {
  const [profile, setProfile] = useState<Profile>('Entrepreneur');
  const [budget, setBudget] = useState<string>('0-20CHF');
  const [needs, setNeeds] = useState<Need[]>([]);
  const [level, setLevel] = useState<Level>('Débutant');
  const [results, setResults] = useState<IA[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const budgetLimit = useMemo(() => {
    if (budget === '0-20CHF') return 20;
    if (budget === '20-50CHF') return 50;
    if (budget === '50-100CHF') return 100;
    return 300;
  }, [budget]);

  const toggleNeed = (need: Need) => {
    setNeeds(prev => prev.includes(need) ? prev.filter(n => n !== need) : [...prev, need]);
  };

  const findBestIA = () => {
    const scored = AI_DATABASE.map(ia => {
      let score = 0;
      
      // Filtre Budget strict
      if (ia.minPrice > budgetLimit) score -= 1000;
      
      // Score Catégories
      const matchedCats = ia.categories.filter(c => needs.includes(c));
      score += matchedCats.length * 15;

      // Score Profil
      if (ia.targetProfiles.includes(profile)) score += 5;

      // Score Niveau
      if (ia.targetLevels.includes(level)) score += 3;

      // Score Note globale
      score += ia.rating * 2;

      return { ...ia, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

    setResults(scored);
    setHasSearched(true);
    
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-orange-200 selection:text-orange-900">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-400/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-yellow-400/10 blur-[120px] rounded-full" />
      </div>

      {/* Hero Section */}
      <header className="relative pt-20 pb-12 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-sm mb-6 animate-fade-in shadow-sm">
          <Sparkles size={14} className="text-orange-500" />
          <span className="font-medium">Trouvez l'IA parfaite pour votre business</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-slate-900">
          Trouve l'IA idéale <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-yellow-500">
            en 60 secondes
          </span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 mb-10 leading-relaxed">
          Réponds à 4 questions et obtiens tes 3 meilleures IA <br className="hidden md:block" />
          personnalisées selon ton budget, ton métier et tes besoins.
        </p>
      </header>

      {/* Form Section */}
      <main className="relative px-6 pb-20 max-w-2xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50">
          <div className="space-y-8">
            {/* Profil */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <User size={18} className="text-orange-500" /> Quel est ton profil ?
              </label>
              <div className="relative">
                <select 
                  value={profile} 
                  onChange={(e) => setProfile(e.target.value as Profile)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-slate-800 font-medium"
                >
                  <option value="Créateur contenu">Créateur contenu</option>
                  <option value="Community manager">Community manager</option>
                  <option value="Entrepreneur">Entrepreneur</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Prof">Prof / Formateur</option>
                  <option value="Dev">Développeur</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Briefcase size={18} className="text-orange-500" /> Quel est ton budget mensuel ?
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['0-20CHF', '20-50CHF', '50-100CHF', '100-300CHF'].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBudget(b)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      budget === b 
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Besoins */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Zap size={18} className="text-orange-500" /> Quels sont tes besoins ?
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Texte/scripts', icon: <MessageSquare size={14} /> },
                  { label: 'Images/thumbnails', icon: <ImageIcon size={14} /> },
                  { label: 'Vidéos/Reels', icon: <Video size={14} /> },
                  { label: 'Audio/musique', icon: <Music size={14} /> },
                  { label: 'Code', icon: <Code size={14} /> },
                ].map((n) => (
                  <button
                    key={n.label}
                    onClick={() => toggleNeed(n.label as Need)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                      needs.includes(n.label as Need)
                      ? 'bg-orange-500 border-orange-500 text-white shadow-sm' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {n.icon}
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Niveau */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <GraduationCap size={18} className="text-orange-500" /> Ton niveau avec l'IA ?
              </label>
              <div className="flex gap-3">
                {['Débutant', 'Intermédiaire', 'Avancé'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l as Level)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      level === l 
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={findBestIA}
              disabled={needs.length === 0}
              className="w-full group relative overflow-hidden bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 py-4 rounded-2xl font-bold text-white text-lg shadow-xl shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="flex items-center justify-center gap-2">
                Clique pour découvrir ton IA <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </div>

        {/* Results Section */}
        {hasSearched && (
          <div id="results" className="mt-20 scroll-mt-10 animate-fade-up">
            <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3 text-slate-800">
              <Trophy className="text-yellow-500" /> Tes meilleures recommandations
            </h2>
            <div className="space-y-6">
              {results.map((ia, index) => (
                <div 
                  key={ia.name} 
                  className="group bg-white border border-slate-200 rounded-3xl p-6 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                      {ia.categories.includes('Code') ? <Code size={32} /> : 
                       ia.categories.includes('Images/thumbnails') ? <ImageIcon size={32} /> :
                       ia.categories.includes('Vidéos/Reels') ? <Video size={32} /> :
                       ia.categories.includes('Audio/musique') ? <Music size={32} /> :
                       <MessageSquare size={32} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold text-slate-800">{ia.name}</h3>
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-200 text-yellow-600 text-xs font-bold">
                          <Star size={12} fill="currentColor" /> {ia.rating}/5
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-xs text-slate-600 font-semibold uppercase tracking-wider border border-slate-200">
                          {ia.highlight}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-orange-500 to-yellow-500 text-xs text-white font-bold shadow-sm">
                            TOP CHOIX
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 mb-4 leading-relaxed">
                        {ia.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {ia.categories.map(c => (
                          <span key={c} className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md font-medium">#{c}</span>
                        ))}
                        <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md font-medium">
                          Budget: {ia.minPrice === 0 ? 'Gratuit' : `Dès ${ia.minPrice}CHF/mois`}
                        </span>
                      </div>
                      <a 
                        href={ia.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-orange-600 font-bold hover:text-orange-700 transition-colors"
                      >
                        Tester {ia.name} <ArrowRight size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <button 
                onClick={() => setHasSearched(false)}
                className="text-slate-400 hover:text-orange-500 transition-colors underline decoration-slate-300 hover:decoration-orange-300 underline-offset-4 font-medium"
              >
                Recommencer le test
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6 text-center text-slate-400 text-sm bg-white/50">
        <p>© 2024 Trouve ton IA. Développé pour les entrepreneurs suisses. 🇨🇭</p>
      </footer>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        .animate-fade-up {
          animation: fade-up 0.8s ease-out forwards;
        }
        select {
          background-image: none;
        }
      `}</style>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
