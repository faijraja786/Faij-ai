async function sendToAI(userMessage) {
  // अगर आपने पहले से कोई बातचीत (chat history) सेव कर रखी है, तो उसे array में भेजें।
  // यहाँ हम केवल यूजर का लेटेस्ट मैसेज भेज रहे हैं:
  const messages = [
    { role: "user", content: userMessage }
  ];

  try {
    // यहाँ अपना Render वाला लाइव URL डालें (जो अभी टेस्ट किया था)
    const RENDER_URL = "https://faij-ai.onrender.com/api/chat";

    const response = await fetch(RENDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages })
    });

    const data = await response.json();

    if (!response.ok) {
      // अगर सर्वर से कोई एरर आया हो
      throw new Error(data.error || "AI से संपर्क करने में समस्या आ रही है।");
    }

    // backend से आने वाला { reply: "..." } रिस्पॉन्स रिटर्न करें
    return data.reply;

  } catch (error) {
    console.error("Frontend Chat Error:", error);
    return "माफ़ कीजिए, अभी AI सर्वर से जवाब नहीं मिल पा रहा है। कृपया कुछ देर बाद कोशिश करें।";
  }
}
