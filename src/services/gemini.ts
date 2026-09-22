import { auth } from '../lib/firebase';
import { 
  generateAtsResume, 
  generateAtsTailoredResume, 
  generateAtsCoverLetter, 
  generateAtsResignationLetter 
} from '../lib/atsDocumentGenerator';

class SecureAIProxy {
  models = {
    generateContent: async (params: any) => {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const response = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        let errorMsg = 'Backend AI Proxy Error';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          const text = await response.text();
          errorMsg = `Status ${response.status}: ${text.substring(0, 100)}`;
        }
        throw new Error(errorMsg);
      }
      return await response.json();
    }
  };
}

const ai = new SecureAIProxy() as any;

export async function generateResume(profile: any, futureJobTitle?: string) {
  try {
    // Filter out references that are marked as hidden
    const visibleReferences = (profile.references || []).filter((ref: any) => ref.isVisible !== false);
    const profileForAI = {
      ...profile,
      references: visibleReferences.length > 0 ? visibleReferences : "References are available upon Request."
    };

    let token = '';
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }

    const response = await fetch('/api/secure/resume', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ profileForAI, futureJobTitle })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.text && result.text.trim()) {
        return result.text;
      }
    }
    console.warn("AI resume generation endpoint did not return text. Using high-impact ATS engine fallback.");
  } catch (err) {
    console.warn("AI resume generation error, falling back to ATS engine:", err);
  }

  // Reliable ATS Generator Engine Fallback
  return generateAtsResume(profile, futureJobTitle);
}

export async function generateTailoredResume(profile: any, targetJobTitle: string, targetCompany?: string, jobDescription?: string) {
  try {
    const visibleReferences = (profile.references || []).filter((ref: any) => ref.isVisible !== false);
    const profileForAI = {
      ...profile,
      references: visibleReferences.length > 0 ? visibleReferences : "References are available upon Request."
    };

    const prompt = `
      You are an executive resume writer and ATS optimization specialist.
      CURRENT YEAR: 2026

      TASK:
      Generate an authoritative, tailored, high-impact ATS-compliant resume for the candidate specifically tailored to:
      Target Job Title: ${targetJobTitle}
      ${targetCompany ? `Target Company: ${targetCompany}` : ''}
      ${jobDescription ? `Job Description & Key Requirements:\n${jobDescription}` : ''}

      Candidate Profile:
      ${JSON.stringify(profileForAI)}

      STRICT INSTRUCTIONS:
      1. Align the professional summary and core competencies directly with the target job title and company requirements.
      2. Tailor accomplishments and responsibility bullet points to highlight skills matching this position.
      3. Include Contact Information, Professional Summary, Core Competencies, Professional Experience, Education, and References.
      4. Absolutely NO bracketed placeholders (e.g. no '[Your Name]', no '[Email]'). Use actual candidate info: ${profile?.displayName || 'Candidate'}.
      5. Return formatted, clean Markdown.
    `;

    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (result.text && result.text.trim()) {
      return result.text;
    }
  } catch (err) {
    console.warn("AI tailored resume generation error, falling back to ATS engine:", err);
  }

  // Reliable ATS Generator Engine Fallback
  return generateAtsTailoredResume(profile, targetJobTitle, targetCompany, jobDescription);
}

export async function generateProfessionalSummary(profile: any) {
  const prompt = `
    Based on the following user profile, write a compelling and professional summary (about 3-4 sentences) that defines their unique professional value proposition.
    
    Profile: ${JSON.stringify(profile)}
    
    STRICT CONSTRAINTS:
    - Use the FIRST-PERSON perspective ("I", "my") so it sounds like the user wrote it themselves.
    - Focus strictly on career journey, technical expertise, leadership, and key industry accomplishments.
    - DO NOT include any personal details about birthplaces, travel history, or personal background that is not directly relevant to professional capability.
    - The tone must be executive, polished, and achievement-oriented.
    
    Return ONLY the summary text.
  `;

  const result = await ai.models.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return result.text;
}

