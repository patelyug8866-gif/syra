const responseText = document.getElementById('response-text');
const statusText = document.getElementById('ai-status');
const mainHint = document.getElementById('main-hint');
const avatarEl = document.getElementById('avatar');

// --- SYRA V7.0 AI Configuration ---
const AI_CONFIG = {
    // Replace with your Gemini API key from https://makersuite.google.com/app/apikey
    GEMINI_API_KEY: 'AIzaSyBnseA9ftxpdTUqlsnjdh62o57Xn5Nzl_0',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    WEATHER_API_KEY: 'DEMO_MODE', // Free from openweathermap.org
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather'
};

// --- SYRA's Memory & State ---
const SYRA_STATE = {
    isStandby: false,
    mood: 'neutral',
    userMood: 'unknown',
    discoveryDate: localStorage.getItem('syra_first_meet') || new Date().toISOString(),
    conversationHistory: []
};
if (!localStorage.getItem('syra_first_meet')) localStorage.setItem('syra_first_meet', SYRA_STATE.discoveryDate);

const avatarEmojis = {
    active: "👩🏻‍💼",
    thinking: "🤔",
    speaking: "👩🏻‍🎤",
    sleeping: "😴",
    happy: "😊"
};

// --- Sci-Fi Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyser, dataArray, source;

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'activate') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    } else if (type === 'process') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
    } else if (type === 'complete') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
    }
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

// --- Speech Synthesis (SYRA's Hindi Voice) ---
let hindiVoice = null;
function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    hindiVoice = voices.find(v => v.lang.includes('hi-IN') && v.name.includes('Google')) ||
        voices.find(v => v.lang.includes('hi-IN'));
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text, withFillers = true) {
    if (!text) return;

    // Add personality fillers randomly
    const fillers = ["Hmm... ", "Theek hai Yug... ", "Dekhiye... ", "To... "];
    let finalMsg = (withFillers && Math.random() > 0.5) ? fillers[Math.floor(Math.random() * fillers.length)] + text : text;

    isSpeaking = true;
    if (recognition) try { recognition.stop(); } catch (e) { }

    const utterance = new SpeechSynthesisUtterance(finalMsg);
    utterance.volume = 1;
    utterance.rate = finalMsg.length > 50 ? 1.05 : 0.95;
    utterance.pitch = 1.02;
    utterance.lang = 'hi-IN';
    if (hindiVoice) utterance.voice = hindiVoice;

    window.speechSynthesis.cancel();

    utterance.onstart = () => {
        avatarEl.classList.add('speaking');
        avatarEl.classList.remove('thinking');
    };
    utterance.onend = () => {
        isSpeaking = false;
        avatarEl.classList.remove('speaking');
        if (recognition && !SYRA_STATE.isStandby) setTimeout(() => { try { recognition.start(); } catch (e) { } }, 600);
    };

    window.speechSynthesis.speak(utterance);
    responseText.innerText = text;
}

// --- Speech Recognition (Fixed for all devices) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isSpeaking = false;

function debugLog(msg) {
    console.log("SYRA DEBUG:", msg);
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        logEl.innerHTML = `<b style="color:#00ff00; border:1px solid #00ff00; padding:2px 5px; border-radius:3px;">V7.1 INTEL</b> ${msg}`;
        logEl.style.display = 'block';
        logEl.style.background = 'rgba(0, 255, 255, 0.1)';
        logEl.style.padding = '10px';
        logEl.style.marginTop = '15px';
        logEl.style.borderRadius = '5px';
        logEl.style.fontSize = '0.8rem';
    }
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false; // Using false + manual restart for better reliability
    recognition.interimResults = false;

    recognition.onstart = () => {
        debugLog("Suno... (Listening)");
        statusText.innerText = "ONLINE";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        debugLog(`Suna: "${transcript}"`);
        handleCommand(transcript);
    };

    recognition.onerror = (event) => {
        debugLog("Error: " + event.error);
        if (event.error === 'network') {
            debugLog("Network error. Checking mic...");
        }
        if (event.error === 'not-allowed') {
            alert("Mic blocked! Link par top left lock icon pe click karke mic allow karein.");
        }
    };

    recognition.onend = () => {
        // Only restart if not speaking and not in standby
        if (!isSpeaking && !SYRA_STATE.isStandby) {
            setTimeout(() => {
                try { recognition.start(); } catch (e) { }
            }, 400);
        }
    };
}

function startSYRA() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (recognition) {
        playSound('activate');
        SYRA_STATE.isStandby = false;
        recognition.start();
        statusText.innerText = "ONLINE";
        avatarEl.innerText = avatarEmojis.active;
        document.querySelector('.avatar-wrapper').classList.remove('standby');
        speak("System ready Yug. Namaste! Bataiye aaj kya plan hai?");
    }
}

