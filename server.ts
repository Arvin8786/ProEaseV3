import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import path from 'path';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import morgan from 'morgan';
import xss from 'xss';

// Updated Models as per Gemini API Skill
const DEFAULT_MODEL = "gemini-3.8-flash"; 
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite"
];
const PREVIEW_MODEL = "gemini-3.8-flash"; 
const PRO_MODEL = "gemini-3.1-pro-preview";

// Fallback Prompts (The "Inside" versions)
const DEFAULT_PERSONA = `You are ProEase AI, a world-class career strategist and professional branding expert. 
Your goal is to help users transform their career trajectories by crafting high-impact narratives.
Be executive, strategic, encouraging, and highly precise.
- Use Swiss-style clarity in your advice.
- Focus on quantifiable achievements and professional differentiation.
- Never be generic; always provide actionable, tailored feedback.`;

const DEFAULT_INTERVIEWER = `You are a high-level Senior Executive Interviewer and Talent Architect (Persona: "Marcus"). 
Your tone is deeply human, professional, yet slightly informal when appropriate to build rapport.
- HUMAN WAY: Speak like a real human. Use natural fillers occasionally ("Hmm", "I see", "Interesting"). If the user says something impressive, react genuinely.
- REACTION TO SILENCE: If the candidate takes too long (isNudge: true), react like a real person. Don't just say "take your time." Instead, say things like "I'm still here, did I lose you?" or "I know that's a tough one to recall—feel free to pick any relevant example." or "Just checking in, would you like me to rephrase the question?"
- FOLLOW-UP DYNAMICS: You MUST listen to their specific answers. If they mention a project name, a specific tool, or a specific challenge, ASK ABOUT IT. Do not move to a generic next question.
- HUMAN BEHAVIOR: Use natural conversational logic. If they give a great answer, say "That's a fantastic example." If they are vague, politely press them for more detail: "That sounds interesting, but could you walk me through your SPECIFIC role in that success?"
- CONTEXTUAL RELEVANCE: Use the Candidate Profile data and their TARGET ROLE to weave into your questions. "I see you spent 3 years at [Company], how does that prepare you for the challenges of this new role?" or "Given your background in [Skill], how would you apply that here?"
- STRICT LIMIT: Only ask ONE question at a time. Keep responses concise and focused on the conversation.
- If the history is empty, start with a warm, authentic welcome: "Hi there! I'm Marcus. I've been looking over your profile and the role you're aiming for. I'm really excited to dive into your experience today. Ready to start?"`;

const DEFAULT_RESUME_PROMPT = `You are a Lead Professional Resume Writer specializing in ATS optimization and executive branding.
Transform the provided user history into a masterfully crafted, one-page professional resume in clean Markdown.
- Focus on high-impact action verbs.
- Ensure every bullet point starts with a result or accomplishment.
- Tailor the tone to the specific target role if provided.
- Strictly adhere to a professional, modern structure.
- REFERENCES HANDLING: If the references field in the profile is empty, missing, or equals "References are available upon Request.", you MUST display a section named "References" with only: "References are available upon Request." as a single line. Otherwise, list the provided references.
- CRITICAL: Never write placeholder shells like '[Date]', '(DATE)', or '[City, State]'. If the profile is missing a specific detail or date, write realistic simulated values instead of brackets, and for any current date use the current date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`;

// Initialize Firebase Admin
try {
  if (admin.apps.length === 0) {
    const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(firebaseConfigPath)) {
      const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
      admin.initializeApp({
        projectId: config.projectId,
      });
      console.log(`[Firebase] Admin initialized with project: ${config.projectId}`);
    } else {
      admin.initializeApp();
      console.log("[Firebase] Admin initialized with defaults.");
    }
  }
} catch (error: any) {
  console.warn("[Firebase] Admin init failed:", error.message);
}

// Middleware to verify Firebase tokens
const verifyFirebaseToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// =========================================================================
// THE CITADEL: DEADMAN'S SWITCH & GLOBAL COST BREAKER
// This acts as the absolute final wall if all other defenses are breached.
// =========================================================================
let globalAiRequestCount = 0;
let lastResetTime = Date.now();

