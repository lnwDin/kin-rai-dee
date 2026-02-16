// netlify/functions/gemini-proxy.js

exports.handler = async (event) => {
  // รองรับเฉพาะ POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // ดึงข้อมูลที่ส่งมาจาก App.jsx
    const { payload } = JSON.parse(event.body);
    
    // ดึงคีย์ทั้งหมดจาก Netlify Environment Variables มาแยกเป็น Array
    // รูปแบบคีย์ในระบบ: key1,key2,key3
    const keysPool = process.env.GEMINI_API_KEY 
      ? process.env.GEMINI_API_KEY.split(',').map(k => k.trim()) 
      : [];

    if (keysPool.length === 0) {
      console.error("DEBUG: No API Keys found in Environment Variables!");
      return { statusCode: 500, body: JSON.stringify({ error: "No API Keys Configured" }) };
    }

    // ระบบสลับคีย์ (Rotation Logic)
    for (let i = 0; i < keysPool.length; i++) {
      const currentKey = keysPool[i];
      
      try {
        console.log(`DEBUG: Trying Key ${i + 1} of ${keysPool.length}`);
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) // ส่ง payload (contents และ generationConfig) ไปที่ Google
          }
        );

        const data = await response.json();

        // ถ้าสำเร็จ (Status 200) ให้ส่งกลับทันที
        if (response.ok) {
          return {
            statusCode: 200,
            body: JSON.stringify(data),
          };
        }

        // ถ้าคีย์นี้ Quota เต็ม หรือ Error จาก Google ให้ลองคีย์ถัดไป
        console.warn(`DEBUG: Key ${i + 1} failed with status: ${response.status}`, data);
        continue;

      } catch (err) {
        console.error(`DEBUG: Network error with Key ${i + 1}:`, err.message);
        continue;
      }
    }

    // ถ้าลองครบทุกคีย์แล้วพังหมด
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "All API keys failed or quota exceeded" }),
    };

  } catch (error) {
    console.error("DEBUG: Global Proxy Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};