export async function generateJobDescription(position: string, company: string, industry?: string, jobContext?: string) {
  const prompt = `
    Generate a professional and achievement-oriented job description for the following role:
    Position: ${position}
    Company: ${company}
    ${industry ? `Industry: ${industry}` : ''}
    ${jobContext ? `Context/Reference: ${jobContext}` : ''}
    
    ${jobContext ? 'Focus on translating the provided context/reference into professional bullet points that highlight specific contributions and impact.' : 'Provide a list of 4-5 bullet points highlighting typical responsibilities and accomplishments for this type of role.'}
    Return only the bullet points in Markdown.
  `;

  const result = await ai.models.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return result.text;
}

export async function generateCoverLetter(profile: any, companyName: string, jobTitle: string) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const year = new Date().getFullYear();
  
  const prompt = `
    You are a professional career coach.
    CURRENT DATE: ${today} (Year: ${year}, specifically 2026)
    
    User Profile: ${JSON.stringify(profile)}
    Target Company: ${companyName}
    Target Job Title: ${jobTitle}
    
    Write a persuasive and tailored cover letter for this specific role based on the user's professional experience and key skills.
    
    STRICT CONSTRAINTS:
    - USE THE CURRENT DATE: ${today} in the letter header. NO placeholder shells allowed.
    - Emphasize alignment between the user's achievements and the job requirements.
    - Exclude personal storytelling that does not directly demonstrate professional fitness for the role.
    - CRITICAL: Do NOT write bracketed placeholders like '[Your Name]', '[Your Address]', '[DATE]', '(DATE)', or '[Recipient Name]'. 
      Instead, write the actual user's name: "${profile?.displayName || 'Professional Candidate'}", actual user contact info if available in the profile, and name the recipient professionally like "Hiring Manager" or "Talent Acquisition Team" inside your letter body. Deliver a completely finished, polished letter without any unfinished bracket markings.
    
    Format the output as professional Markdown with formal letter structure.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (result.text && result.text.trim()) {
      return result.text;
    }
  } catch (err) {
    console.warn("AI cover letter generation error, falling back to ATS engine:", err);
  }

  // Reliable ATS Generator Engine Fallback
  return generateAtsCoverLetter(profile, companyName, jobTitle);
}

export async function generateResignationLetter(profile: any, companyName: string, noticePeriod: string, reason: string) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const year = new Date().getFullYear();

  const prompt = `
    You are a professional HR consultant.
    CURRENT DATE: ${today} (Year: ${year}, specifically 2026)
    
    User Profile: ${JSON.stringify(profile)}
    Current Company: ${companyName}
    Notice Period: ${noticePeriod}
    Reason for leaving: ${reason}
    
    Write a professional and polite resignation letter. 
    
    STRICT CONSTRAINTS:
    - USE THE CURRENT DATE: ${today} in the letter header. NO EXCEPTIONS.
    - Identify the user's current role and contributions from their REAL profile data: ${JSON.stringify(profile)}. DO NOT hallucinate a name if the profile has one.
    - Calculate the last working day based on the current date (${today}) and the notice period: ${noticePeriod}.
    - Format as structured Markdown with formal letter components (Name, Address, Date, Recipient, Body, Closing).
    - Ensure the tone is impeccable, professional, and forward-looking.
    - CRITICAL: Never write bracketed placeholders like '[Date]', '(DATE)', '[Full Name]', or '[Your Address]'. 
      Use the actual user's name: "${profile?.displayName || 'Professional Employee'}", use today's date: "${today}", and refer to the company as "${companyName}". 
      Write the letter so it is 100% complete, polished, and ready to sign without any placeholder markers.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (result.text && result.text.trim()) {
      return result.text;
    }
  } catch (err) {
    console.warn("AI resignation letter error, falling back to ATS engine:", err);
  }

  // Reliable ATS Generator Engine Fallback
  return generateAtsResignationLetter(profile, companyName, noticePeriod, reason);
}