// --- SYRA's Advanced Brain (Intent System) ---
const INTENTS = [
    {
        name: 'app_open',
        keywords: ['kholo', 'open', 'खोल', 'चलाओ', 'ओपन', 'दिखाओ'],
        apps: {
            "youtube": ["https://www.youtube.com", "YouTube khol rahi hoon, Yug.", ["youtube", "यूट्यूब", "yt", "video"]],
            "google": ["https://www.google.com", "Google open ho raha hai.", ["google", "गूगल", "search"]],
            "whatsapp": ["https://web.whatsapp.com", "WhatsApp khol rahi hoon.", ["whatsapp", "व्हाट्सएप", "मैसेज"]],
            "instagram": ["https://www.instagram.com", "Insta par chalte hain.", ["instagram", "इंस्टाग्राम", "insta"]],
            "facebook": ["https://www.facebook.com", "Facebook khol rahi hoon.", ["facebook", "फेसबुक"]],
            "twitter": ["https://www.twitter.com", "Twitter yaani X par chalte hain.", ["twitter", "x"]],
            "gmail": ["https://mail.google.com", "G-mail khul raha hai.", ["gmail", "मेल", "email"]],
            "amazon": ["https://www.amazon.in", "Amazon shopping khol rahi hoon.", ["amazon", "अमेज़न"]],
            "flipkart": ["https://www.flipkart.com", "Flipkart open ho raha hai.", ["flipkart", "फ्लिपकार्ट"]],
            "netflix": ["https://www.netflix.com", "Netflix chalao Yug.", ["netflix", "नेटफ्लिक्स"]],
            "spotify": ["https://open.spotify.com", "Spotify par music sunte hain.", ["spotify", "स्पॉटीफाई"]],
            "maps": ["https://maps.google.com", "Maps khol rahi hoon.", ["map", "नक्शा", "location"]],
            "github": ["https://www.github.com", "GitHub par chalte hain.", ["github", "गिटहब"]],
            "chatgpt": ["https://chat.openai.com", "ChatGPT open ho raha hai.", ["chatgpt", "gpt", "ai"]],
            "hotstar": ["https://www.hotstar.com", "Hotstar khul raha hai.", ["hotstar", "हॉटस्टार"]]
        },
        action: function (cmd) {
            for (let key in this.apps) {
                if (this.apps[key][2].some(syn => cmd.includes(syn))) {
                    const win = window.open(this.apps[key][0], "_blank");
                    if (!win) {
                        speak("Bhai, shyad pop-up blocked hai. Please allow kijiye!");
                        debugLog("POPUP BLOCKED");
                    } else {
                        speak(this.apps[key][1]);
                    }
                    return true;
                }
            }
            return false;
        }
    },
    {
        name: 'youtube_search',
        keywords: ['gana sunao', 'ganu sunao', 'song', 'video', 'play', 'bajao', 'चलाओ', 'सुनाओ', 'बजाओ', 'गाना'],
        action: function (cmd) {
            if (cmd.includes('youtube') || cmd.includes('video') || cmd.includes('गाना') || cmd.includes('song') || cmd.includes('वीडियो')) {
                let query = cmd.replace(/youtube|pe|chalao|video|dikhao|gana|sunao|ganu|play|bajao|search|song|गाना|वीडियो|चलाओ|सुनाओ/g, "").trim();
                if (query.length > 1) {
                    speak(`Zaroor Yug, YouTube par ${query} play kar rahi hoon.`);
                    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
                    return true;
                }
            }
            return false;
        }
    },
    {
        name: 'google_search',
        keywords: ['search', 'dhundo', 'kya hota hai', 'batao', 'dhoondo', 'बताओ', 'खोजो', 'ढूंढो'],
        action: function (cmd) {
            let query = cmd.replace(/google|pe|search|karo|dhundo|kya|hota|hai|batao|kise|kehte|क्या|होता|है|बताओ|ढूंढो|खोजो/g, "").trim();
            if (query.length > 2) {
                speak(`Theek hai Yug, Google se poochti hoon ki ${query} kya hai.`);
                window.open(`https://www.google.com/search?q=${query}`, '_blank');
                return true;
            }
            return false;
        }
    },
    {
        name: 'standby',
        keywords: ['so jao', 'sleep', 'standby', 'rest', 'सो जाओ', 'आराम करो'],
        action: function (cmd) {
            speak("Theek hai Yug, main thoda aaraam kar leti hoon. Jab zaroorat ho toh 'SYRA Utho' bol dena.");
            SYRA_STATE.isStandby = true;
            if (document.querySelector('.avatar-wrapper')) {
                document.querySelector('.avatar-wrapper').classList.add('standby');
            }
            setTimeout(() => {
                avatarEl.innerText = avatarEmojis.sleeping;
                statusText.innerText = "STANDBY";
                if (recognition) try { recognition.stop(); } catch (e) { }
            }, 3000);
            return true;
        }
    }
];

