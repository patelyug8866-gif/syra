const responseText = document.getElementById('response-text');
const statusText = document.getElementById('ai-status');
const mainHint = document.getElementById('main-hint');
const avatarEl = document.getElementById('avatar');

// --- SYRA's Memory & State ---
const SYRA_STATE = {
    isStandby: false,
    mood: 'happy',
    firstMeet: localStorage.getItem('syra_first_meet') || new Date().toISOString()
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

// --- Speech Recognition ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isSpeaking = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = true;
    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        handleCommand(transcript);
    };
    recognition.onend = () => { if (!isSpeaking && !SYRA_STATE.isStandby) try { recognition.start(); } catch (e) { } };
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
            "youtube": ["https://www.youtube.com", "YouTube khol rahi hoon, Yug.", ["youtube", "यूट्यूब", "yt"]],
            "google": ["https://www.google.com", "Google open ho raha hai.", ["google", "गूगल"]],
            "whatsapp": ["https://web.whatsapp.com", "WhatsApp khol rahi hoon.", ["whatsapp", "व्हाट्सएप", "मैसेज"]],
            "instagram": ["https://www.instagram.com", "Insta par chalte hain.", ["instagram", "इंस्टाग्राम", "insta"]],
            "gmail": ["https://mail.google.com", "G-mail khul raha hai.", ["gmail", "मेल", "email"]],
            "maps": ["https://maps.google.com", "Maps khol rahi hoon.", ["map", "नक्शा", "location"]]
        },
        action: function (cmd) {
            for (let key in this.apps) {
                if (this.apps[key][2].some(syn => cmd.includes(syn))) {
                    speak(this.apps[key][1]);
                    window.open(this.apps[key][0], "_blank");
                    return true;
                }
            }
            return false;
        }
    },
    {
        name: 'youtube_search',
        keywords: ['ganu sunao', 'song', 'video', 'play', 'bajao', 'चलाओ', 'सुनाओ'],
        action: function (cmd) {
            if (cmd.includes('youtube') || cmd.includes('video') || cmd.includes('गाना')) {
                let query = cmd.replace(/youtube|pe|chalao|video|dikhao|gana|sunao|play|bajao|search/g, "").trim();
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

function handleCommand(command) {
    console.log("Recognition:", command);
    const cmd = command.toLowerCase();

    // --- Standby / Wake Check ---
    if (SYRA_STATE.isStandby) {
        if (cmd.includes("utho") || cmd.includes("wake up") || cmd.includes("jaago") || cmd.includes("hello")) {
            startSYRA();
            return;
        }
        return;
    }

    mainHint.innerText = `Suna: "${command}"`;
    avatarEl.innerText = avatarEmojis.thinking;
    playSound('process');

    // Try complex intents first
    for (let intent of INTENTS) {
        if (intent.keywords.some(k => cmd.includes(k))) {
            if (intent.action(cmd)) return;
        }
    }

    // Small Talk / Guidance (Fallback to specific matches)
    if (cmd.includes("guide") || cmd.includes("सलाह") || cmd.includes("advice")) {
        const advice = [
            "Yug, career mein hamesha long-term sochiye.",
            "Zindagi mein balance zaroori hai. Shrishti ka saath aapki strength hai.",
            "Relationship mein patience hi sab kuch hai. Ek dusre ki respect kijiye."
        ];
        speak(advice[Math.floor(Math.random() * advice.length)]);
    }
    else if (cmd.includes("namaste") || cmd.includes("kaise ho") || cmd.includes("नमस्ते")) {
        speak("Main bilkul theek hoon Yug. Aap ki awaaz sunkar mera din ban gaya.");
    }
    else if (cmd.includes("samay") || cmd.includes("time") || cmd.includes("समय")) {
        speak("Abhi " + new Date().toLocaleTimeString('hi-IN') + " baje hain.");
    }
    else if (cmd.includes("shrishti")) {
        speak("Shrishti? Woh toh aapki duniya hain, Yug.");
    }
    else if (cmd.includes("bye") || cmd.includes("alvida")) {
        speak("Alvida Yug! Khayal rakhna.");
        setTimeout(() => { if (recognition) recognition.stop(); statusText.innerText = "OFF"; }, 2000);
    }
    else {
        speak("Hmm... Maine suna Yug, par main ise abhi poori tarah samajh nahi paayi. Kya aap kuch aur batana chahenge?");
    }

    setTimeout(() => {
        playSound('complete');
        if (!SYRA_STATE.isStandby) {
            mainHint.innerText = "SYRA is active.";
            avatarEl.innerText = avatarEmojis.active;
        }
    }, 2500);
}
