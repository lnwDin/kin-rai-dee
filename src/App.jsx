import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Utensils, Plus, Trash2, RefreshCw, ChefHat, Sparkles, Dices, 
  MapPin, Settings, X, AlertCircle, Youtube, Play, ArrowRight, 
  CheckCircle2, Flame, Leaf, Beef, Wheat, Soup, Clock, Key, Banknote,
  Coffee, IceCream, Heart, Star, Ban, MessageSquare, Edit, Activity, Info, Camera, CheckSquare, Square, Image, ImageOff,
  Check, Loader
} from 'lucide-react';

// --- Helper: Call Gemini via Netlify Functions (Security Patch) ---
const fetchGeminiWithRotation = async (payload) => {
  try {
    // ยิงไปที่ Path ของ Netlify Function แทนการยิงตรงไป Google
    const response = await fetch('/.netlify/functions/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }) // ส่ง payload ไปให้หลังบ้านจัดการต่อ
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Gemini Proxy Error");
    }
    return data;
  } catch (err) {
    console.error("API Call failed via Proxy:", err);
    throw err;
  }
};

// --- Helper: Call Overpass API (OpenStreetMap) ---
const fetchNearbyPlacesOSM = async (lat, lon, radius = 1000, retry = 1) => {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"restaurant|cafe|fast_food|food_court|street_vendor"](around:${radius},${lat},${lon});
      way["amenity"~"restaurant|cafe|fast_food|food_court|street_vendor"](around:${radius},${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch(
      'https://overpass.kumi.systems/api/interpreter', 
      { method: 'POST', body: query }
    );

    const data = await response.json();
    const places = data.elements
      .filter(el => el.tags && (el.tags.name || el.tags['name:en']))
      .map(el => el.tags.name || el.tags['name:en']);

    const uniquePlaces = [...new Set(places)];

    if (uniquePlaces.length === 0 && retry > 0) {
      await new Promise(r => setTimeout(r, 800));
      return fetchNearbyPlacesOSM(lat, lon, radius, retry - 1);
    }

    return uniquePlaces;
  } catch (error) {
    console.error("Overpass API Error:", error);
    return [];
  }
};

// --- Helper: Image Cache ---
const imageCache = {};

// --- Helper: Fetch Image from Unsplash ---
const fetchUnsplashImage = async (query, accessKey) => {
  if (!accessKey || !query || query === "N/A" || query.includes("Error")) return null;
  if (imageCache[query]) return imageCache[query];
  
  try {
    const response = await fetch(`https://api.unsplash.com/search/photos?page=1&query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high&client_id=${accessKey}`);
    const data = await response.json();
    if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
      const imageUrl = data.results[0].urls.regular;
      imageCache[query] = imageUrl;
      return imageUrl;
    }
    return null;
  } catch (error) {
    console.error("Unsplash Error:", error);
    return null;
  }
};