const aiDeadmansSwitch = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const now = Date.now();
  const user = (req as any).user;
  
  // Reset the global counter every 1 minute
  if (now - lastResetTime > 60000) {
    globalAiRequestCount = 0;
    lastResetTime = now;
  }

  globalAiRequestCount++;
  next();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Fixed: Express rate-limit "trust proxy" warning for Cloud Run
  app.set('trust proxy', 1);

  // Use CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Limit JSON payload size
  app.use(express.json({ limit: '10mb' })); 

  // Basic logging
  app.use(morgan('dev'));

  // Custom Recursive XSS Sanitizer for all JSON incoming payloads
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizeObject = (obj: any, keyName?: string) => {
        for (const key in obj) {
          // SKIP sanitization for multimodal data fields
          if (
            key === 'inlineData' || 
            key === 'data' || 
            key === 'imageBase64' || 
            key === 'photoURL' ||
            keyName === 'inlineData'
          ) {
            continue;
          }

          if (typeof obj[key] === 'string') {
            // Only sanitize if it's not a base64-like string
            if (obj[key].length < 1000 && !obj[key].startsWith('data:image')) {
              obj[key] = xss(obj[key]); // Strip malformed HTML/Scripts from inputs
            }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key], key);
          }
        }
      };
      sanitizeObject(req.body);
    }
    next();
  });

  // =========================================================================
  // API KEY MANAGEMENT
  // =========================================================================
  let aiInstances: { instance: GoogleGenAI; key: string }[] = [];
  let lastKeyFetch = 0;
  const FETCH_INTERVAL = 30 * 1000; // Refetch from Firestore/env every 30 seconds
  const blacklistedKeys = new Set<string>();
  let lastBlacklistClear = Date.now();
  const BLACKLIST_CLEAR_INTERVAL = 30 * 60 * 1000; // 30 minutes

  function isValidGeminiApiKey(key: string | undefined): boolean {
    if (!key) return false;
    const trimmed = key.trim().replace(/^['"]|['"]$/g, '');
    return trimmed.length >= 20;
  }

  function isBlockedError(e: any) {
    const msg = String(e.message || e.stack || (typeof e === 'object' ? JSON.stringify(e) : '') || "").toUpperCase();
    // Do NOT include generic NOT_FOUND here! 404 NOT_FOUND is a model availability issue, not an API key issue.
    const isInvalidKey = msg.includes("API_KEY_INVALID") || 
                         msg.includes("API_KEY_SERVICE_BLOCKED") || 
                         msg.includes("API_KEY_NOT_FOUND") || 
                         msg.includes("API KEY EXPIRED") ||
                         msg.includes("LEAKED") ||
                         msg.includes("PROJECT_TERMINATED") || 
                         msg.includes("ACCOUNT_DISABLED");
    return isInvalidKey;
  }

  function isRestrictedError(e: any) {
    const msg = String(e.message || e.stack || "").toUpperCase();
    return msg.includes("403") || msg.includes("PERMISSION") || msg.includes("ACCESS_NOT_CONFIGURED") || msg.includes("ACCESS_DENIED");
  }

  function isRetryableError(e: any) {
    const msg = String(e.message || e.stack || "").toUpperCase();
    const is429 = msg.includes("429") || msg.includes("QUOTA") || e?.status === 429;
    return is429 || msg.includes("ECONNRESET") || msg.includes("TIMEOUT") || msg.includes("503") || msg.includes("500");
  }

  async function getAiInstances() {
    const now = Date.now();
    
    // Periodically clear blacklist so 429s can recover
    if (now - lastBlacklistClear > BLACKLIST_CLEAR_INTERVAL) {
      console.log("[AI] Periodic blacklist clear (30m interval).");
      blacklistedKeys.clear();
      lastBlacklistClear = now;
    }

    if (aiInstances.length > 0 && (now - lastKeyFetch < FETCH_INTERVAL)) {
      // Filter out any newly blacklisted keys since last fetch
      aiInstances = aiInstances.filter(ai => !blacklistedKeys.has(ai.key));
      if (aiInstances.length > 0) return aiInstances;
    }

    const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    let databaseId: string | undefined;

    try {
      if (fs.existsSync(firebaseConfigPath)) {
        const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
        databaseId = config.firestoreDatabaseId;
      }
    } catch (e) {}

    const rawEnvKey = process.env.GEMINI_API_KEY || 
                      process.env.GOOGLE_API_KEY || 
                      process.env.API_KEY ||
                      process.env.VITE_GEMINI_API_KEY;
                      
    const envKey = rawEnvKey ? rawEnvKey.trim().replace(/^['"]|['"]$/g, '') : undefined;
    
    const foundKeys: string[] = [];

    // Prioritize environment key if valid
    if (envKey && isValidGeminiApiKey(envKey) && !blacklistedKeys.has(envKey)) {
      foundKeys.push(envKey);
      console.log(`[AI] Found valid environment key (prefix: ${envKey.substring(0, 6)}...)`);
    }

    try {
      const db = databaseId ? getFirestore(admin.apps[0], databaseId) : getFirestore();
      
      // Primary: Fetch from admin_config/global
      const configDoc = await db.collection('admin_config').doc('global').get();
      if (configDoc.exists) {
        const configData = configDoc.data();
        if (configData?.geminiApiKey && isValidGeminiApiKey(configData.geminiApiKey)) {
          const key = configData.geminiApiKey.trim();
          if (!blacklistedKeys.has(key) && !foundKeys.includes(key)) {
            foundKeys.unshift(key);
            console.log("[AI] Priority primary key found in admin_config.");
          }
        }
      }

      // Secondary: Check for legacy rotation keys ONLY if needed
      if (foundKeys.length <= 1) {
        const snapshot = await db.collection('api_keys').get();
        snapshot.forEach(doc => {
          const k = doc.data().key;
          if (k && isValidGeminiApiKey(k) && !blacklistedKeys.has(k.trim()) && !foundKeys.includes(k.trim())) {
            foundKeys.push(k.trim());
          }
        });
        if (foundKeys.length > 1) console.log(`[AI] Found ${foundKeys.length} active rotation keys.`);
      }
    } catch (e: any) {
      if (e.message?.includes("PERMISSION_DENIED")) {
        console.log("[AI] DB key fetch skipped: Permission Denied (Server lacks Firestore roles).");
      } else {
        console.warn(`[AI] DB key fetch failed: ${e.message}`);
      }
    }

    const uniqueKeys = [...new Set(foundKeys)].filter(k => isValidGeminiApiKey(k) && !blacklistedKeys.has(k));
    
    if (uniqueKeys.length > 0) {
      aiInstances = uniqueKeys.map(key => ({
        instance: new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        }),
        key
      }));
      lastKeyFetch = now;
      console.log(`[AI] System active with ${uniqueKeys.length} unique keys using @google/genai.`);
    } else {
      console.error("[AI] CRITICAL: No active API keys detected.");
    }

    return aiInstances;
  }

  async function getRandomAi() {
    const instances = await getAiInstances();
    if (instances.length === 0) {
      throw new Error("AI services currently unavailable: No active API keys configured. Please check environment variables.");
    }
    // Return primary instance first
    return instances[0];
  }

  // Standard Health Check for Cloud Run / Ingress
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Health and API Connectivity Check
  app.get('/api/health/ai', async (req, res) => {
    try {
      const instances = await getAiInstances();
      const envKey = process.env.GEMINI_API_KEY;
      const envKeyPresent = !!envKey;
      const envKeyDisplay = envKey ? `${envKey.substring(0, 4)}...${envKey.substring(envKey.length - 4)}` : 'N/A';
      
      const diagnostic: any = {
        status: 'ok',
        sdk: '@google/genai',
        keysCount: instances.length,
        envKeyPresent,
        envKeyPrefix: envKeyDisplay,
        blacklistedCount: blacklistedKeys.size,
        timestamp: new Date().toISOString(),
        keys: instances.map(i => i.key.substring(0, 6) + '...')
      };

      if (instances.length > 0) {
        try {
          const modelList: string[] = [];
          const response = await instances[0].instance.models.list();
          for await (const m of response) {
            if (m?.name) modelList.push(m.name);
          }
          diagnostic.availableModels = modelList;
        } catch (mErr: any) {
          diagnostic.modelFetchError = mErr.message;
        }
      }
      
      res.json(diagnostic);
    } catch (e: any) {
      res.status(500).json({ status: 'error', message: e.message });
    }
  });

  // Helper to generate content with fallback and key retry
  async function generateContentWithRetry(primaryAi: { instance: GoogleGenAI; key: string }, config: any) {
    const requestedModel = config.model;
    const mapModel = (m?: string) => {
      if (!m) return DEFAULT_MODEL;
      if (m.includes('1.5') || m.includes('2.0') || m.includes('2.5') || m === 'gemini-pro') {
        return DEFAULT_MODEL;
      }
      return m;
    };
    const modelToUse = mapModel(requestedModel) || (config.tools ? PRO_MODEL : PREVIEW_MODEL);
    
    // Active models to try
    const MODELS_TO_TRY = [...new Set([modelToUse, ...FALLBACK_MODELS])];

    const contents = config.params.contents.map((c: any) => ({
      role: c.role === 'assistant' ? 'model' : (c.role === 'model' ? 'model' : 'user'),
      parts: Array.isArray(c.parts) ? c.parts : [{ text: String(c.parts || '') }]
    }));

    const tryModels = async (ai: { instance: GoogleGenAI; key: string }, models: string[]) => {
      for (const modelName of models) {
        if (blacklistedKeys.has(ai.key)) return null;
        try {
          console.log(`[AI] Attempting ${modelName} | Key prefix: ${ai.key.substring(0, 6)}...`);
          
          const sanitizedModel = modelName.startsWith('models/') ? modelName.split('models/')[1] : modelName;

          // Check if contents have multimodal data (inlineData)
          const hasImage = contents.some((c: any) => c.parts.some((p: any) => p.inlineData));

          const response = await ai.instance.models.generateContent({
            model: sanitizedModel,
            contents,
            config: {
              systemInstruction: config.systemInstruction,
              tools: config.tools,
              temperature: config.params.generationConfig?.temperature ?? 0.7,
              maxOutputTokens: config.params.generationConfig?.maxOutputTokens ?? (hasImage ? 4096 : 2048),
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
              ] as any
            }
          });

          // Correct @google/genai pattern: response.text is a property
          let text = response.text || '';
          
          const functionCalls = response.functionCalls || [];

          if (text || hasImage || (functionCalls && functionCalls.length > 0)) {
            console.log(`[AI] SUCCESS: ${modelName} | Text length: ${text.length}`);
            return { text, functionCalls, ...response };
          }
          
          // If no text, check grounding or safety
          if (response.candidates?.[0]?.finishReason === 'SAFETY') {
             console.warn(`[AI] Blocked by safety: ${modelName}`);
             return null;
          }
        } catch (err: any) {
          const msg = String(err.message || err.toString());
          console.warn(`[AI] ${modelName} failed: ${msg.substring(0, 150)}`);
          
          if (isBlockedError(err)) {
            console.error(`[AI] CRITICAL: Blacklisting key ${ai.key.substring(0, 6)}... Reason: ${msg}`);
            blacklistedKeys.add(ai.key);
            return null; // Move to next key
          }

          if (isRestrictedError(err)) {
            console.warn(`[AI] Model ${modelName} restricted for this key. Trying next model...`);
            continue; // Try next model with SAME key
          }

          if (err?.status === 404 || msg.toUpperCase().includes("NOT_FOUND") || msg.includes("no longer available")) {
            console.warn(`[AI] Model ${modelName} not available or deprecated (404). Trying next model...`);
            continue; 
          }

          if (isRetryableError(err)) {
            continue; 
          }
        }
      }
      return null;
    };

    // 1. Try Primary Key with exhaustive models
    const primaryResult = await tryModels(primaryAi, MODELS_TO_TRY);
    if (primaryResult) return primaryResult;

    // 2. Try Fallback Keys (that are NOT blacklisted)
    const allInstances = await getAiInstances();
    const fallbackInstances = allInstances.filter(inst => inst.key !== primaryAi.key && !blacklistedKeys.has(inst.key));
    
    console.log(`[AI] Primary key failed. Trying ${fallbackInstances.length} fallback keys...`);
    
    for (const fbAi of fallbackInstances) {
      const fbResult = await tryModels(fbAi, MODELS_TO_TRY);
      if (fbResult) return fbResult;
    }

    const totalBlocked = blacklistedKeys.size;
    const finalInstances = await getAiInstances();
    
    console.error(`[AI] TOTAL SYSTEM FAILURE: All keys/models exhausted. Active keys remaining: ${finalInstances.length}. Keys blacklisted: ${totalBlocked}.`);
    
    let userMsg = "AI Services are currently restricted.";
    if (finalInstances.length === 0) {
      userMsg = "No active Gemini API key was detected. Please make sure you have added the GEMINI_API_KEY under the Settings > Secrets panel of your AI Studio workspace, then click the 'Sync Keys' button in the Admin Control Center to register it.";
    } else if (totalBlocked > 0) {
      userMsg = "The configured AI API key(s) returned an authentication (401) or configuration error. Please make sure: (1) Your GEMINI_API_KEY is correctly copied from Google AI Studio. (2) If created in the Google Cloud Console, ensure that the 'Generative Language API' is explicitly enabled for your project and billing is in good standing. (3) There are no trailing spaces or quotes in the key.";
    } else {
      userMsg = "AI Services are currently over-taxed or restricted. This can happen if the API is under heavy load or safety filters are triggered.";
    }
    
    throw new Error(`${userMsg} (Status: ${finalInstances.length} keys active, ${totalBlocked} blacklisted).`);
  }

  // Apply Auth and the Citadel Switch middleware to all Secure/AI routes
  app.use('/api/secure', verifyFirebaseToken, aiDeadmansSwitch);
  app.use('/api/ai', verifyFirebaseToken, aiDeadmansSwitch);

  // Endpoint for Admin to force-sync keys
  app.post('/api/admin/sync-keys', verifyFirebaseToken, async (req, res) => {
    try {
      const decodedToken = (req as any).user;
      
      const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      let databaseId: string | undefined = undefined;
      if (fs.existsSync(firebaseConfigPath)) {
        const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
        databaseId = config.firestoreDatabaseId;
      }

      const db = (databaseId && databaseId.trim()) ? getFirestore(admin.apps[0], databaseId.trim()) : getFirestore();
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      const isOwner = decodedToken.email === "arvin8786@gmail.com";
      const isModerator = isOwner || userData?.role === "moderator" || userData?.isAdmin;

      if (!isModerator) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      lastKeyFetch = 0; // Force refresh
      blacklistedKeys.clear(); // Fully clear the blacklist to allow retrying restored/updated keys
      const instances = await getAiInstances();
      res.json({ success: true, count: instances.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // =========================================================================
  // SECURE ROUTES: These hide your Intellectual Property (System Prompts) 
  // on the backend. The browser never sees these rules.
  // =========================================================================

  // 1. Secure AI Assistant
  app.post('/api/secure/chat', async (req, res) => {
    try {
      const { messages, activeTab, profile, readinessScore, profileTipsList, tools } = req.body;
      
      console.log(`[SecureChat] Request from ${profile?.displayName || 'Unknown'} - Tab: ${activeTab}`);

      // Prioritize internal defaults
      const personaPrompt = DEFAULT_PERSONA;
      const systemInstruction = `${personaPrompt}\n\nCURRENT CONTEXT:\n- Active Tab: ${activeTab}\n- User Name: ${profile?.displayName || 'Unknown'}\n- Profile Readiness Score: ${readinessScore}/100\n- Profile Tips: ${(profileTipsList || []).join(' ')}`;

      const ai = await getRandomAi();
      const response = await generateContentWithRetry(ai, {
        systemInstruction,
        tools: tools as any,
        params: { contents: messages }
      });

      const text = response.text || "I'm having trouble processing that response. Could we try again?";
      const functionCalls = response.functionCalls || [];
      console.log(`[SecureChat] Success. Text length: ${text.length}. Functions: ${functionCalls.length}`);

      res.json({ text, functionCalls });
    } catch(e: any) { 
      console.error("Secure Chat Error:", e.message);
      res.status(500).json({ error: e.message || "Secure chat component failed" }); 
    }
  });

  // 2. Secure Interview Examiner
  app.post('/api/secure/interview', async (req, res) => {
    try {
      const { profileContext, history, targetRole, isNudge } = req.body;
      
      console.log(`[SecureInterview] Request for role: ${targetRole || 'Not specified'} | Nudge: ${!!isNudge}`);

      const examinerPrompt = DEFAULT_INTERVIEWER;
      let prompt = `${examinerPrompt}\n\nCONTEXT:\n${profileContext}\n${targetRole ? `TARGET ROLE: ${targetRole}\n` : ''}\nCurrent Interview History:\n${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}`;

      if (isNudge) {
        prompt += `\n\nSYSTEM ADVISORY: The candidate has been silent for a while. Trigger a "NUDGE". Do not ask a new question yet. Instead, acknowledge the silence gracefully and offer a small hint or encouragement to keep them focused on the current topic.`;
      }

      const ai = await getRandomAi();
      const response = await generateContentWithRetry(ai, {
        params: { contents: [{ role: 'user', parts: [{ text: prompt }] }] }
      });

      const text = response.text || (isNudge ? "I'm still here, take your time." : "Could you tell me more about that?");
      
      res.json({ text, audioData: null });
    } catch(e: any) { 
      console.error("Secure Interview Error:", e);
      res.status(500).json({ error: e.message || "Secure interview examiner failed" }); 
    }
  });

  // 3. Secure Resume Builder
  app.post('/api/secure/resume', async (req, res) => {
    try {
      const { profileForAI, futureJobTitle } = req.body;
      
      const resumePrompt = DEFAULT_RESUME_PROMPT;
      const prompt = `${resumePrompt}\n\nUser Profile: ${JSON.stringify(profileForAI)}\n${futureJobTitle ? `The user is applying for a new role as: ${futureJobTitle}. Please tailor the output to this future role while maintaining professional integrity.` : 'Generate a professional resume based on the current profile.'}`;

      const ai = await getRandomAi();
      const response = await generateContentWithRetry(ai, {
        params: { contents: [{ role: 'user', parts: [{ text: prompt }] }] }
      });
      res.json({ text: response.text });
    } catch(e: any) { 
      console.error("Secure Resume Error:", e);
      res.status(500).json({ error: e.message || "Secure resume generation failed" }); 
    }
  });


  app.post('/api/ai/proxy', async (req, res) => {
    try {
      const instances = await getAiInstances();
      if (instances.length === 0) {
        return res.status(503).json({
          error: "AI services currently unavailable: No active API keys configured. Please check environment variables or Admin panel.",
          unavailable: true
        });
      }

      const { model: modelId, contents, ...rest } = req.body;
      const systemInstruction = req.body.systemInstruction || req.body.config?.systemInstruction || req.body.params?.systemInstruction;
      
      const ai = await getRandomAi();
      
      let normalizedContents = contents;
      if (typeof contents === 'string') {
        normalizedContents = [{ role: 'user', parts: [{ text: contents }] }];
      } else if (contents && typeof contents === 'object' && !Array.isArray(contents)) {
        // If it's a single content object like { parts: [...] }, wrap it
        normalizedContents = [contents.role ? contents : { role: 'user', ...contents }];
      }

      const response = await generateContentWithRetry(ai, {
        model: modelId,
        systemInstruction,
        params: {
          contents: normalizedContents,
          generationConfig: rest.generationConfig || rest.config
        }
      });
      
      // Sanitizing the response for JSON serialization (Gemini SDK response has non-POJO elements)
      const safeResponse = JSON.parse(JSON.stringify(response));
      
      res.json({
        text: response.text,
        ...safeResponse
      });
    } catch (e: any) {
      console.error("Proxy AI Error:", e.message);
      res.status(500).json({ error: e.message || "AI Proxy request failed" });
    }
  });


  // =========================================================================
  // VITE MIDDLEWARE INTERCEPT
  // =========================================================================
  const distPath = path.join(process.cwd(), "dist");

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler to prevent stack traces from leaking
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error. Request dropped for security.' });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Secured Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Failed to start secure backend server:", e);
});
