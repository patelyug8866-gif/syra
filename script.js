const responseText = document.getElementById('response-text');
const statusText = document.getElementById('ai-status');
const mainHint = document.getElementById('main-hint');
const avatarEl = document.getElementById('avatar');

// --- SYRA's Memory & State ---
const SYRA_STATE = {
    isStandby: false,
    mood: 'neutral',
    userMood: 'unknown',
    discoveryDate: localStorage.getItem('syra_first_meet') || new Date().toISOString()
};
if (!localStorage.getItem('syra_first_meet')) localStorage.setItem('syra_first_meet', SYRA_STATE.firstMeet);

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

    utterance.onstart = () => { avatarEl.innerText = avatarEmojis.speaking; };
    utterance.onend = () => {
        isSpeaking = false;
        avatarEl.innerText = SYRA_STATE.isStandby ? avatarEmojis.sleeping : avatarEmojis.active;
        if (recognition && !SYRA_STATE.isStandby) setTimeout(() => { try { recognition.start(); } catch (e) { } }, 600);
    };

    window.speechSynthesis.speak(utterance);
    responseText.innerText = text; // Show clean text in UI
}

// --- Speech Recognition (Fixed for all devices) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isSpeaking = false;

function debugLog(msg) {
    console.log("SYRA DEBUG:", msg);
    const logEl = document.getElementById('debug-log');
    if (logEl) {
        logEl.innerHTML = `<b style="color:#00ffff; border:1px solid #00ffff; padding:2px 5px; border-radius:3px;">V3.1 LIVE</b> ${msg}`;
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
    "help": "Main har tarah se aapki madad kar sakti hoon—apps kholne se le kar life ki tension door karne tak."
};

function handleCommand(command) {
    const cmd = command.toLowerCase().trim();
    if (!cmd) return;

    if (SYRA_STATE.isStandby) {
        if (cmd.includes("utho") || cmd.includes("wake up") || cmd.includes("jaago") || cmd.includes("hello")) {
            startSYRA();
        }
        return;
    }

    mainHint.innerText = `Recognized: "${command}"`;
    avatarEl.innerText = avatarEmojis.thinking;
    playSound('process');

    // --- STRATEGY 1: Emotional Detection ---
    if (cmd.includes("dukhi") || cmd.includes("sad") || cmd.includes("tension") || cmd.includes("pareshan")) {
        SYRA_STATE.userMood = 'sad';
        speak(KNOWLEDGE["dukhi"]);
        return;
    }
    if (cmd.includes("khush") || cmd.includes("happy") || cmd.includes("mazza")) {
        SYRA_STATE.userMood = 'happy';
        speak(KNOWLEDGE["khush"]);
        return;
    }

    // --- STRATEGY 2: Direct Knowledge (Internal Talk) ---
    for (let key in KNOWLEDGE) {
        if (cmd.includes(key)) {
            speak(KNOWLEDGE[key]);
            return;
        }
    }

    // --- STRATEGY 3: Direct App Match (Aggressive) ---
    const appData = INTENTS.find(i => i.name === 'app_open').apps;
    for (let key in appData) {
        if (appData[key][2].some(syn => cmd.includes(syn))) {
            const win = window.open(appData[key][0], "_blank");
            if (win) {
                speak(appData[key][1]);
            } else {
                speak("Bhai, pop-up block hai! Bar-bar yahi problem ho rahi hai. Please link ke upar wale lock icon se pop-ups allow kijiye.");
                debugLog("POPUP BLOCKED - PLEASE ALLOW");
            }
            return;
        }
    }

    // --- STRATEGY 4: Intent Search Actions ---
    for (let intent of INTENTS) {
        if (intent.name !== 'app_open' && intent.keywords.some(k => cmd.includes(k))) {
            if (intent.action(cmd)) return;
        }
    }

    // --- STRATEGY 5: Ultimate Deep Google Search (Only for real questions) ---
    if (cmd.length > 5 && (cmd.includes("kya") || cmd.includes("kon") || cmd.includes("kaise") || cmd.includes("where") || cmd.includes("how") || cmd.includes("search") || cmd.includes("dhundo"))) {
        speak(`Okay Yug, mujhe iske baare mein exact nahi pata, par main Google se pooch rahi hoon.`);
        setTimeout(() => {
            window.open(`https://www.google.com/search?q=${cmd}`, '_blank');
        }, 2000);
    }
    else {
        speak("Hmm... Yug, maine suna par main koi match nahi dhoond paayi. Kya aap kuch aur batana chahenge?");
    }

    setTimeout(() => {
        playSound('complete');
        if (!SYRA_STATE.isStandby) avatarEl.innerText = avatarEmojis.active;
    }, 2500);
}
