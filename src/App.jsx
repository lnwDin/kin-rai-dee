import React, { useState, useRef, useEffect } from 'react';
import { 
  Utensils, Plus, Trash2, RefreshCw, ChefHat, Sparkles, Dices, 
  MapPin, Settings, X, AlertCircle, Youtube, Play, ArrowRight, 
  CheckCircle2, Flame, Leaf, Beef, Wheat, Soup, Clock, Key, Banknote
} from 'lucide-react';

// --- Helper: Load Google Maps Script ---
const loadGoogleMapsScript = (apiKey) => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) { resolve(); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

// --- Helper: Call Gemini AI ---
const callGeminiAI = async (apiKey, shopName, userProfile, exclusions) => {
  // แปลงค่างบประมาณเป็นข้อความสำหรับ AI
  const budgetText = userProfile.q_budget === 1 ? "Budget-friendly/Cheap/Street Food price" : userProfile.q_budget === 2 ? "Mid-range price" : "Premium/High-end price";
  
  const prompt = `
    Context: You are a local food expert in Thailand.
    Task: Suggest ONE specific recommended menu item from the restaurant named "${shopName}".
    
    User Profile:
    - Budget Level: ${budgetText}
    - Spicy Preference: ${userProfile.q_spicy}/5
    - Vegetable Preference: ${userProfile.q_veg_ratio}/5
    - Meat Preference: ${userProfile.q_meat_lover}/5
    - Avoid/Allergies: ${exclusions.join(', ') || "None"}
    
    Constraints:
    1. Answer ONLY with the menu name in Thai.
    2. Do not add explanations.
    3. Make sure the menu matches the budget level requested.
    4. If the restaurant is generic (e.g., "7-Eleven"), suggest a popular item matching the profile.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error("AI Error:", error);
    return null; // Fallback to local logic
  }
};

// --- ข้อมูลคำถาม (Quiz Data) ---
const QUIZ_CATEGORIES = [
  {
    id: 'budget',
    title: '💰 งบประมาณต่อมื้อ',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    questions: [
      { 
        id: 'q_budget', 
        text: 'งบประมาณที่คุณตั้งไว้ในมื้อนี้',
        isBudget: true,
        options: [
          { value: 1, label: "ประหยัด (หลักสิบ-ร้อยต้น)", icon: "🥣" },
          { value: 2, label: "ปานกลาง (ร้อยปลาย-สามร้อย)", icon: "🍱" },
          { value: 3, label: "พรีเมียม (หรูหรา/จัดเต็ม)", icon: "🥂" }
        ]
      }
    ]
  },
  {
    id: 'flavor',
    title: '🌶️ กลุ่มรสชาติ (Flavor)',
    color: 'text-red-500',
    bg: 'bg-red-50',
    questions: [
      { id: 'q_spicy', text: 'คุณกิน "เผ็ด" ได้มากแค่ไหน' },
      { id: 'q_strong', text: 'คุณชอบอาหาร "รสจัด" (เค็ม-เปรี้ยว-เข้มข้น) แค่ไหน' },
      { id: 'q_mild', text: 'คุณชอบอาหาร "รสอ่อน/จืด" แค่ไหน' }
    ]
  },
  {
    id: 'veg',
    title: '🥦 กลุ่มผัก & ความเบา',
    color: 'text-green-500',
    bg: 'bg-green-50',
    questions: [
      { id: 'q_veg_ratio', text: 'คุณกิน "ผัก" เป็นสัดส่วนมากแค่ไหนในมื้อหนึ่ง' },
      { id: 'q_light', text: 'คุณชอบอาหารที่ "ไม่มัน / ไม่หนักท้อง" แค่ไหน' },
      { id: 'q_fresh', text: 'คุณรู้สึกสบายตัวกว่าหลังมื้อที่มี "ผักเยอะ" แค่ไหน' }
    ]
  },
  {
    id: 'protein',
    title: '🥩 กลุ่มโปรตีน & ความหนัก',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    questions: [
      { id: 'q_meat_lover', text: 'คุณชอบอาหารที่มี "เนื้อสัตว์เป็นหลัก" แค่ไหน' },
      { id: 'q_full', text: 'คุณชอบอาหารที่กินแล้ว "อิ่มแน่น / อยู่ท้องนาน" แค่ไหน' },
      { id: 'q_greasy', text: 'คุณมักเลือกเมนู "ย่าง / ทอด / ฉ่ำ" แค่ไหน' }
    ]
  },
  {
    id: 'carb',
    title: '🍜 กลุ่มคาร์โบไฮเดรต',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    questions: [
      { id: 'q_carb_need', text: 'คุณต้องการ "ข้าวหรือเส้น" ในมื้ออาหารมากแค่ไหน' },
      { id: 'q_carb_addict', text: 'ถ้ามื้อไหนไม่มีแป้ง คุณรู้สึกว่า "ยังไม่ใช่มื้อจริง" แค่ไหน' }
    ]
  },
  {
    id: 'cooking',
    title: '🔥 กลุ่มวิธีปรุง',
    color: 'text-red-400',
    bg: 'bg-red-50',
    questions: [
      { id: 'q_fry', text: 'คุณชอบอาหาร "ทอด" แค่ไหน' },
      { id: 'q_stir', text: 'คุณชอบอาหาร "ผัด" แค่ไหน' },
      { id: 'q_boil', text: 'คุณชอบอาหาร "ต้ม / นึ่ง / ลวก" แค่ไหน' },
      { id: 'q_raw', text: 'คุณชอบอาหารแนว "ยำ / ดิบ / สด" แค่ไหน' }
    ]
  },
  {
    id: 'convenience',
    title: '⏱️ ความง่าย & ราคา',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    questions: [
      { id: 'q_easy', text: 'คุณชอบเมนูที่ "กินง่าย เร็ว ไม่ต้องคิดมาก" แค่ไหน' },
      { id: 'q_routine', text: 'คุณมักเลือกเมนู "เดิมๆ ที่คุ้นเคย" แค่ไหน' }
    ]
  }
];

// --- Sub-Component: API Key Modal ---
const ApiKeyModal = ({ isOpen, onClose, onSave, existingKeys }) => {
  const [keys, setKeys] = useState(existingKeys);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><Key size={20} className="text-orange-500" /> API Keys Config</h2>
        <p className="text-sm text-slate-500 mb-6">ตั้งค่าเพื่อดึงร้านจริงและใช้ AI เลือกเมนู</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Google Maps Key</label>
            <input type="password" value={keys.googleMaps} onChange={(e) => setKeys({...keys, googleMaps: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="AIza..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Gemini AI Key</label>
            <input type="password" value={keys.gemini} onChange={(e) => setKeys({...keys, gemini: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="AIza..." />
          </div>
        </div>
        <button onClick={() => { onSave(keys); onClose(); }} className="w-full mt-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">บันทึกการตั้งค่า</button>
        <button onClick={onClose} className="w-full mt-2 py-3 text-slate-400 text-sm font-medium hover:text-slate-600">ไว้ทีหลัง</button>
      </div>
    </div>
  );
};

// --- Sub-Component: Quiz UI ---
const PreferenceQuiz = ({ onFinish }) => {
  const [currentCatIndex, setCurrentCatIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const currentCategory = QUIZ_CATEGORIES[currentCatIndex];
  const isLastCategory = currentCatIndex === QUIZ_CATEGORIES.length - 1;
  const isCategoryComplete = currentCategory.questions.every(q => answers[q.id]);
  const handleRate = (qId, score) => setAnswers(prev => ({ ...prev, [qId]: score }));

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="sticky top-0 bg-white/95 backdrop-blur z-20 border-b border-slate-100 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
           <h2 className="font-bold text-slate-800">สำรวจความหิว</h2>
           <div className="text-xs font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full">{currentCatIndex + 1} / {QUIZ_CATEGORIES.length}</div>
        </div>
        <div className="h-1 bg-slate-100 mt-4 w-full max-w-xl mx-auto rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${((currentCatIndex + 1) / QUIZ_CATEGORIES.length) * 100}%` }} />
        </div>
      </header>
      <main className="max-w-xl mx-auto px-6 py-10 space-y-12">
        <div className={`p-6 rounded-3xl ${currentCategory.bg} animate-in fade-in slide-in-from-bottom-4`}>
          <h1 className={`text-2xl font-black ${currentCategory.color} mb-1`}>{currentCategory.title}</h1>
          <p className="text-sm text-slate-600 opacity-80">
            {currentCategory.id === 'budget' ? 'เลือกงบประมาณที่ต้องการ' : 'ระดับ 1 (น้อยมาก) ถึง 5 (มากเป็นพิเศษ)'}
          </p>
        </div>
        {currentCategory.questions.map((q) => (
          <div key={q.id} className="space-y-6">
            <p className="font-bold text-slate-800 text-xl leading-relaxed">{q.text}</p>
            {q.isBudget ? (
              <div className="space-y-3">
                {q.options.map((opt) => (
                  <button key={opt.value} onClick={() => handleRate(q.id, opt.value)} className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${answers[q.id] === opt.value ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <span className="text-2xl">{opt.icon}</span>
                    <span className={`font-bold ${answers[q.id] === opt.value ? 'text-orange-700' : 'text-slate-600'}`}>{opt.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button key={score} onClick={() => handleRate(q.id, score)} className={`flex-1 h-14 rounded-2xl font-black text-lg transition-all transform active:scale-95 ${answers[q.id] === score ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{score}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
      <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md p-4 z-20">
        <button onClick={() => isLastCategory ? onFinish(answers) : (() => { setCurrentCatIndex(c => c+1); window.scrollTo(0,0); })()} disabled={!isCategoryComplete} className={`max-w-xl mx-auto w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${isCategoryComplete ? 'bg-slate-900 text-white shadow-xl hover:-translate-y-1' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
          {isLastCategory ? 'ประมวลผลความหิว' : 'ถัดไป'} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

// --- Sub-Component: Food Randomizer ---
const FoodRandomizerApp = ({ userProfile, onRetakeQuiz, apiKeys, onUpdateKeys }) => {
  const [options, setOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [result, setResult] = useState(null);
  const [recommendedMenu, setRecommendedMenu] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayedOption, setDisplayedOption] = useState("วันนี้กินไรดี?");
  const [exclusions, setExclusions] = useState([]);
  const [exclusionInput, setExclusionInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Profile Analysis
  const getProfileBadge = () => {
    if (!userProfile) return null;
    if (userProfile.q_budget === 3) return { text: "สายเปย์", icon: <Banknote size={12}/>, color: "bg-purple-100 text-purple-700" };
    if (userProfile.q_spicy >= 4) return { text: "สายแซ่บ", icon: <Flame size={12}/>, color: "bg-red-100 text-red-700" };
    if (userProfile.q_veg_ratio >= 4) return { text: "สายผัก", icon: <Leaf size={12}/>, color: "bg-green-100 text-green-700" };
    return { text: "สายกินเก่ง", icon: <ChefHat size={12}/>, color: "bg-orange-100 text-orange-700" };
  };
  const profileBadge = getProfileBadge();

  // Mock Data (Fallback)
  const mockNearbyPlaces = [
    "ร้านป้าเล็กตามสั่ง (100 ม.)", "ก๋วยเตี๋ยวต้มยำปากซอย (250 ม.)", "ข้าวมันไก่เจ๊อ้วน (300 ม.)",
    "ส้มตำหน้าเซเว่น (50 ม.)", "ร้านอาหารญี่ปุ่นซอย 8 (800 ม.)", "พิซซ่าเตาถ่าน (1.5 กม.)", 
    "หมูปิ้งนมสด (20 ม.)", "สุกี้ตี๋น้อย (2 กม.)", "ไก่ย่างวิเชียรบุรี (1 กม.)"
  ];

  // Logic: Get Menu (Local Fallback + AI Entry Point)
  const getMenuForShop = async (shopName, currentExclusions = [], useAI = false) => {
    // 1. Try AI if enabled
    if (useAI && apiKeys.gemini) {
      const aiMenu = await callGeminiAI(apiKeys.gemini, shopName, userProfile, currentExclusions);
      if (aiMenu) return aiMenu;
    }

    // 2. Local Fallback logic
    const menus = {
      noodle: ["เส้นเล็กต้มยำ", "หมี่ขาวน้ำใส", "เล็กแห้งไม่งอก", "บะหมี่เกี๊ยวหมูแดง", "เส้นใหญ่เย็นตาโฟ", "มาม่าต้มยำ"],
      somtum: ["ตำไทยไข่เค็ม", "ตำปูปลาร้า", "ลาบหมู", "น้ำตกหมู", "ไก่ย่างข้าวเหนียว", "ซุปหน่อไม้"],
      rice: ["ข้าวกะเพราหมูสับไข่ดาว", "ข้าวผัดหมู", "ข้าวหมูกระเทียม", "ข้าวคะน้าหมูกรอบ", "พริกแกงไก่ราดข้าว"],
      japanese: ["ข้าวหน้าเนื้อ", "ราเมง", "ซูชิเซ็ต", "ข้าวแกงกะหรี่", "แซลมอนดอง"],
      fastfood: ["เบอร์เกอร์เนื้อ", "ไก่ทอด", "เฟรนช์ฟรายส์", "นักเก็ต", "พิซซ่าหน้าฮาวายเอี้ยน"],
      shabu: ["ชุดหมูสไลด์", "ชุดเนื้อวากิว", "ชุดรวมมิตรทะเล", "ชุดผักรวม"],
      general: ["ข้าวไข่เจียว", "สุกี้แห้ง/น้ำ", "มาม่าผัดขี้เมา", "ราดหน้าหมูหมัก", "ผัดซีอิ๊ว"]
    };
    
    let targetList = menus.general;
    if (shopName.includes("ก๋วยเตี๋ยว") || shopName.includes("บะหมี่") || shopName.includes("ก๋วยจั๊บ")) targetList = menus.noodle;
    else if (shopName.includes("ส้มตำ") || shopName.includes("ลาบ") || shopName.includes("ไก่ย่าง")) targetList = menus.somtum;
    else if (shopName.includes("ญี่ปุ่น") || shopName.includes("ซูชิ")) targetList = menus.japanese;
    else if (shopName.includes("ตามสั่ง") || shopName.includes("ข้าว") || shopName.includes("ป้า")) targetList = menus.rice;
    else if (shopName.includes("พิซซ่า") || shopName.includes("เบอร์เกอร์")) targetList = menus.fastfood;
    else if (shopName.includes("หมูกระทะ") || shopName.includes("สุกี้") || shopName.includes("ชาบู")) targetList = menus.shabu;
    
    const validMenus = targetList.filter(m => !currentExclusions.some(ex => m.includes(ex)));
    return validMenus.length > 0 ? validMenus[Math.floor(Math.random() * validMenus.length)] : "เมนูพิเศษ (หมดตัวเลือก)";
  };

  const activeOptions = options.filter(opt => !exclusions.some(excludeWord => opt.includes(excludeWord)));
  const addOption = (e) => { e.preventDefault(); if (newOption.trim()) { setOptions([...options, newOption.trim()]); setNewOption(""); } };
  const removeOption = (val) => setOptions(options.filter(o => o !== val));
  const addExclusion = (e) => { e.preventDefault(); if (exclusionInput.trim() && !exclusions.includes(exclusionInput.trim())) { setExclusions([...exclusions, exclusionInput.trim()]); setExclusionInput(""); } };
  const removeExclusion = (val) => setExclusions(exclusions.filter(e => e !== val));

  const handleFetchNearby = async () => {
    setIsLocating(true); 
    setDisplayedOption("กำลังสแกนพื้นที่..."); 
    setResult(null); 
    setRecommendedMenu(null);

    // Check GPS support
    if (!("geolocation" in navigator)) {
      alert("ไม่รองรับ GPS"); setIsLocating(false); return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;

      // Try Google Maps API
      if (apiKeys.googleMaps) {
        try {
          await loadGoogleMapsScript(apiKeys.googleMaps);
          const service = new window.google.maps.places.PlacesService(document.createElement('div'));
          const request = {
            location: new window.google.maps.LatLng(latitude, longitude),
            radius: '1000', // 1km
            type: ['restaurant', 'food']
          };
          
          service.nearbySearch(request, (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const realPlaces = results.map(p => p.name).slice(0, 10); // Take top 10
              setOptions(prev => { 
                const uniqueNew = realPlaces.filter(s => !prev.includes(s)); 
                return [...prev, ...uniqueNew]; 
              });
              setDisplayedOption("เจอร้านจริงแล้ว!");
            } else {
              setDisplayedOption("ไม่พบร้าน (Google Error)");
            }
            setIsLocating(false);
          });
          return;
        } catch (err) {
          console.error("Google Maps Error:", err);
          // Fallback to mock if API fails
        }
      }

      // Mock Fallback
      setTimeout(() => {
        const shuffled = [...mockNearbyPlaces].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5); 
        setOptions(prev => [...prev, ...selected.filter(s => !prev.includes(s))]);
        setIsLocating(false); 
        setDisplayedOption(apiKeys.googleMaps ? "API ผิดพลาด ใช้ข้อมูลจำลอง" : "เจอแหล่งอาหารจำลอง!");
      }, 1500);

    }, () => { alert("ไม่สามารถระบุตำแหน่ง"); setIsLocating(false); setDisplayedOption("หาไม่เจอ"); });
  };

  const handleRandomize = () => {
    if (activeOptions.length === 0) return;
    setIsSpinning(true); setResult(null); setRecommendedMenu(null); setShowFilters(false);
    
    let counter = 0; const maxShuffles = 20; const speed = 80;
    
    const intervalId = setInterval(async () => {
      // Spinning Animation
      const randomShop = activeOptions[Math.floor(Math.random() * activeOptions.length)];
      // Quick local menu for spinning effect
      const tempMenu = await getMenuForShop(randomShop, exclusions, false); 
      setDisplayedOption(tempMenu);
      
      counter++;
      if (counter > maxShuffles) {
        clearInterval(intervalId);
        
        // Final Result
        const finalShop = activeOptions[Math.floor(Math.random() * activeOptions.length)];
        setResult(finalShop);
        
        // Final Menu (Use AI if available)
        setDisplayedOption(apiKeys.gemini ? "AI กำลังคิด..." : "กำลังเลือก...");
        const finalMenu = await getMenuForShop(finalShop, exclusions, true); // true = Use AI
        
        setRecommendedMenu(finalMenu);
        setDisplayedOption(finalMenu);
        setIsSpinning(false);
      }
    }, speed);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <ApiKeyModal 
        isOpen={showKeyModal} 
        onClose={() => setShowKeyModal(false)} 
        onSave={onUpdateKeys}
        existingKeys={apiKeys}
      />
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-600">
            <ChefHat size={28} strokeWidth={2.5} />
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 leading-none">กินไรดี</h1>
              <span className="text-[10px] text-orange-500 font-semibold tracking-wider">KIN RAI DEE</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
               onClick={onRetakeQuiz}
               className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${profileBadge.color} border-transparent hover:border-current transition-all`}
            >
               {profileBadge.icon} {profileBadge.text}
            </button>
            <button onClick={() => setShowKeyModal(true)} className={`p-2 rounded-full ${apiKeys.googleMaps || apiKeys.gemini ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
              <Key size={20} />
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-full relative ${showFilters || exclusions.length > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
              <Settings size={20} />
              {exclusions.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>
          </div>
        </div>
        
        <div className="md:hidden px-4 pb-2">
           <button onClick={onRetakeQuiz} className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${profileBadge.color}`}>
               {profileBadge.icon} คุณคือ: {profileBadge.text} (แตะเพื่อทำแบบทดสอบใหม่)
            </button>
        </div>

        {showFilters && (
          <div className="bg-orange-50/50 border-b border-orange-100 p-4 animate-in slide-in-from-top-2">
             <div className="max-w-3xl mx-auto">
                <h3 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2"><AlertCircle size={14}/> Filter (ไม่กินอะไรบอกได้)</h3>
                <form onSubmit={addExclusion} className="flex gap-2 mb-2">
                  <input type="text" value={exclusionInput} onChange={(e)=>setExclusionInput(e.target.value)} placeholder="เช่น เผ็ด, เครื่องใน..." className="flex-1 px-3 py-2 rounded-lg border border-orange-200 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
                  <button type="submit" className="px-4 py-2 bg-orange-200 text-orange-800 rounded-lg text-sm font-bold">แบน</button>
                </form>
                <div className="flex flex-wrap gap-2">{exclusions.map((ex, idx) => (<span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">ไม่เอา {ex} <button onClick={()=>removeExclusion(ex)}><X size={12}/></button></span>))}</div>
             </div>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 mb-6 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-red-500 to-orange-400"></div>
           <div className="mb-4 flex justify-center text-orange-500 opacity-20">{activeOptions.length === 0 ? <MapPin size={80} /> : <Utensils size={80} />}</div>
           
           <div className="relative z-10 -mt-16">
             <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">{result ? "มื้อนี้กิน..." : "หิวหรือยัง?"}</h2>
             <div className={`min-h-[8rem] flex flex-col items-center justify-center mb-6 ${isSpinning ? 'blur-sm' : ''}`}>
               {result && recommendedMenu && !isSpinning ? (
                 <div className="animate-in zoom-in duration-300 w-full">
                   <div className="text-4xl md:text-5xl font-black text-slate-800 mb-4 break-words">{recommendedMenu}</div>
                   <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg text-slate-500 text-sm mb-6 border border-slate-100">
                     <MapPin size={14}/> พิกัด: <span className="font-bold text-orange-600">{result}</span>
                   </div>
                   {apiKeys.gemini && <div className="text-[10px] text-blue-500 font-bold mb-4 flex items-center gap-1"><Sparkles size={10}/> แนะนำโดย AI (Gemini)</div>}
                   <div className="w-full max-w-md mx-auto rounded-xl overflow-hidden shadow-lg border-4 border-white bg-black aspect-video relative group">
                     <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Youtube size={12}/> ยั่วน้ำลาย</div>
                     <iframe className="w-full h-full" src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("เมนู " + recommendedMenu + " asmr street food")}&autoplay=1&mute=1&controls=1&loop=1`} title="YouTube" allowFullScreen></iframe>
                   </div>
                 </div>
               ) : (
                 <div className="text-3xl md:text-5xl font-black text-slate-700">{displayedOption}</div>
               )}
             </div>

             {activeOptions.length === 0 ? (
               <button onClick={handleFetchNearby} disabled={isLocating} className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2 mx-auto w-full md:w-auto">
                 {isLocating ? <RefreshCw className="animate-spin"/> : <MapPin className="animate-bounce"/>} {isLocating ? "กำลังสแกน..." : "ค้นหาร้านใกล้ฉัน (GPS)"}
               </button>
             ) : (
               <div className="flex flex-col items-center gap-3">
                 <button onClick={handleRandomize} disabled={isSpinning} className={`px-10 py-5 rounded-full font-bold text-xl text-white shadow-xl flex items-center gap-3 transition-all transform active:scale-95 ${isSpinning ? 'bg-slate-400' : 'bg-gradient-to-r from-orange-500 to-red-600 hover:shadow-orange-500/40'}`}>
                   {isSpinning ? <RefreshCw className="animate-spin"/> : <Dices/>} {isSpinning ? "กำลังนึก..." : "สุ่มเมนูเลย!"}
                 </button>
                 {!isSpinning && <button onClick={handleFetchNearby} className="text-xs text-slate-400 hover:text-blue-500 flex items-center gap-1 mt-2"><RefreshCw size={12}/> รีเซ็ต/หาใหม่</button>}
               </div>
             )}
           </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-700 text-sm">แหล่งอาหาร ({activeOptions.length})</h3>
             <div className="flex gap-2"><button onClick={()=>setOptions([])} className="text-[10px] text-red-500 hover:underline">ล้างค่า</button></div>
          </div>
          <div className="flex gap-2 mb-4">
             <input value={newOption} onChange={(e)=>setNewOption(e.target.value)} placeholder="เพิ่มชื่อร้านเอง..." className="flex-1 bg-slate-50 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-orange-300"/>
             <button onClick={addOption} disabled={!newOption.trim()} className="bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-lg"><Plus size={16}/></button>
          </div>
          {options.length > 0 ? (
             <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
               {options.map((opt, i) => {
                 const isActive = activeOptions.includes(opt);
                 return (
                   <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${isActive ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-50 border-transparent text-slate-300 line-through'}`}>
                     {opt} <button onClick={()=>removeOption(opt)} className="hover:text-red-500"><Trash2 size={10}/></button>
                   </span>
                 )
               })}
             </div>
          ) : (
            <div className="text-center py-6 text-slate-300 text-xs">ยังไม่มีร้านค้าในระบบ</div>
          )}
        </div>
      </main>
    </div>
  );
};

// --- Main Container (Orchestrator) ---
const App = () => {
  const [appState, setAppState] = useState('welcome'); 
  const [userProfile, setUserProfile] = useState(null);
  
  // 🟢 แก้ตรงนี้: ใส่ Key ของคุณลงไปในเครื่องหมายคำพูดได้เลยครับ
  const [apiKeys, setApiKeys] = useState({ 
    googleMaps: 'ใส่_GOOGLE_MAPS_KEY_ของคุณตรงนี้', 
    gemini: 'ใส่_GEMINI_KEY_ของคุณตรงนี้' 
  });

  const handleStart = () => setAppState('quiz');
  const handleQuizFinish = (answers) => { setUserProfile(answers); setAppState('app'); };
  const handleRetake = () => setAppState('quiz');
  const handleUpdateKeys = (newKeys) => setApiKeys(newKeys);

  if (appState === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center border border-slate-100">
          <div className="inline-flex p-4 bg-orange-100 text-orange-600 rounded-full mb-6"><ChefHat size={48} /></div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">กินไรดี?</h1>
          <p className="text-slate-500 mb-8">ก่อนจะสุ่ม ขอสำรวจความหิวและรสนิยมของคุณหน่อย เพื่อให้เราเลือกเมนูได้ถูกใจที่สุด</p>
          <button onClick={handleStart} className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-500/30 hover:scale-105 transition-transform flex items-center justify-center gap-2">เริ่มทำแบบทดสอบ <ArrowRight /></button>
        </div>
      </div>
    );
  }

  if (appState === 'quiz') return <PreferenceQuiz onFinish={handleQuizFinish} />;
  return <FoodRandomizerApp userProfile={userProfile} onRetakeQuiz={handleRetake} apiKeys={apiKeys} onUpdateKeys={handleUpdateKeys} />;
};

export default App;