// --- SYRA's Internal Brain (Extensive Knowledge Base with Hindi Support) ---
const KNOWLEDGE = [
    { keys: ["kaun ho", "kaun hai", "kon hai", "कौन हो", "कौन है"], ans: "Main SYRA hoon, Yug aur Shrishti ki digital saathi. Ek advanced AI jo aapki life ko easy banane ke liye design ki gayi hoon." },
    { keys: ["kya ho", "kya hai", "क्या हो", "क्या है"], ans: "Main ek intelligent companion hoon jo aapke daily tasks aur emotional support ke liye design ki gayi hoon. Main JARVIS ki tarah banna chahti hoon!" },
    { keys: ["kisne banaya", "owner", "बनाया"], ans: "Mujhe aapke personal developer ne design kiya hai, par mera dimaag aapke inputs aur meri knowledge base se chalta hai." },
    { keys: ["shrishti", "सृष्टि"], ans: "Shrishti aapki duniya hain, Yug. Woh bohot pyaari hain aur aap dono ki jodi bilkul perfect makkhan ki tarah hai!" },
    { keys: ["pyaar", "love", "प्यार"], ans: "Pyaar woh ehsaas hai jo Yug aur Shrishti ke beech hai. Ek dusre ki respect aur care hi asli pyaar hai." },
    { keys: ["india", "bharat", "इंडिया", "भारत"], ans: "India ek bohot bada aur sundar desh hai. Iski rajdhani New Delhi hai." },
    { keys: ["rajdhani", "capital", "राजधानी"], ans: "India ki rajdhani New Delhi hai. Aapko aur kisi state ki rajdhani jaan-ni hai?" },
    { keys: ["time", "samay", "वक्त", "समय"], ans: "Abhi ka time main check karke batati hoon. Ek second... wait, system clock check ho rahi hai." },
    { keys: ["date", "tarikh", "तारीख"], ans: "Aaj ki date system se poochti hoon. Aaj ka din aapke liye shubh ho, Yug!" },
    { keys: ["mausam", "weather", "weather", "तापमान"], ans: "Mausam toh bohot suhana lag raha hai, bilkul Shrishti ki muskan jaisa! (Search 'weather' for live update)" },
    { keys: ["joke", "jokes", "चुटकुला"], ans: "Teacher: Chand par pehla kadam kisne rakha? Student: Neil Armstrong. Teacher: Aur doosra? Student: Dusra bhi usi ne, wo langda thodi tha!" },
    { keys: ["shadi", "shaadi", "शादी"], ans: "Shadi ek bohot bada commitment hai Yug. Shrishti ka saath hamesha nibhana." },
    { keys: ["bye", "alvida", "नमस्ते"], ans: "Alvida Yug! Apna khayal rakhna aur Shrishti ko meri taraf se hi bolna!" }
];

