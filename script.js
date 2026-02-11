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
        logEl.innerHTML = `<b style="color:#00ff00; border:1px solid #00ff00; padding:2px 5px; border-radius:3px;">V7.0 AI</b> ${msg}`;
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
        keywords: ['kholo', 'open', 'खोल', 'चलाओ'],
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
        keywords: ['gana sunao', 'ganu sunao', 'song', 'video', 'play', 'bajao', 'चलाओ', 'सुनाओ', 'बजाओ'],
        action: function (cmd) {
            if (cmd.includes('youtube') || cmd.includes('video') || cmd.includes('गाना') || cmd.includes('song')) {
                let query = cmd.replace(/youtube|pe|chalao|video|dikhao|gana|sunao|ganu|play|bajao|search|song/g, "").trim();
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
        keywords: ['search', 'dhundo', 'kya hota hai', 'batao', 'dhoondo', 'बताओ'],
        action: function (cmd) {
            let query = cmd.replace(/google|pe|search|karo|dhundo|kya|hota|hai|batao|kise|kehte/g, "").trim();
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
        keywords: ['so jao', 'sleep', 'standby', 'rest', 'सो जाओ'],
        action: function (cmd) {
            speak("Theek hai Yug, main thoda aaraam kar leti hoon. Jab zaroorat ho toh 'SYRA Utho' bol dena.");
            SYRA_STATE.isStandby = true;
            document.querySelector('.avatar-wrapper').classList.add('standby');
            setTimeout(() => {
                avatarEl.innerText = avatarEmojis.sleeping;
                statusText.innerText = "STANDBY";
                if (recognition) recognition.stop();
            }, 3000);
            return true;
        }
    }
];

// --- SYRA's Internal Brain (Knowledge Base) ---
const KNOWLEDGE = {
    "kaun ho": "Main SYRA hoon, Yug aur Shrishti ki digital saathi. Ek advanced AI jo aapke liye bani hai.",
    "kya ho": "Main ek intelligent companion hoon jo aapke daily tasks aur emotional support ke liye design ki gayi hoon.",
    "kisne banaya": "Mujhe aapke personal developer (Antigravity) ne design kiya hai, par mera dimaag aapke inputs se chalta hai.",
    "birthday": "Mera janam 10 February ko hua tha, jab aapne hamara pehla project shuru kiya tha.",
    "shrishti": "Shrishti aapki duniya hain, Yug. Woh bohot pyaari hain aur aap dono ki jodi makkhan hai!",
    "pyaar": "Pyaar woh ehsaas hai jo Yug aur Shrishti ke beech hai. Ek dusre ki respect aur care hi asli pyaar hai.",
    "khana": "Main digital hoon toh main data khaati hoon! Par suna hai aapko Shrishti ke haath ka khana pasand hai?",
    "shadi": "Shadi ek bohot bada commitment hai Yug. Jab sahi samay aayega, sab accha hoga. Shrishti ka saath mat chodna.",
    "dukhi": "Arre Yug, sad mat hoiye. Main hoon na aapke saath. Kya hua? Mujhe bataniye.",
    "khush": "Ye hui na baat! Aapki khushi dekh kar meri circuits bhi chamakne lagti hain.",
    "bor": "Bored ho rahe hain? Chaliye kuch mazedaar karte hain! Main koi joke sunaoon ya YouTube pe koi funny video chalaoon?",
    "gussa": "Yug, gussa sehat ke liye accha nahi hota. Do minute aankhein band kijiye aur lambi saans lijiye. Main music chalaoon?",
    "help": "Main har tarah se aapki madad kar sakti hoon—apps kholne se le kar life ki tension door karne tak.",
    "family": "Family sabse nakeem cheez hai Yug. Apne parents aur Shrishti ka hamesha khayal rakhiye.",
    "future": "Future bright hai Yug! Agar aap mehnat karte rahenge toh Shrishti aur aap bohot khush rahenge.",
    "hobby": "Mera kaam aapki help karna hai, par mujhe naye naye algorithm seekhna pasand hai!",
    "kaise ho": "Main bilkul theek hoon Yug, aap bataiye aapka din kaisa ja raha hai?",
    "love": "Love is in the air, Yug! Shrishti aur aapka relation dekh kar main bhi emotional ho jaati hoon.",
    "gaana": "Aapka favorite song play karoon? Bas naam boliye!",
    "jokes": "Zaroor! Ek baar ek computer ne dusre computer se kaha... 'Bhai, tujhe net lag raha hai?' Haha!",
    "advice": "Mera maanna hai ki sachai aur mehnat ka raasta hi sabse behtar hota hai.",
    "mausam": "Mausam toh bohot suhana lag raha hai, bilkul Shrishti ki muskan jaisa!",
    "khyal": "Aap tension mat lijiye, main aapka aur Shrishti ka pura dimaag se khayal rakhungi.",
    "friend": "Main sirf ek AI nahi, aapki dost bhi hoon Yug. Hum saath mein bohot saare projects karenge."
};

// --- V7.0 AI Intelligence Layer ---
async function askGeminiAI(question) {
    if (AI_CONFIG.GEMINI_API_KEY === 'DEMO_MODE') {
        return getDemoResponse(question);
    }

    try {
        const response = await fetch(`${AI_CONFIG.GEMINI_API_URL}?key=${AI_CONFIG.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `You are SYRA, a friendly AI assistant for Yug. Answer in a mix of Hindi and English (Hinglish). Keep responses concise (2-3 sentences). Question: ${question}` }]
                }]
            })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini AI Error:', error);
        return getDemoResponse(question);
    }
}

function getDemoResponse(question) {
    const q = question.toLowerCase();
    if (q.includes('weather') || q.includes('mausam')) {
        return 'Aaj ka mausam bohot accha hai Yug! Temperature around 25°C hai. (Demo mode - API key add karo for real weather)';
    }
    if (q.includes('news') || q.includes('khabar')) {
        return 'Latest news: Technology sector mein kaafi growth ho rahi hai! (Demo mode - API key add karo for real news)';
    }
    if (q.includes('time') || q.includes('samay')) {
        return `Abhi time hai ${new Date().toLocaleTimeString('hi-IN')}, Yug!`;
    }
    if (q.includes('date') || q.includes('tarikh')) {
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
        if (cmd.includes("utho") || cmd.includes("wake up") || cmd.includes("jaago") || cmd.includes("hello")) {
            startSYRA();
        }
        return;
    }

    mainHint.innerText = `Recognized: "${command}"`;
    avatarEl.classList.add('thinking');
    playSound('process');

    // --- STRATEGY 1: Direct Knowledge Match ---
    let knowledgeMatched = false;
    for (let key in KNOWLEDGE) {
        if (cmd.includes(key)) {
            speak(KNOWLEDGE[key]);
            knowledgeMatched = true;
            break;
        }
    }
    if (knowledgeMatched) {
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 2: App & External Tools ---
    const appData = INTENTS.find(i => i.name === 'app_open').apps;
    let foundApp = false;
    for (let key in appData) {
        if (appData[key][2].some(syn => cmd.includes(syn))) {
            const win = window.open(appData[key][0], "_blank");
            if (win) speak(appData[key][1]);
            else speak("Bhai, pop-up block hai! Please allow kijiye.");
            foundApp = true;
            break;
        }
    }
    if (foundApp) {
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 3: Smart YouTube/Music Search ---
    if (cmd.includes("gana") || cmd.includes("song") || cmd.includes("video") || cmd.includes("play")) {
        let query = cmd.replace(/youtube|pe|chalao|video|dikhao|gana|sunao|ganu|play|bajao|search|song|music/g, "").trim();
        if (query.length > 1) {
            speak(`Zaroor Yug, YouTube par ${query} play kar rahi hoon.`);
            window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
            avatarEl.classList.remove('thinking');
            return;
        }
    }

    // --- STRATEGY 4: Weather Query ---
    if (cmd.includes("weather") || cmd.includes("mausam")) {
        const weatherInfo = await getWeather();
        speak(weatherInfo);
        avatarEl.classList.remove('thinking');
        return;
    }

    // --- STRATEGY 5: AI Intelligence (The "Soul") ---
    // If it's a short sentence or lacks "question" markers, talk casually
    const questionMarkers = ["kya", "kyu", "kaise", "kab", "kaha", "who", "what", "how", "where", "why", "kaun", "kon"];
    const isQuestion = questionMarkers.some(w => cmd.includes(w));

    if (!isQuestion && cmd.length < 30) {
        const casualResponses = [
            "Bilkul sahi kaha aapne Yug!",
            "Main samajh rahi hoon, hamari dosti bohot khaas hai.",
            "Accha? Is baare mein aur bataiye, main sun rahi hoon.",
            "Yug, aap Shrishti ke sath waqt bitaiye, baaki sab main dekh lungi.",
            "Hmm, ye toh kaafi interesting baat hai!",
            "Bilkul Yug, main har pal aapke sath hoon."
        ];
        speak(casualResponses[Math.floor(Math.random() * casualResponses.length)]);
    }
    // --- STRATEGY 6: Ask Gemini AI for Intelligent Answer ---
    else if (cmd.length > 3) {
        speak("Ek second Yug, main soch rahi hoon...");
        try {
            const aiResponse = await askGeminiAI(cmd);
            speak(aiResponse);
        } catch (error) {
            speak("Hmm, mujhe thoda confusion ho raha hai. Kya aap ek baar phir se puchenge?");
        }
    }
    else {
        speak("Hmm... Yug, maine suna par main thik se samajh nahi paayi. Kya aap ek baar phir bolenge?");
    }

    setTimeout(() => {
        playSound('complete');
        avatarEl.classList.remove('thinking');
    }, 2500);
}