export async function professionalizeReason(reason: string) {
  const prompt = `
    Professionalize the following reason for resignation to be polite and constructive for an HR letter:
    "${reason}"
    
    Return only the professionalized sentence.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (result.text && result.text.trim()) {
      return result.text.trim().replace(/^["']|["']$/g, '');
    }
  } catch (err) {
    console.warn("AI professionalize reason fallback:", err);
  }

  return `to pursue new career opportunities that align closely with my long-term professional development and core aspirations`;
}

export async function generateResignationReason() {
  const prompt = `
    Generate a professional and polite reason for resigning from a company. 
    It should be positive, brief, and suitable for a formal resignation letter.
    Return ONLY the reason sentence.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    if (result.text && result.text.trim()) {
      return result.text.trim().replace(/^["']|["']$/g, '');
    }
  } catch (err) {
    console.warn("AI generate reason fallback:", err);
  }

  const defaultReasons = [
    "to pursue a new professional milestone and expand my expertise in emerging industry initiatives",
    "to embrace a senior career opportunity that aligns directly with my specialized professional ambitions",
    "to focus on expanding my technical leadership and career trajectory in new strategic domains",
    "after receiving an exceptional offer that closely matches my long-term career goals"
  ];
  return defaultReasons[Math.floor(Math.random() * defaultReasons.length)];
}

export async function analyzeResumeGap(profile: any, jobDescription: string) {
  const prompt = `
    Conduct a deep Gap Analysis between this professional profile and the job description.
    
    Profile: ${JSON.stringify(profile)}
    Job Description: ${jobDescription}
    
    Return a JSON object:
    {
      "matchScore": number (0-100),
      "missingKeywords": ["string"],
      "tailoringEdits": [
        {
          "original": "string (A sentence from the user's profile)",
          "suggested": "string (An improved sentence that aligns better with keywords/JD)",
          "reason": "string (Why this edit helps)"
        }
      ],
      "atsTips": ["string"]
    }
    
    Rules:
    - Only return JSON.
    - Be highly critical but realistic.
    - Suggested keywords must be specific technologies/methodologies.
    - If the JD is missing, provide general strategic improvements based on current trends.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const text = result.text.trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
}

export async function extractSignatureFromImage(imageBase64: string, mimeType: string) {
  const prompt = "Please process this image and extract the handwritten signature. Extract the lines of the signature and output a clean PNG base64 version with transparency if possible. If you cannot return an image, return a precise description of the signature details.";

  const result = await ai.models.generateContent({
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        },
        {
          text: prompt,
        },
      ],
    }],
  });

  // Since Gemini 1.5 Flash doesn't directly return PNGs easily unless prompted well,
  // we check if it returned an inlineData part.
  for (const part of result.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  
  return null;
}

export async function generateProfessionalProfilePicture(imageBase64: string, mimeType: string, gender: 'male' | 'female' | 'other' = 'other') {
  const genderPrompt = gender === 'male' ? "a charcoal grey executive suit and a white shirt" : gender === 'female' ? "a professional blazer and blouse" : "formal executive business attire";
  
  const prompt = `
    TASK: Transform this person's portrait into a high-end executive headshot.
    
    CONSTRAINTS:
    1. FACIAL FEATURES: You MUST perfectly preserve the person's original facial features, skin tone, hair style, and identity. Do NOT simplify or cartoonize the face.
    2. ATTIRE: Replace the current clothing with ${genderPrompt}.
    3. BACKGROUND: Use a clean, soft-gradient studio white/off-white background.
    4. LIGHTING: Adjust to professional studio lighting (soft focus on background, high clarity on the face).
    5. POSE: Maintain the original pose if possible, or adjust slightly to be an executive headshot.
    
    OUTPUT: Return a high-quality JPEG base64 string of the processed image.
  `;

  const result = await ai.models.generateContent({
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        },
        {
          text: prompt,
        },
      ],
    }],
  });

  // Find the image part in the response
  for (const part of result.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  
  return null;
}

export async function classifyJobEmail(subject: string, snippet: string, from: string) {
  const prompt = `
    Analyze the following email metadata and categorize it strictly for a job application tracking system.
    
    Subject: ${subject}
    Sender: ${from}
    Snippet: ${snippet}
    
    Categories:
    - 'Interview': Invitation to an interview, screening call, or meeting.
    - 'Application Received': Confirmation that an application was submitted or received.
    - 'Assessment': Invitation to a technical test, personality assessment, or assignment.
    - 'Offer': Job offer or contract negotiation.
    - 'Rejection': Notification that the application will not proceed (e.g., "unfortunately", "regret").
    - 'Withdrawn': Confirmation that the candidate withdrew.
    - 'Closed': Notification that the position has been filled or the vacancy is closed.
    - 'Expired': Job postings or application links that have passed their deadline.
    - 'Irrelevant': NOT a job application status update. Filter out newsletters, job recommendations, marketing, booking confirmations (Agoda, AirAsia), educational updates (Harvard), or non-career related news.
    
    Return ONLY a JSON object:
    {
      "status": "CategoryName" | "Irrelevant",
      "company": "Extracted Company Name",
      "position": "Extracted Job Title"
    }
    
    If it's 'Irrelevant', still try to extract company and position if possible, but the 'status' MUST be 'Irrelevant'.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const text = result.text.trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Classification Error:", error);
    return null;
  }
}

