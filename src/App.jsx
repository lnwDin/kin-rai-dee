import React, { useState, useRef } from 'react';
import { Utensils, Plus, Trash2, RefreshCw, ChefHat, Sparkles, Dices, MapPin, Settings, X, AlertCircle, Youtube, Play } from 'lucide-react';

const FoodRandomizer = () => {
  const [options, setOptions] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [result, setResult] = useState(null);
  const [recommendedMenu, setRecommendedMenu] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayedOption, setDisplayedOption] = useState("วันนี้กินไรดี?");
  const [showFilters, setShowFilters] = useState(false);
  const [exclusions, setExclusions] = useState([]);
  const [exclusionInput, setExclusionInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const optionsListRef = useRef(null);

  const mockNearbyPlaces = [
    "ร้านป้าเล็กตามสั่ง (100 ม.)", "ก๋วยเตี๋ยวต้มยำปากซอย (250 ม.)", "ข้าวมันไก่เจ๊อ้วน (300 ม.)",
    "ส้มตำหน้าเซเว่น (50 ม.)", "ราดหน้ายอดผัก (500 ม.)", "ข้าวขาหมูบางหว้า (1.2 กม.)",
    "ร้านอาหารญี่ปุ่นซอย 8 (800 ม.)", "พิซซ่าเตาถ่าน (1.5 กม.)", "หมูปิ้งนมสด (20 ม.)",
    "โจ๊กเปิดหม้อ (400 ม.)", "สุกี้ตี๋น้อย (2 กม.)", "ร้านลาบยโส (600 ม.)",
    "ไก่ย่างวิเชียรบุรี (1 กม.)", "ก๋วยจั๊บญวนคุณยาย (700 ม.)"
  ];

  const getMenuForShop = (shopName, currentExclusions = []) => {
    const menus = {
      noodle: ["เส้นเล็กต้มยำ", "หมี่ขาวน้ำใส", "เล็กแห้งไม่งอก", "บะหมี่เกี๊ยวหมูแดง", "เส้นใหญ่เย็นตาโฟ", "มาม่าต้มยำ", "เกาเหลาข้าวเปล่า", "ผัดไทยกุ้งสด"],
      somtum: ["ตำไทยไข่เค็ม", "ตำปูปลาร้า", "ลาบหมู", "น้ำตกหมู", "ไก่ย่างข้าวเหนียว", "ซุปหน่อไม้", "ต้มแซ่บกระดูกอ่อน", "ยำวุ้นเส้น"],
      rice: ["ข้าวกะเพราหมูสับไข่ดาว", "ข้าวผัดหมู", "ข้าวหมูกระเทียม", "ข้าวคะน้าหมูกรอบ", "พริกแกงไก่ราดข้าว", "ข้าวไข่เจียวหมูสับ", "ผัดพริกเผาทะเล", "หมูทอดกระเทียม"],
      japanese: ["ข้าวหน้าเนื้อ", "ราเมง", "ซูชิเซ็ต", "ข้าวแกงกะหรี่", "แซลมอนดอง", "ข้าวหน้าหมูทอด", "ทาโกยากิ", "ข้าวปั้น"],
      fastfood: ["เบอร์เกอร์เนื้อ", "ไก่ทอด", "เฟรนช์ฟรายส์", "นักเก็ต", "พิซซ่าหน้าฮาวายเอี้ยน", "สปาเก็ตตี้"],
      shabu: ["ชุดหมูสไลด์", "ชุดเนื้อวากิว", "ชุดรวมมิตรทะเล", "ชุดผักรวม", "หมี่หยกเป็ดย่าง"],
      general: ["ข้าวไข่เจียว", "สุกี้แห้ง/น้ำ", "มาม่าผัดขี้เมา", "ราดหน้าหมูหมัก", "ผัดซีอิ๊ว", "ข้าวต้มหมู", "ยำมาม่า"]
    };
    let targetList = menus.general;
    if (shopName.includes("ก๋วยเตี๋ยว") || shopName.includes("บะหมี่") || shopName.includes("ก๋วยจั๊บ") || shopName.includes("ผัดไทย")) targetList = menus.noodle;
    else if (shopName.includes("ส้มตำ") || shopName.includes("ลาบ") || shopName.includes("ไก่ย่าง") || shopName.includes("ยำ")) targetList = menus.somtum;
    else if (shopName.includes("ญี่ปุ่น") || shopName.includes("ซูชิ") || shopName.includes("ราเมง")) targetList = menus.japanese;
    else if (shopName.includes("ตามสั่ง") || shopName.includes("ป้า") || shopName.includes("เจ๊") || shopName.includes("ลุง") || shopName.includes("ข้าว")) targetList = menus.rice;
    else if (shopName.includes("พิซซ่า") || shopName.includes("เบอร์เกอร์") || shopName.includes("ไก่ทอด")) targetList = menus.fastfood;
    else if (shopName.includes("หมูกระทะ") || shopName.includes("สุกี้") || shopName.includes("ชาบู") || shopName.includes("จุ่ม")) targetList = menus.shabu;

    const validMenus = targetList.filter(m => {
       if (currentExclusions.length === 0) return true;
       return !currentExclusions.some(ex => m.includes(ex));
    });
    if (validMenus.length === 0) return "เมนูพิเศษ (หมดตัวเลือก)";
    return validMenus[Math.floor(Math.random() * validMenus.length)];
  };

  const activeOptions = options.filter(opt => {
    if (exclusions.length === 0) return true;
    return !exclusions.some(excludeWord => opt.includes(excludeWord));
  });

  const addOption = (e) => {
    e.preventDefault();
    if (newOption.trim()) { setOptions([...options, newOption.trim()]); setNewOption(""); }
  };
  const removeOption = (optionToRemove) => { setOptions(options.filter((opt) => opt !== optionToRemove)); };
  const addExclusion = (e) => {
    e.preventDefault();
    if (exclusionInput.trim() && !exclusions.includes(exclusionInput.trim())) { setExclusions([...exclusions, exclusionInput.trim()]); setExclusionInput(""); }
  };
  const removeExclusion = (exToRemove) => { setExclusions(exclusions.filter(ex => ex !== exToRemove)); };

  const handleFetchNearby = () => {
    setIsLocating(true); setDisplayedOption("กำลังสแกนพื้นที่..."); setResult(null); setRecommendedMenu(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setTimeout(() => {
            const shuffled = [...mockNearbyPlaces].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 5); 
            setOptions(prev => { const uniqueNew = selected.filter(s => !prev.includes(s)); return [...prev, ...uniqueNew]; });
            setIsLocating(false); setDisplayedOption("เจอแหล่งอาหารแล้ว!");
          }, 1500);
        },
        (error) => { alert("ไม่สามารถระบุตำแหน่งได้"); setIsLocating(false); setDisplayedOption("หาไม่เจอ"); }
      );
    } else { alert("เบราว์เซอร์ไม่รองรับ GPS"); setIsLocating(false); }
  };

  const handleRandomize = () => {
    if (activeOptions.length === 0) return;
    setIsSpinning(true); setResult(null); setRecommendedMenu(null); setShowFilters(false);
    let counter = 0; const maxShuffles = 25; const speed = 80;
    const intervalId = setInterval(() => {
      const randomShopIndex = Math.floor(Math.random() * activeOptions.length);
      const tempShop = activeOptions[randomShopIndex];
      const tempMenu = getMenuForShop(tempShop, exclusions);
      setDisplayedOption(tempMenu);
      counter++;
      if (counter > maxShuffles) {
        clearInterval(intervalId);
        const finalShopIndex = Math.floor(Math.random() * activeOptions.length);
        const finalShop = activeOptions[finalShopIndex];
        const finalMenu = getMenuForShop(finalShop, exclusions);
        setResult(finalShop); setRecommendedMenu(finalMenu); setDisplayedOption(finalMenu); setIsSpinning(false);
      }
    }, speed);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-orange-200 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-600"><ChefHat size={28} strokeWidth={2.5} /><h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">กินไรดี <span className="text-orange-600">Kin Rai Dee</span></h1></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-full transition-colors relative ${showFilters || exclusions.length > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Settings size={20} />{exclusions.length > 0 && (<span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>)}</button>
            <div className="text-xs font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{activeOptions.length} แหล่ง</div>
          </div>
        </div>
        {showFilters && (
          <div className="bg-orange-50/50 border-b border-orange-100 animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-3xl mx-auto px-4 py-4"><h3 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2"><AlertCircle size={16} />ไม่กินอะไรพิมพ์บอกได้ (Filter)</h3><form onSubmit={addExclusion} className="flex gap-2"><input type="text" value={exclusionInput} onChange={(e) => setExclusionInput(e.target.value)} placeholder="เช่น เผ็ด, ปลาร้า, เครื่องใน..." className="flex-1 px-3 py-2 rounded-lg border border-orange-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /><button type="submit" className="px-4 py-2 bg-orange-200 text-orange-800 rounded-lg text-sm font-bold hover:bg-orange-300">ไม่เอา</button></form>{exclusions.length > 0 && (<div className="mt-3 flex flex-wrap gap-2">{exclusions.map((ex, idx) => (<span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium border border-red-200">ไม่เอา "{ex}"<button onClick={() => removeExclusion(ex)} className="hover:text-red-900"><X size={12}/></button></span>))}</div>)}</div>
          </div>
        )}
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 mb-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-red-500 to-orange-400"></div>
          <div className="mb-4 flex justify-center text-orange-500 opacity-20">{activeOptions.length === 0 ? <MapPin size={80} /> : <Utensils size={80} />}</div>
          <div className="relative z-10 -mt-16">
            <h2 className="text-sm uppercase tracking-widest text-slate-400 font-bold mb-4">{result ? "มื้อนี้กิน..." : "หิวหรือยัง?"}</h2>
            <div className={`min-h-[8rem] flex flex-col items-center justify-center transition-all duration-100 mb-6 ${isSpinning ? 'text-slate-400 blur-[1px]' : 'text-slate-800'}`}>
              {result && recommendedMenu && !isSpinning ? (
                <div className="animate-in zoom-in duration-300 flex flex-col items-center w-full">
                   <div className="text-4xl md:text-6xl font-black text-slate-800 mb-4 drop-shadow-sm leading-tight break-words max-w-full">{recommendedMenu}</div>
                   <div className="flex flex-col md:flex-row items-center gap-2 text-slate-500 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 mb-6"><span className="text-sm">พิกัดร้าน:</span><span className="font-bold text-orange-600 flex items-center gap-1"><MapPin size={14}/> {result}</span></div>
                   <div className="w-full max-w-md mx-auto animate-in slide-in-from-bottom-4 duration-700">
                      <div className="relative group rounded-xl overflow-hidden shadow-xl border-4 border-white bg-slate-900 aspect-video">
                        <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"><Youtube size={12} fill="white" /> ยั่วน้ำลาย</div>
                        <iframe width="100%" height="100%" src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("เมนู " + recommendedMenu + " น่ากิน asmr street food")}&autoplay=1&mute=1&controls=1&loop=1`} title="YouTube video player" className="w-full h-full object-cover" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1"><Play size={10} className="fill-slate-400"/> เมนูนี้หน้าตาเป็นแบบนี้แหละ (YouTube)</p>
                   </div>
                </div>
              ) : (<div className="text-3xl md:text-5xl font-black text-slate-700">{displayedOption}</div>)}
            </div>
            {activeOptions.length === 0 ? (
              <button onClick={handleFetchNearby} disabled={isLocating} className={`group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-lg font-bold text-white rounded-full w-full md:w-auto shadow-lg hover:shadow-blue-500/30 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0`}>{isLocating ? <RefreshCw className="animate-spin" /> : <MapPin className="animate-bounce" />}{isLocating ? "กำลังสแกนร้าน..." : "ค้นหาร้านใกล้ฉัน (GPS)"}</button>
            ) : (
              <div className="flex flex-col gap-3 items-center">
                <button onClick={handleRandomize} disabled={isSpinning} className={`group relative inline-flex items-center justify-center gap-3 px-10 py-5 text-xl font-bold text-white rounded-full w-full md:w-auto transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0 shadow-xl hover:shadow-orange-500/40 ${isSpinning ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-600'}`}>{isSpinning ? (<RefreshCw className="animate-spin" />) : (<Dices className="group-hover:rotate-12 transition-transform" />)}{isSpinning ? "กำลังนึก..." : "สุ่มเมนูเลย!"}</button>
                {!isSpinning && (<button onClick={handleFetchNearby} className="text-xs text-slate-400 hover:text-blue-500 font-medium flex items-center gap-1 mt-4"><RefreshCw size={12} /> รีเซ็ต/หาตำแหน่งใหม่</button>)}
              </div>
            )}
            {result && !isSpinning && (<div className="mt-8"><span className="inline-flex items-center gap-2 px-5 py-2 bg-green-100 text-green-700 rounded-full text-sm font-bold shadow-sm cursor-default"><Sparkles size={16} />เมนูนี้เด็ด ต้องจัด!</span></div>)}
          </div>
        </div>
        <div className="grid md:grid-cols-5 gap-6 opacity-80 hover:opacity-100 transition-opacity">
          <div className="md:col-span-2 space-y-4"><div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 h-full flex flex-col"><h3 className="font-bold text-slate-600 mb-2 flex items-center gap-2 text-sm"><Plus size={16} />เพิ่มร้านเอง</h3><form onSubmit={addOption} className="space-y-2"><input type="text" value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="ชื่อร้าน..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" /><button type="submit" disabled={!newOption.trim()} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors">เพิ่ม</button></form></div></div>
          <div className="md:col-span-3"><div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 h-full flex flex-col"><div className="flex items-center justify-between mb-2"><h3 className="font-bold text-slate-600 text-sm">แหล่งอาหารในพื้นที่ ({activeOptions.length})</h3><button onClick={() => setOptions([])} className="text-[10px] text-red-400 hover:text-red-600">ล้างค่า</button></div>{options.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-4"><p className="text-xs">ยังไม่มีร้าน (กดปุ่มฟ้าด้านบนเพื่อสแกน)</p></div>) : (<ul className="space-y-1 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar flex-1" ref={optionsListRef}>{options.map((opt, idx) => {const isExcluded = !activeOptions.includes(opt);return (<li key={idx} className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs ${isExcluded ? 'bg-slate-50 text-slate-400' : 'bg-slate-50 text-slate-600'}`}><span className={isExcluded ? 'line-through' : ''}>{opt}</span><button onClick={() => removeOption(opt)} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button></li>);})}</ul>)}</div></div>
        </div>
      </main>
    </div>
  );
};
export default FoodRandomizer;