// --- Helper: Call Gemini AI (Selection) ---
const callGeminiAI = async (shopName, userProfile, exclusions, allergy, priceRange, selectedTypes, slotToReroll = null) => {
  const getScore = (val) => (val !== undefined && val !== null) ? val : 3; 
  const budgetText = `${priceRange.min} - ${priceRange.max} THB`;

  let requestedFields = [];
  if (selectedTypes.food) requestedFields.push(`"food": "Thai menu name"`);
  if (selectedTypes.drink) requestedFields.push(`"drink": "Beverage menu name"`);
  if (selectedTypes.dessert) requestedFields.push(`"dessert": "Dessert menu name"`);

  if (requestedFields.length === 0 && !slotToReroll) return {};

  let taskDescription = `Analyze the REAL restaurant "${shopName}" in Thailand. Suggest items for [${Object.keys(selectedTypes).filter(k => selectedTypes[k]).join(', ')}] that ACTUALLY exist on their menu.`;
  let outputFormat = `Return ONLY a JSON object with keys: ${requestedFields.join(', ')}. Values MUST be strings.`;

  if (slotToReroll) {
    taskDescription = `Look up the menu for "${shopName}". Suggest ONLY a recommended "${slotToReroll}" item.`;
    outputFormat = `Return ONLY a JSON object with a single key: "${slotToReroll}". Value MUST be a string.`;
  }

  const prompt = `
    Context: You are a Thai local expert.
    Task: ${taskDescription}
    
    User Profile:
    - Budget: ${budgetText} (Allocate this budget across the SELECTED items only)
    - Preferences: Spicy(${getScore(userProfile.q_spicy)}/5), Veg(${getScore(userProfile.q_veg_ratio)}/5)
    - Allergies: ${allergy || "None"} (STRICTLY AVOID)
    - Exclusions: ${exclusions.join(', ')}
    
    ${outputFormat}
    Constraint: If the shop type doesn't support a category (e.g. A coffee shop usually doesn't have Main Food), return "N/A" for that key. Do not return objects or arrays as values.
  `;

  try {
    const data = await fetchGeminiWithRotation({ 
      contents: [{ parts: [{ text: prompt }] }], 
      generationConfig: { responseMimeType: "application/json" } 
    });
    
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    text = text.replace(/```json|```/g, '').trim();
    
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return null;
    }

    if (!result || typeof result !== 'object') return null;

    Object.keys(result).forEach(key => {
        if (typeof result[key] !== 'string') {
            result[key] = String(result[key] || "N/A"); 
        }
    });

    return result;
  } catch (error) {
    console.error("AI Error:", error);
    return null; 
  }
};