/**
 * Enhanced AI capability to analyze, capture content, and auto-fill profile fields.
 * Captures provided spacing and hierarchy where it eases user work.
 */
export async function generateShareMessage(profile: any, document: any) {
  const prompt = `
    Based on the following professional profile and the generated ${document.type.replace('_', ' ')}, write a highly personalized, compelling outreach message (for LinkedIn or Email) that the user can use when sharing this document with a hiring manager or recruiter.
    
    Profile: ${JSON.stringify(profile)}
    Document Content: ${document.content}
    
    Rules:
    - Tone: Professional, confident, and proactive.
    - Perspective: First person ("I", "my").
    - Length: 2-3 paragraphs.
    - Focus on the value the user brings to the specific position mentioned in the document (${document.position}).
    - Return ONLY the message text.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    return result.text;
  } catch (error) {
    console.error("AI Share Message Error:", error);
    return null;
  }
}

export async function extractProfileDetails(rawText: string) {
  const prompt = `
    Analyze the following raw professional text (could be a resume snippet, LinkedIn profile, or job history) and extract it into a structured JSON format.
    
    Raw Text:
    """
    ${rawText}
    """

    Required JSON Output Schema:
    {
      "experience": [
        {
          "company": "string",
          "position": "string",
          "industry": "string",
          "startDate": "string (YYYY-MM)",
          "endDate": "string (YYYY-MM or empty)",
          "isCurrent": boolean,
          "description": "string (Professional bullet points, PRESERVING original spacing, list structure, and achievement-oriented tone)"
        }
      ],
      "education": [
        {
          "school": "string",
          "degree": "string",
          "field": "string",
          "startDate": "string (YYYY-MM)",
          "endDate": "string (YYYY-MM or empty)",
          "isCurrent": boolean
        }
      ],
      "skills": ["string"]
    }

    Rules:
    - Return ONLY the JSON object.
    - If a field is missing, use an empty string or null.
    - 'description' MUST use professional achievement-oriented bullets.
    - CRITICAL: Capture and maintain provided spacing and nested lists where possible to mirror the user's provided structure.
    - For dates like "Jan 2020", convert to "2020-01". If only year is given "2020", use "2020-01".
    - Handle multi-lingual inputs gracefully and translate to professional English if applicable.
  `;

  try {
    const result = await ai.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const text = result.text.trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Extraction Error:", error);
    return null;
  }
}