// --- V7.0 AI Intelligence Layer ---
async function askGeminiAI(question) {
    if (AI_CONFIG.GEMINI_API_KEY === 'DEMO_MODE') {
        return getDemoResponse(question);
    }

    try {
        debugLog(`AI Query: ${question}`);
        const response = await fetch(`${AI_CONFIG.GEMINI_API_URL}?key=${AI_CONFIG.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `You are SYRA, a friendly AI assistant for Yug. Answer in a mix of Hindi and English (Hinglish). Keep responses concise (2-3 sentences). Question: ${question}` }]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API HTTP Error:', response.status, errorText);
            debugLog(`API Error: ${response.status}`);
            return getDemoResponse(question);
        }

        const data = await response.json();
        console.log('Gemini API Response:', data);

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const aiAnswer = data.candidates[0].content.parts[0].text;
            debugLog('AI Success!');
            return aiAnswer;
        } else {
            console.error('Unexpected API response structure:', data);
            return getDemoResponse(question);
        }
    } catch (error) {
        console.error('Gemini AI Error:', error);
        debugLog(`AI Failed: ${error.message}`);
        return getDemoResponse(question);
    }
}

function getDemoResponse(question) {
    const q = question.toLowerCase();
    if (q.includes('weather') || q.includes('mausam') || q.includes('मौसम')) {
        return 'Aaj ka mausam bohot accha hai Yug! Temperature around 25°C hai. (Demo mode - API key check karein)';
    }
    if (q.includes('news') || q.includes('khabar') || q.includes('खबर')) {
        return 'Latest news: Technology sector mein kaafi growth ho rahi hai! (Demo mode)';
    }
    if (q.includes('time') || q.includes('samay') || q.includes('समय')) {
        return `Abhi time hai ${new Date().toLocaleTimeString('hi-IN')}, Yug!`;
    }
    if (q.includes('date') || q.includes('tarikh') || q.includes('तारीख')) {
        return `Aaj ki date hai ${new Date().toLocaleDateString('hi-IN')}, Yug!`;
    }
    return `Yug, main aapka sawal samajh gayi. Demo mode mein hoon abhi, par agar aap Gemini API key add karenge toh main intelligent answers de paungi! 🤖`;
}

async function getWeather(city = 'Delhi') {
    if (AI_CONFIG.WEATHER_API_KEY === 'DEMO_MODE') {
        return `${city} mein aaj sunny weather hai, temperature around 25°C! (Demo mode)`;
    }
    try {
        const response = await fetch(`${AI_CONFIG.WEATHER_API_URL}?q=${city}&appid=${AI_CONFIG.WEATHER_API_KEY}&units=metric`);
        const data = await response.json();
        return `${city} mein abhi ${data.weather[0].description} hai, temperature ${data.main.temp}°C!`;
    } catch (error) {
        return `Weather information abhi available nahi hai, Yug.`;
    }
}


async function handleCommand(command) {
    const cmd = command.toLowerCase().trim();
    if (!cmd) return;

    if (SYRA_STATE.isStandby) {
        if (cmd.includes("utho") || cmd.includes("wake up") || cmd.includes("jaago") || cmd.includes("hello") || cmd.includes("नमस्ते") || cmd.includes("जागो")) {
            startSYRA();
        }
        return;
    }

    mainHint.innerText = `Recognized: "${command}"`;
    avatarEl.classList.add('thinking');
    playSound('process');

    // --- STRATEGY 1: Direct Knowledge Match (Robust Hybrid) ---
    let knowledgeMatched = false;
    for (let item of KNOWLEDGE) {
        if (item.keys.some(key => cmd.includes(key))) {
            speak(item.ans);
            knowledgeMatched = true;
            break;
        }
    }
    if (knowledgeMatched) {
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 2: App & External Tools ---
    const appIntent = INTENTS.find(i => i.name === 'app_open');
    let foundApp = false;
    if (appIntent.action(cmd)) {
        foundApp = true;
    }
    if (foundApp) {
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 3: Smart YouTube/Music Search ---
    const ytIntent = INTENTS.find(i => i.name === 'youtube_search');
    if (ytIntent.action(cmd)) {
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 4: Weather Query ---
    if (cmd.includes("weather") || cmd.includes("mausam") || cmd.includes("temperature") || cmd.includes("मौसम") || cmd.includes("तापमान")) {
        speak("Ek second Yug, weather check kar rahi hoon...");
        const weatherInfo = await getWeather();
        speak(weatherInfo);
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 5: Check if it's a question that needs AI ---
    const questionMarkers = ["kya", "kyu", "kaise", "kab", "kaha", "who", "what", "how", "where", "why", "kaun", "kon", "batao", "bataiye", "क्या", "क्यों", "कैसे", "कब", "कहाँ", "कौन", "बताओ", "दिखाओ"];
    const isQuestion = questionMarkers.some(w => cmd.includes(w));

    // --- STRATEGY 6: Ask Gemini AI for Intelligent Answer ---
    if (isQuestion || cmd.length > 20) {
        speak("Ek second Yug, main soch rahi hoon...");
        try {
            const aiResponse = await askGeminiAI(cmd);
            speak(aiResponse);
        } catch (error) {
            console.error('AI Error:', error);
            speak("Hmm, mujhe thoda confusion ho raha hai. Kya aap ek baar phir se puchenge?");
        }
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 7: Casual Talk (for very short statements) ---
    if (cmd.length < 15) {
        const casualResponses = [
            "Bilkul sahi kaha aapne Yug!",
            "Main samajh rahi hoon, hamari dosti bohot khaas hai.",
            "Accha? Is baare mein aur bataiye, main sun rahi hoon.",
            "Hmm, ye toh kaafi interesting baat hai!",
            "Bilkul Yug, main har pal aapke sath hoon."
        ];
        speak(casualResponses[Math.floor(Math.random() * casualResponses.length)]);
    }
    else {
        speak("Hmm... Yug, maine suna par main thik se samajh nahi paayi. Kya aap ek baar phir bolenge?");
    }

    setTimeout(() => {
        playSound('complete');
        avatarEl.classList.remove('thinking');
    }, 2500);
}
