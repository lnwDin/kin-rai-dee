// netlify/functions/gemini-proxy.js
const axios = require('axios'); // ต้องลง axios หรือใช้ fetch ของ node

exports.handler = async (event, context) => {
  // รับข้อมูลที่ส่งมาจากหน้าบ้าน (App.jsx)
  const body = JSON.parse(event.body);
  const { prompt, generationConfig } = body;

  // ดึง API Key จากระบบของ Netlify (เราจะไปตั้งค่าในเว็บทีหลัง)
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: generationConfig
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};