// --- Helper: Call Gemini AI (Analysis) ---
const callGeminiAnalysis = async (mealSet) => {
  const itemsToAnalyze = [];
  if (mealSet.food && mealSet.food !== "N/A") itemsToAnalyze.push(`Main: ${mealSet.food}`);
  if (mealSet.drink && mealSet.drink !== "N/A") itemsToAnalyze.push(`Drink: ${mealSet.drink}`);
  if (mealSet.dessert && mealSet.dessert !== "N/A") itemsToAnalyze.push(`Dessert: ${mealSet.dessert}`);

  if (itemsToAnalyze.length === 0) return null;

  const prompt = `
    Role: Thai Nutritionist.
    Analyze this set from ${mealSet.shop}: ${itemsToAnalyze.join(', ')}.
    Output JSON:
    {
      "calories": integer (total kcal),
      "comment": "short witty thai comment",
      "health_tip": "short thai health tip",
      "score": integer (1-10)
    }
  `;

  try {
    const data = await fetchGeminiWithRotation({ 
      contents: [{ parts: [{ text: prompt }] }], 
      generationConfig: { responseMimeType: "application/json" } 
    });

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    text = text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

const QUIZ_CATEGORIES = [
  {
    id: 'distance', title: '📍 ระยะทาง (กม.)', color: 'text-indigo-600', bg: 'bg-indigo-50',
    questions: [{ id: 'q_distance', text: 'ค้นหาร้านไกลแค่ไหน?', isDistance: true }]
  },
  {
    id: 'budget', title: '💰 งบประมาณ (บาท/มื้อ)', color: 'text-blue-600', bg: 'bg-blue-50',
    questions: [{ id: 'q_budget', text: 'ลากเส้นกำหนดช่วงราคา', isPriceRange: true }]
  },
  {
    id: 'flavor', title: '🌶️ ความเผ็ด', color: 'text-red-500', bg: 'bg-red-50',
    questions: [{ id: 'q_spicy', text: '' }]
  },
  {
    id: 'veg', title: '🥦 ปริมาณผัก', color: 'text-green-500', bg: 'bg-green-50',
    questions: [{ id: 'q_veg_ratio', text: '' }]
  }
];

// --- Sub-Component: Distance Slider ---
const DistanceInput = ({ value, onChange }) => {
  const currentDist = value || 1;
  return (
    <div className="w-full space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-slate-400 font-bold uppercase">รัศมีค้นหา</label>
        <div className="text-xl font-black text-indigo-600">{currentDist} <span className="text-sm text-slate-500">กม.</span></div>
      </div>
      <input type="range" min="1" max="10" step="0.5" value={currentDist} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
      <div className="flex justify-between text-[10px] text-slate-400"><span>เดินไปได้ (1 กม.)</span><span>ขับรถไป (10 กม.)</span></div>
    </div>
  );
};

// --- Sub-Component: Dual Price Range Slider ---
const PriceRangeInput = ({ value, onChange }) => {
  const minLimit = 1; const maxLimit = 999;
  const currentMin = value?.min ?? 50; const currentMax = value?.max ?? 300;

  const handleMinSliderChange = (e) => onChange({ ...value, min: Math.min(Number(e.target.value), currentMax - 1) });
  const handleMaxSliderChange = (e) => onChange({ ...value, max: Math.max(Number(e.target.value), currentMin + 1) });
  const handleMinTextChange = (e) => { let val = parseInt(e.target.value) || 0; if (val > currentMax) val = currentMax; onChange({ ...value, min: val }); };
  const handleMaxTextChange = (e) => { let val = parseInt(e.target.value) || 0; if (val < currentMin) val = currentMin; if (val > maxLimit) val = maxLimit; onChange({ ...value, max: val }); };

  const minPercent = ((currentMin - minLimit) / (maxLimit - minLimit)) * 100;
  const maxPercent = ((currentMax - minLimit) / (maxLimit - minLimit)) * 100;

  return (
    <div className="w-full space-y-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="relative h-6 mt-2 select-none">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-slate-100 rounded-full"></div>
        <div className="absolute top-1/2 -translate-y-1/2 h-2 bg-orange-500 rounded-full opacity-80" style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}></div>
        <input type="range" min={minLimit} max={maxLimit} value={currentMin} onChange={handleMinSliderChange} className="absolute top-1/2 -translate-y-1/2 w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-orange-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:appearance-none z-20" />
        <input type="range" min={minLimit} max={maxLimit} value={currentMax} onChange={handleMaxSliderChange} className="absolute top-1/2 -translate-y-1/2 w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-orange-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:appearance-none z-30" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1"><label className="text-[10px] text-slate-400 font-bold uppercase">เริ่มต้น</label><div className="relative"><input type="number" value={currentMin} onChange={handleMinTextChange} className="w-full font-bold text-lg text-slate-700 border-b-2 border-slate-100 focus:border-orange-500 outline-none py-1 pl-1 transition-colors" /><span className="absolute right-0 bottom-1 text-xs text-slate-300">฿</span></div></div>
        <div className="text-slate-300 font-bold">-</div>
        <div className="flex-1 text-right"><label className="text-[10px] text-slate-400 font-bold uppercase">สูงสุด</label><div className="relative"><input type="number" value={currentMax} onChange={handleMaxTextChange} className="w-full font-bold text-lg text-slate-700 border-b-2 border-slate-100 focus:border-orange-500 outline-none py-1 pr-4 text-right transition-colors" /><span className="absolute right-0 bottom-1 text-xs text-slate-300">฿</span></div></div>
      </div>
    </div>
  );
};

// --- Sub-Component: API Key Modal ---
const ApiKeyModal = ({ isOpen, onClose, onSave, existingKeys }) => {
  const [keys, setKeys] = useState(existingKeys);

  if (!isOpen) return null;

  const handleSave = async () => {
    onSave(keys);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Key size={20} className="text-orange-500"/> ตั้งค่าระบบ</h2>
        <div className="space-y-4">
          <div className="bg-green-50 p-3 rounded-xl border border-green-200">
             <div className="flex items-center gap-2 text-green-700 font-bold text-sm mb-1"><CheckCircle2 size={16}/> ระบบ AI ปลอดภัย</div>
             <p className="text-xs text-green-600">เชื่อมต่อผ่าน Secure Proxy แล้ว ไม่จำเป็นต้องใส่ Gemini Key</p>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 ml-1">Unsplash Access Key (สำหรับรูปภาพ)</label>
            <input type="password" value={keys.unsplash} onChange={(e) => setKeys({...keys, unsplash: e.target.value})} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="ใส่ Access Key จาก Unsplash Developers" />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 rounded-xl hover:bg-slate-50">ปิด</button>
          <button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Check size={18}/> บันทึก</button>
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Favorites Modal ---
const FavoritesModal = ({ isOpen, onClose, favorites, onRemove, onUpdateReview }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl h-[80vh] flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-orange-50 rounded-t-3xl">
          <h2 className="text-xl font-bold text-orange-800 flex items-center gap-2"><Heart className="fill-orange-500 text-orange-500"/> รายการโปรด</h2>
          <button onClick={onClose}><X className="text-slate-400 hover:text-slate-600"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {favorites.length === 0 ? <p className="text-center text-slate-400 mt-10">ยังไม่มีรายการโปรด</p> : favorites.map(fav => (
            <div key={fav.id} className="bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative group">
              <button onClick={() => onRemove(fav.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
              <div className="flex gap-4 mb-3">
                {fav.image ? <img src={fav.image} alt={fav.name} className="w-16 h-16 rounded-lg object-cover bg-slate-100"/> : <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400"><ImageOff size={24}/></div>}
                <div>
                  <div className="text-xs font-bold text-orange-500 uppercase tracking-wide">{fav.type}</div>
                  <h3 className="font-bold text-slate-800 text-lg">{fav.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {fav.shop}</div>
                </div>
              </div>
              <textarea placeholder="โน้ต..." value={fav.comment || ''} onChange={(e) => onUpdateReview(fav.id, fav.rating, e.target.value)} className="w-full bg-white border rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-300 outline-none resize-none" rows={1}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Quiz UI ---
const PreferenceQuiz = ({ onFinish }) => {
  const [answers, setAnswers] = useState({ priceRange: { min: 50, max: 300 }, distance: 1 });
  const handleRate = (qId, score) => setAnswers(prev => ({ ...prev, [qId]: score }));
  const handlePriceChange = (val) => setAnswers(prev => ({ ...prev, priceRange: val }));
  const handleDistanceChange = (val) => setAnswers(prev => ({ ...prev, distance: val }));
  const handleSubmit = () => {
    const finalAnswers = { ...answers };
    QUIZ_CATEGORIES.forEach(cat => { 
        cat.questions.forEach(q => { 
            if (!q.isPriceRange && !q.isDistance && finalAnswers[q.id] === undefined) {
                finalAnswers[q.id] = 3; 
            }
        }); 
    });
    onFinish(finalAnswers);
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <header className="sticky top-0 bg-white/95 backdrop-blur-md z-20 border-b px-4 py-4 shadow-sm">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <h2 className="font-bold text-slate-800 text-lg">สำรวจความต้องการ (ข้ามได้)</h2>
          <button onClick={handleSubmit} className="text-xs font-bold text-orange-600 bg-orange-50 px-4 py-2 rounded-full hover:bg-orange-100 transition-colors">ข้ามไปสุ่มเลย</button>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-6 space-y-8">
        {QUIZ_CATEGORIES.map((cat) => (
          <div key={cat.id} className="space-y-4">
            <div className={`px-2 py-1 rounded-lg inline-block ${cat.bg}`}><h1 className={`text-lg font-black ${cat.color} flex items-center gap-2`}>{cat.title}</h1></div>
            <div className="space-y-6 px-2">
              {cat.questions.map((q) => (
                <div key={q.id} className="space-y-3">
                  {q.isPriceRange ? (<PriceRangeInput value={answers.priceRange} onChange={handlePriceChange} />) : 
                   q.isDistance ? (<DistanceInput value={answers.distance} onChange={handleDistanceChange} />) : (
                    <>
                      {q.text && <p className="font-bold text-slate-700">{q.text}</p>}
                      <div className="flex justify-between mb-1 px-1"><span className="text-[10px] text-slate-400">ไม่เลย</span><span className="text-[10px] text-slate-400">มาก</span></div>
                      <div className="flex gap-2">{[0, 1, 2, 3, 4, 5].map(score => (<button key={score} onClick={() => handleRate(q.id, score)} className={`flex-1 h-10 rounded-lg font-bold text-sm transition-all transform active:scale-95 border ${answers[q.id] === score ? 'bg-orange-500 text-white border-orange-500 shadow-md scale-105' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>{score}</button>))}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <hr className="border-slate-50 mt-6" />
          </div>
        ))}
      </main>
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-100 p-4 z-30">
        <div className="max-w-xl mx-auto"><button onClick={handleSubmit} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 transform active:scale-95">เสร็จแล้ว / สุ่มเลย <ArrowRight size={20} /></button></div>
      </div>
    </div>
  );
};

// --- Sub-Component: Main Randomizer ---
const FoodRandomizerApp = ({ userProfile, onRetakeQuiz, apiKeys, onUpdateKeys }) => {
  const [options, setOptions] = useState([]);
  const [result, setResult] = useState({ food: null, drink: null, dessert: null, shop: null });
  const [spinningState, setSpinningState] = useState({ food: false, drink: false, dessert: false, shop: false });
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [allergy, setAllergy] = useState("");
  const [exclusions, setExclusions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState({ food: true, drink: true, dessert: true });
  
  const [isLocating, setIsLocating] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showFavModal, setShowFavModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const priceRange = userProfile.priceRange || { min: 50, max: 300 };
  const searchRadius = useMemo(() => {
    return (userProfile?.distance || 1) * 1000;
  }, [userProfile?.distance]);

  const fetchImage = async (query) => {
    return await fetchUnsplashImage(query, apiKeys.unsplash);
  };

  const getMenuForShop = async (shopName, useAI = false, slotToReroll = null) => {
    // 🔥 เรียกผ่าน Proxy แทนการส่ง Key ตรงๆ
    const aiResponse = await callGeminiAI(shopName, userProfile, exclusions, allergy, priceRange, selectedTypes, slotToReroll);
    if (aiResponse) return aiResponse;
    return { food: "AI Error", drink: "AI Error", dessert: "AI Error" };
  };

  const handleFetchNearby = async () => {
    setIsLocating(true); 
    if (!navigator.geolocation) { alert("ไม่รองรับ GPS"); setIsLocating(false); return; }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const places = await fetchNearbyPlacesOSM(pos.coords.latitude, pos.coords.longitude, searchRadius);
            if (places.length > 0) {
                setOptions(places);
            } else {
                alert(`ไม่พบร้านอาหารในระยะ ${searchRadius/1000} กม.`);
                setOptions([]); 
            }
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
        } finally {
            setIsLocating(false);
        }
    }, () => { alert("ไม่สามารถระบุตำแหน่งได้"); setIsLocating(false); });
  };

  const handleRandomizeAll = () => {
    if (options.length === 0) return;
    
    const newSpinning = { shop: true };
    if (selectedTypes.food) newSpinning.food = true;
    if (selectedTypes.drink) newSpinning.drink = true;
    if (selectedTypes.dessert) newSpinning.dessert = true;
    
    setSpinningState(newSpinning);
    setResult(prev => ({ 
        ...prev, 
        shop: null,
        food: selectedTypes.food ? null : prev.food,
        drink: selectedTypes.drink ? null : prev.drink,
        dessert: selectedTypes.dessert ? null : prev.dessert
    }));
    setAnalysis(null);
    
    let counter = 0;
    const interval = setInterval(async () => {
      const tempShop = options[Math.floor(Math.random() * options.length)];
      setResult(prev => ({ 
          ...prev, 
          shop: tempShop, 
          food: selectedTypes.food ? "กำลังเลือก..." : prev.food, 
          drink: selectedTypes.drink ? "กำลังเลือก..." : prev.drink, 
          dessert: selectedTypes.dessert ? "กำลังเลือก..." : prev.dessert 
      }));
      counter++;
      if (counter > 10) {
        clearInterval(interval);
        try {
            const finalShop = options[Math.floor(Math.random() * options.length)];
            const menuSet = await getMenuForShop(finalShop, true);
            
            if (!menuSet) throw new Error("Menu set is invalid");

            const [fImg, dImg, dsImg] = await Promise.all([
                selectedTypes.food && menuSet.food && menuSet.food !== "N/A" ? fetchImage(menuSet.food) : null,
                selectedTypes.drink && menuSet.drink && menuSet.drink !== "N/A" ? fetchImage(menuSet.drink) : null,
                selectedTypes.dessert && menuSet.dessert && menuSet.dessert !== "N/A" ? fetchImage(menuSet.dessert) : null
            ]);

            setResult(prev => ({ 
                ...prev,
                shop: finalShop, 
                food: selectedTypes.food ? (menuSet.food || "N/A") : prev.food,
                drink: selectedTypes.drink ? (menuSet.drink || "N/A") : prev.drink,
                dessert: selectedTypes.dessert ? (menuSet.dessert || "N/A") : prev.dessert,
                foodImg: selectedTypes.food ? fImg : prev.foodImg, 
                drinkImg: selectedTypes.drink ? dImg : prev.drinkImg, 
                dessertImg: selectedTypes.dessert ? dsImg : prev.dessertImg 
            }));
        } catch (e) {
            console.error("Randomize Error:", e);
            setResult(prev => ({ ...prev, shop: "เกิดข้อผิดพลาด", food: "ลองใหม่", drink: "ลองใหม่", dessert: "ลองใหม่" }));
        } finally {
            setSpinningState({ food: false, drink: false, dessert: false, shop: false });
        }
      }
    }, 100);
  };

  const handleRandomizeSlot = async (slotType) => {
    if (!result.shop || options.length === 0) return handleRandomizeAll();
    
    setSpinningState(prev => ({ ...prev, [slotType]: true }));
    setResult(prev => ({ ...prev, [slotType]: "กำลังโหลด..." }));
    setAnalysis(null);

    setTimeout(async () => {
      try {
          const newItem = await getMenuForShop(result.shop, true, slotType); 
          const itemName = newItem && newItem[slotType] ? newItem[slotType] : "N/A";
          const newImg = await fetchImage(itemName);
          setResult(prev => ({ ...prev, [slotType]: itemName, [`${slotType}Img`]: newImg }));
      } catch (e) {
          console.error("Slot Error:", e);
          setResult(prev => ({ ...prev, [slotType]: "Error" }));
      } finally {
          setSpinningState(prev => ({ ...prev, [slotType]: false }));
      }
    }, 800);
  };

  const handleAnalyze = async () => {
    if (!result.food && !result.drink && !result.dessert) return;
    setIsAnalyzing(true);
    const data = await callGeminiAnalysis(result);
    setAnalysis(data);
    setIsAnalyzing(false);
  };

  const toggleFavorite = (type, name, img) => {
    if (!name || name.includes("Key") || name.includes("ระบบ")) return;
    if (favorites.some(f => f.name === name)) {
      setFavorites(favorites.filter(f => f.name !== name));
    } else {
      setFavorites([...favorites, { id: Date.now(), type, name, image: img, shop: result.shop, rating: 0, comment: '' }]);
    }
  };

  const updateReview = (id, rating, comment) => {
    setFavorites(favorites.map(f => f.id === id ? { ...f, rating, comment } : f));
  };

  const banItem = (item) => {
    if(!item || item.includes("Key") || item.includes("ระบบ")) return;
    if(window.confirm(`ตัด "${item}" ออกจากรายการ?`)) { setExclusions([...exclusions, item]); }
  };

  const toggleType = (type) => setSelectedTypes(prev => ({ ...prev, [type]: !prev[type] }));

  const ResultCard = ({ type, title, icon: Icon, item, img, color, isSelected, onToggle }) => {
    const isFav = favorites.some(f => f.name === item);
    const isSlotSpinning = spinningState[type];
    const hasItem = item && item !== "กำลังเลือก..." && item !== "กำลังโหลด..." && !isSlotSpinning && !String(item).includes("Error");
    const isMissing = item === "N/A" || item === null; 

    if (!isSelected) {
        return (
            <div onClick={onToggle} className="bg-slate-50 rounded-2xl p-4 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[160px] cursor-pointer hover:bg-slate-100 transition-colors opacity-50">
                <div className="p-3 bg-slate-200 rounded-full text-slate-400 mb-2"><Icon size={24}/></div>
                <span className="text-sm font-bold text-slate-400">ไม่ได้เลือก {title}</span>
            </div>
        );
    }

    return (
      <div className={`bg-white rounded-2xl shadow-md border-l-4 ${color} overflow-hidden flex flex-col h-full`}>
        <div className="relative h-32 w-full bg-slate-100 flex-shrink-0">
            {hasItem && img ? (
                <>
                    <img src={img} className="w-full h-full object-cover transition-transform duration-700 hover:scale-110" alt={String(item)} />
                    <div className="absolute bottom-1 right-2 z-10 text-[8px] text-white/70 bg-black/30 px-1 rounded flex items-center gap-1"><Camera size={8}/> Unsplash</div>
                </>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                    {isMissing ? <Ban size={32}/> : <Icon size={40}/>}
                </div>
            )}
            {isSlotSpinning && (
                <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-20">
                    <RefreshCw className="animate-spin text-slate-400" size={24}/>
                </div>
            )}
        </div>
        <div className="p-4 flex flex-col flex-1">
            <div className="flex justify-between items-start mb-2">
                <button onClick={onToggle} className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-500 hover:text-red-500">
                    <CheckSquare size={14} className="text-green-500"/> {title}
                </button>
                {hasItem && !isMissing && (
                    <div className="flex gap-1">
                        <button onClick={() => handleRandomizeSlot(type)} className="p-1.5 bg-slate-50 rounded-full text-slate-500 hover:bg-blue-50 transition-colors"><RefreshCw size={14}/></button>
                        <button onClick={() => toggleFavorite(type, item, img)} className={`p-1.5 rounded-full transition-colors ${isFav ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500'}`}><Heart size={14} fill={isFav ? "currentColor" : "none"}/></button>
                    </div>
                )}
            </div>
            <div className={`font-black text-lg leading-tight text-slate-800 ${isMissing ? 'text-slate-400 italic' : ''}`}>
                {isMissing ? "ไม่มีเมนู" : (item || "รอการสุ่ม...")}
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-800">
      <ApiKeyModal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} onSave={onUpdateKeys} existingKeys={apiKeys} />
      <FavoritesModal isOpen={showFavModal} onClose={() => setShowFavModal(false)} favorites={favorites} onRemove={(id) => setFavorites(favorites.filter(f=>f.id!==id))} onUpdateReview={updateReview} />

      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-600"><ChefHat size={28} strokeWidth={2.5}/><div><h1 className="text-xl font-black text-slate-900 leading-none">กินไรดี</h1><span className="text-[10px] text-orange-500 font-semibold tracking-wider">Kin-Rai-Dee</span></div></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFavModal(true)} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 relative"><Heart size={18} fill={favorites.length > 0 ? "currentColor" : "none"}/></button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-full relative ${showFilters || allergy || exclusions.length > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}><Settings size={20} /></button>
          </div>
        </div>
        {showFilters && (
          <div className="bg-orange-50/50 border-b border-orange-100 p-4 animate-in slide-in-from-top-2">
             <div className="max-w-3xl mx-auto space-y-3">
                <div className="flex gap-2">
                  <div className="bg-white p-3 rounded-xl border border-orange-200 flex-1">
                     <div className="text-[10px] font-bold text-slate-400 uppercase">งบประมาณ</div>
                     <div className="text-sm font-bold text-slate-700">{priceRange.min}-{priceRange.max} บ.</div>
                  </div>
                  <button onClick={onRetakeQuiz} className="bg-white p-3 rounded-xl border border-slate-200 text-blue-500"><Edit size={16}/></button>
                </div>
                <div><h3 className="text-xs font-bold text-red-600 mb-1">แพ้อาหาร (Allergy)</h3><input value={allergy} onChange={(e)=>setAllergy(e.target.value)} placeholder="เช่น กุ้ง, ถั่วลิสง..." className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm focus:ring-2 focus:ring-red-400 outline-none bg-white"/></div>
             </div>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <div className="relative">
          <div className="text-center mb-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">ร้านอาหารที่เลือก</h2>
            <div className={`text-2xl font-black text-slate-800 flex justify-center items-center gap-2 ${spinningState.shop ? 'animate-pulse opacity-50' : ''}`}><MapPin className="text-orange-500"/> {result.shop || "รอสุ่มร้าน..."}</div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <ResultCard type="food" title="อาหารจานหลัก" icon={Utensils} item={result.food} img={result.foodImg} color="border-orange-500" isSelected={selectedTypes.food} onToggle={() => toggleType('food')} />
            <ResultCard type="drink" title="เครื่องดื่ม" icon={Coffee} item={result.drink} img={result.drinkImg} color="border-blue-500" isSelected={selectedTypes.drink} onToggle={() => toggleType('drink')} />
            <ResultCard type="dessert" title="ของหวาน" icon={IceCream} item={result.dessert} img={result.dessertImg} color="border-pink-500" isSelected={selectedTypes.dessert} onToggle={() => toggleType('dessert')} />
          </div>
          {analysis && (
            <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 animate-in zoom-in-95">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><Sparkles size={24}/></div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">บทวิเคราะห์จาก AI</h3>
                  <p className="text-slate-600 italic mb-4">"{analysis.comment}"</p>
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">พลังงานรวม</div>
                      <div className="text-lg font-black text-slate-800">{analysis.calories} <span className="text-xs font-normal">kcal</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="mt-8 flex flex-col items-center gap-4">
            {options.length === 0 ? (
              <button onClick={handleFetchNearby} disabled={isLocating} className="w-full md:w-auto px-10 py-4 bg-blue-600 text-white rounded-full font-bold shadow-xl flex items-center justify-center gap-3">{isLocating ? <RefreshCw className="animate-spin"/> : <MapPin/>} ค้นหาร้านจริงรอบตัว</button>
            ) : (
              <div className="flex flex-col gap-3 w-full items-center">
                <button onClick={handleRandomizeAll} disabled={spinningState.shop} className={`w-full md:w-auto px-12 py-5 rounded-full font-black text-xl shadow-xl flex items-center justify-center gap-3 transition-all ${spinningState.shop ? 'bg-slate-400 text-white' : 'bg-gradient-to-r from-orange-500 to-red-600 text-white'}`}>{spinningState.shop ? <RefreshCw className="animate-spin"/> : <Dices/>} สุ่มครบเซ็ต!</button>
                {result.food && selectedTypes.food && !spinningState.shop && !analysis && (
                  <button onClick={handleAnalyze} disabled={isAnalyzing} className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full flex items-center gap-2 transition-colors">
                    {isAnalyzing ? <RefreshCw className="animate-spin" size={14}/> : <Activity size={14}/>} {isAnalyzing ? "กำลังวิเคราะห์..." : "วิเคราะห์โภชนาการ (AI)"}
                  </button>
                )}
                {!spinningState.shop && <button onClick={handleFetchNearby} className="text-xs text-slate-400 font-bold flex items-center gap-1"><RefreshCw size={12}/> หาร้านใหม่</button>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// --- App Orchestrator ---
const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [userProfile, setUserProfile] = useState(null);
  const [apiKeys, setApiKeys] = useState({ unsplash: '' });

  if (appState === 'welcome') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="max-w-sm w-full">
        <div className="inline-flex p-6 bg-orange-100 text-orange-600 rounded-[2.5rem] mb-8 shadow-inner"><ChefHat size={64} /></div>
        <h1 className="text-4xl font-black text-slate-900 mb-4">กินไรดี?</h1>
        <button onClick={() => setAppState('quiz')} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold text-lg shadow-2xl flex items-center justify-center gap-2">เริ่มสำรวจความต้องการ <ArrowRight/></button>
      </div>
    </div>
  );

  if (appState === 'quiz') return <PreferenceQuiz onFinish={(ans) => { setUserProfile(ans); setAppState('app'); }} />;
  return <FoodRandomizerApp userProfile={userProfile} onRetakeQuiz={() => setAppState('quiz')} apiKeys={apiKeys} onUpdateKeys={(k) => setApiKeys(k)} />;
};

export default App;